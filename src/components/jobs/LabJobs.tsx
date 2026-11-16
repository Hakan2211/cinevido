/**
 * The app-wide job tracker (see src/lib/lab-jobs.ts).
 *
 * Mounted once in the `_app` layout, so it keeps running while the user moves
 * between pages. It lists the user's unfinished lab jobs, polls each one
 * (polling is what makes the server save the result), refreshes the library
 * when one lands and shows a toast with a "View" button that opens the
 * result in its lab, from any page.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  DONE_LABEL,
  FAILED_LABEL,
  LAB_OF,
  LAB_PATH,
  normaliseStatus,
} from '@/lib/lab-jobs'
import type { LabId, LabJob, LabJobKind, LabJobStatus } from '@/lib/lab-jobs'

const LAB_JOBS_KEY = ['labJobs'] as const
const POLL_MS = 2500
/** a job whose status check keeps throwing is given up after this many */
const MAX_POLL_ERRORS = 4

/** A running job with its latest poll */
export interface TrackedJob extends LabJob {
  live: LabJobStatus | null
}

/** A finished job the user asked to see ("View" on its toast) */
export interface JobFocus {
  jobId: string
  kind: LabJobKind
  assetId: string | null
}

interface LabJobsContext {
  jobs: Array<TrackedJob>
  /** re-read the list (call after submitting a job) */
  refresh: () => Promise<void>
  /** "Stop waiting": cancel at fal if still queued, and drop it */
  stop: (jobId: string) => void
  /** the last failure message per kind, until the next run of that kind */
  failures: Partial<Record<LabJobKind, string>>
  clearFailure: (kind: LabJobKind) => void
  focus: JobFocus | null
  clearFocus: () => void
  /** listen for jobs landing (completed or failed) */
  subscribe: (fn: (job: LabJob, status: LabJobStatus) => void) => () => void
}

const Ctx = createContext<LabJobsContext | null>(null)

async function pollJob(job: LabJob): Promise<LabJobStatus> {
  const data = { jobId: job.id }
  switch (job.kind) {
    case 'image': {
      const { getImageJobStatusFn } = await import('@/server/image.server')
      return normaliseStatus(await getImageJobStatusFn({ data }))
    }
    case 'edit':
    case 'upscale': {
      const { getEditJobStatusFn } = await import('@/server/edit.server')
      return normaliseStatus(await getEditJobStatusFn({ data }))
    }
    case 'layers': {
      const { getLayerizeJobStatusFn } = await import('@/server/layers.server')
      return normaliseStatus(await getLayerizeJobStatusFn({ data }))
    }
    case 'video': {
      const { getVideoJobStatusFn } = await import('@/server/video.server')
      return normaliseStatus(await getVideoJobStatusFn({ data }))
    }
    case 'video-upscale': {
      const { getVideoUpscaleJobStatusFn } =
        await import('@/server/video-upscale.server')
      return normaliseStatus(await getVideoUpscaleJobStatusFn({ data }))
    }
    case 'motion': {
      const { getMotionControlJobStatusFn } =
        await import('@/server/motion-control.server')
      return normaliseStatus(await getMotionControlJobStatusFn({ data }))
    }
  }
}

/** The library queries a finished job changes */
const REFRESH: Record<LabId, Array<ReadonlyArray<string>>> = {
  images: [['images'], ['library']],
  videos: [['videos'], ['library']],
  motion: [['motion-control-videos'], ['videos'], ['library']],
}

