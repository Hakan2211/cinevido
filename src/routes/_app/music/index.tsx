/**
 * Music Lab — text-to-music through fal.ai.
 *
 * Create rail → track list → inspector, with the transport pinned across the
 * bottom. Finished tracks become assets of type "music", so they show up in a
 * project's library and land on the Music lane of the timeline.
 */

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
// NOTE: Server functions are dynamically imported in queryFn/mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions
import {
  CreatePanel,
  PlayerBar,
  TrackInspector,
  TrackList,
} from '../../../components/music'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { downloadFile, generateFilename } from '@/lib/download'
import type { MusicFormValues, MusicTrack } from '../../../components/music'

export const Route = createFileRoute('/_app/music/')({
  component: MusicPage,
})

const JOB_POLL_INTERVAL = 3000

function MusicPage() {
  const queryClient = useQueryClient()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MusicTrack | null>(null)

  // ---- data ----

  const { data: models = [] } = useQuery({
    queryKey: ['musicModels'],
    queryFn: async () => {
      const { getMusicModelsFn } = await import('../../../server/music.server')
      return getMusicModelsFn()
    },
    staleTime: Infinity,
  })

  const { data: tracks = [] } = useQuery({
    queryKey: ['music', 'tracks'],
    queryFn: async () => {
      const { listUserMusicFn } = await import('../../../server/music.server')
      return listUserMusicFn({ data: { limit: 100 } })
    },
  })

  // Jobs still rendering — polled so the lab keeps showing them after a reload
  const { data: pending = [] } = useQuery({
    queryKey: ['music', 'pending'],
    queryFn: async () => {
      const { getPendingMusicJobsFn } =
        await import('../../../server/music.server')
      return getPendingMusicJobsFn()
    },
    refetchInterval: JOB_POLL_INTERVAL,
  })

  // Poll each in-flight job; a completed one refreshes the library
  useEffect(() => {
    if (pending.length === 0) return
    let cancelled = false

    const poll = async () => {
      const { getMusicJobStatusFn } =
        await import('../../../server/music.server')
      for (const job of pending) {
        try {
          const status = await getMusicJobStatusFn({
            data: { jobId: job.jobId },
          })
          if (cancelled) return
          if (status.status === 'completed') {
            toast.success('Track ready')
            queryClient.invalidateQueries({ queryKey: ['music'] })
          } else if (status.status === 'failed') {
            toast.error(status.error || 'Music generation failed')
            queryClient.invalidateQueries({ queryKey: ['music'] })
          }
        } catch {
          // a failed poll is not worth a toast — the next tick tries again
        }
      }
    }

    const timer = setInterval(poll, JOB_POLL_INTERVAL)
    void poll()
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [pending, queryClient])

  // ---- actions ----

  const generate = useMutation({
    mutationFn: async (values: MusicFormValues) => {
      const { generateMusicFn } = await import('../../../server/music.server')
      return generateMusicFn({ data: values })
    },
    onSuccess: () => {
      toast.success('Writing your track…')
      queryClient.invalidateQueries({ queryKey: ['music'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to start generation',
      )
    },
  })

  const remove = useMutation({
    mutationFn: async (trackId: string) => {
      const { deleteMusicFn } = await import('../../../server/music.server')
      return deleteMusicFn({ data: { trackId } })
    },
    onSuccess: () => {
      toast.success('Track deleted')
      setSelectedId(null)
      queryClient.invalidateQueries({ queryKey: ['music'] })
    },
    onError: () => toast.error('Failed to delete track'),
  })

  const selected = useMemo(
    () => tracks.find((t) => t.id === selectedId),
    [tracks, selectedId],
  )
  const playingTrack = useMemo(
    () => tracks.find((t) => t.id === playingId),
    [tracks, playingId],
  )

  const togglePlay = (track: MusicTrack) => {
    setSelectedId(track.id)
    if (playingId === track.id) {
      setPlaying((p) => !p)
      return
    }
    setPlayingId(track.id)
    setPlaying(true)
  }

  const step = (delta: -1 | 1) => {
    if (!playingTrack) return
    const index = tracks.findIndex((t) => t.id === playingTrack.id)
    const next = tracks[index + delta]
    if (!next) return
    setPlayingId(next.id)
    setSelectedId(next.id)
    setPlaying(true)
  }

  const download = async (track: MusicTrack) => {
    setDownloadingId(track.id)
    await downloadFile(track.url, generateFilename(track.url, 'track'), {
      onComplete: () => toast.success('Downloaded'),
      onError: () => toast.error('Download failed'),
    })
    setDownloadingId(null)
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex min-h-0 flex-1">
        <CreatePanel
          models={models}
          busy={generate.isPending}
          onGenerate={(values) => generate.mutate(values)}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h1 className="text-sm font-semibold">Music</h1>
              <p className="text-xs text-muted-foreground">
                {tracks.length} track{tracks.length === 1 ? '' : 's'}
                {pending.length > 0 && ` · ${pending.length} generating`}
              </p>
            </div>
          </header>

          <TrackList
            tracks={tracks}
            pending={pending}
            selectedId={selectedId}
            playingId={playing ? playingId : null}
            onSelect={(track) => setSelectedId(track.id)}
            onTogglePlay={togglePlay}
          />
        </main>

        <TrackInspector
          track={selected}
          downloading={downloadingId === selected?.id}
          onDownload={(track) => void download(track)}
          onDelete={(track) => setDeleteTarget(track)}
        />
      </div>

      <PlayerBar
        track={playingTrack}
        playing={playing}
        onPlayingChange={setPlaying}
        onStep={step}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this track?"
        description="The audio file stays in storage, but the track is removed from your library and from any timeline that uses it."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