export function LabJobsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const pathname = useLocation({ select: (l) => l.pathname })
  const pathRef = useRef(pathname)
  pathRef.current = pathname

  const { data: listed = [], refetch } = useQuery({
    queryKey: LAB_JOBS_KEY,
    queryFn: async () => {
      const { listActiveLabJobsFn } = await import('@/server/jobs.server')
      return listActiveLabJobsFn()
    },
    // the per-job polls below do the work; this only picks up jobs started
    // in another tab
    refetchInterval: (q) => ((q.state.data?.length ?? 0) > 0 ? 15_000 : false),
    refetchOnWindowFocus: true,
  })

  const [live, setLive] = useState<Record<string, LabJobStatus>>({})
  const [failures, setFailures] = useState<Partial<Record<LabJobKind, string>>>(
    {},
  )
  const [focus, setFocus] = useState<JobFocus | null>(null)
  const listeners = useRef(
    new Set<(job: LabJob, status: LabJobStatus) => void>(),
  )
  // jobs already reported (or stopped): never toast twice
  const settled = useRef(new Set<string>())
  const pollErrors = useRef(new Map<string, number>())
  const busyWarned = useRef(new Set<string>())

  const jobs = useMemo(
    () => listed.filter((j) => !settled.current.has(j.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listed, live],
  )
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs

  const dropFromList = useCallback(
    (jobId: string) => {
      queryClient.setQueryData<Array<LabJob>>(LAB_JOBS_KEY, (old) =>
        old?.filter((j) => j.id !== jobId),
      )
    },
    [queryClient],
  )

  const land = useCallback(
    (job: LabJob, status: LabJobStatus) => {
      if (settled.current.has(job.id)) return
      settled.current.add(job.id)
      dropFromList(job.id)
      const lab = LAB_OF[job.kind]

      if (status.status === 'completed') {
        for (const key of REFRESH[lab]) {
          queryClient.invalidateQueries({ queryKey: key })
        }
        queryClient.invalidateQueries({ queryKey: ['falCredits'] })
        setFailures((f) => ({ ...f, [job.kind]: undefined }))
        toast.success(DONE_LABEL[job.kind], {
          description: job.prompt ? truncate(job.prompt, 80) : undefined,
          action: {
            label: 'View',
            onClick: () => {
              setFocus({
                jobId: job.id,
                kind: job.kind,
                assetId: status.assetId,
              })
              if (!pathRef.current.startsWith(LAB_PATH[lab])) {
                navigate({
                  to: LAB_PATH[lab],
                  search: job.kind === 'layers' ? { mode: 'layers' } : {},
                } as never)
              }
            },
          },
        })
      } else {
        const message = status.error || 'Generation failed'
        setFailures((f) => ({ ...f, [job.kind]: message }))
        toast.error(FAILED_LABEL[job.kind], { description: message })
      }
      for (const fn of listeners.current) fn(job, status)
    },
    [dropFromList, navigate, queryClient],
  )

  // Poll every running job; one tick at a time
  const hasJobs = jobs.length > 0
  useEffect(() => {
    if (!hasJobs) return
    let cancelled = false
    let ticking = false

    const tick = async () => {
      if (ticking) return
      ticking = true
      try {
        await Promise.all(
          jobsRef.current.map(async (job) => {
            try {
              const status = await pollJob(job)
              if (cancelled || settled.current.has(job.id)) return
              pollErrors.current.delete(job.id)
              if (status.status === 'completed' || status.status === 'failed') {
                land(job, status)
                return
              }
              setLive((l) => ({ ...l, [job.id]: status }))
              warnIfBusy(job, status, busyWarned.current)
            } catch (err) {
              if (cancelled) return
              const n = (pollErrors.current.get(job.id) ?? 0) + 1
              pollErrors.current.set(job.id, n)
              if (n >= MAX_POLL_ERRORS) {
                land(job, {
                  status: 'failed',
                  progress: 0,
                  queuePosition: null,
                  error:
                    err instanceof Error ? err.message : 'Status check failed',
                  assetId: null,
                  url: null,
                })
              }
            }
          }),
        )
      } finally {
        ticking = false
      }
    }

    void tick()
    const timer = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [hasJobs, land])

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const stop = useCallback(
    (jobId: string) => {
      settled.current.add(jobId)
      dropFromList(jobId)
      toast.info('Stopped waiting', {
        description: 'If fal already started it, it may still be billed.',
      })
      void (async () => {
        try {
          const { stopLabJobFn } = await import('@/server/jobs.server')
          await stopLabJobFn({ data: { jobId } })
        } catch {
          // the job is gone from the list either way
        }
      })()
    },
    [dropFromList],
  )

  const clearFailure = useCallback(
    (kind: LabJobKind) =>
      setFailures((f) => (f[kind] ? { ...f, [kind]: undefined } : f)),
    [],
  )
  const clearFocus = useCallback(() => setFocus(null), [])
  const subscribe = useCallback(
    (fn: (job: LabJob, status: LabJobStatus) => void) => {
      listeners.current.add(fn)
      return () => {
        listeners.current.delete(fn)
      }
    },
    [],
  )

  const value = useMemo<LabJobsContext>(
    () => ({
      jobs: jobs.map((j) => ({ ...j, live: live[j.id] ?? null })),
      refresh,
      stop,
      failures,
      clearFailure,
      focus,
      clearFocus,
      subscribe,
    }),
    [
      jobs,
      live,
      refresh,
      stop,
      failures,
      clearFailure,
      focus,
      clearFocus,
      subscribe,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function warnIfBusy(job: LabJob, status: LabJobStatus, warned: Set<string>) {
  const q = status.queuePosition
  if (!q || q < 50 || warned.has(job.id)) return
  warned.add(job.id)
  if (q >= 200) {
    toast.error('fal.ai is overloaded', {
      description: `Queue position ${q}. Consider switching to a different model.`,
      duration: 8000,
    })
  } else {
    toast.warning('fal.ai is busy', {
      description: `Queue position ${q}. This may take longer than usual.`,
      duration: 6000,
    })
  }
}

function useLabJobsContext(): LabJobsContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLabJobs needs <LabJobsProvider>')
  return ctx
}

/** Running jobs (optionally of some kinds) and the tracker's actions */
export function useLabJobs(kinds?: ReadonlyArray<LabJobKind>) {
  const ctx = useLabJobsContext()
  const jobs = useMemo(
    () => (kinds ? ctx.jobs.filter((j) => kinds.includes(j.kind)) : ctx.jobs),
    // kinds is a constant array at every call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.jobs],
  )
  return { ...ctx, jobs }
}

/**
 * Run `open` when the user pressed "View" on a job of this lab. It is called
 * again when `ready` changes (e.g. the library has loaded the new asset);
 * return true once handled.
 */
export function useJobFocus(
  lab: LabId,
  open: (focus: JobFocus) => boolean,
  ready: unknown,
) {
  const { focus, clearFocus } = useLabJobsContext()
  const openRef = useRef(open)
  openRef.current = open
  useEffect(() => {
    if (!focus || LAB_OF[focus.kind] !== lab) return
    if (openRef.current(focus)) clearFocus()
  }, [focus, lab, ready, clearFocus])
}

/** Listen for this lab's jobs landing while the page is open */
export function useJobLanded(fn: (job: LabJob, status: LabJobStatus) => void) {
  const { subscribe } = useLabJobsContext()
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => subscribe((j, s) => fnRef.current(j, s)), [subscribe])
}
