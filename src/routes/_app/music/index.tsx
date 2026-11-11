/**
 * Audio Lab — music, voice and sound effects through fal.ai.
 *
 * Same layout as the other labs: the settings panel on the left with tabs
 * Music / Voice / SFX (`?tab=`), results on the right with an inspector, and
 * one transport pinned across the bottom. Finished clips become assets —
 * "music", "audio" (voice) and "sfx" — so each lands on its own timeline lane.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { estimateCost, formatEstimate } from '@/lib/pricing'
import { LabResults, LabShell } from '@/components/generate'
// NOTE: Server functions are dynamically imported in queryFn/mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions
import {
  AUDIO_TABS,
  CreatePanel,
  PlayerBar,
  SfxPanel,
  TrackInspector,
  TrackList,
  VoicePanel,
} from '../../../components/music'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { downloadFile, generateFilename } from '@/lib/download'
import type {
  AudioTab,
  MusicFormValues,
  MusicTrack,
  PendingTrack,
  SfxFormValues,
  VoiceFormValues,
} from '../../../components/music'
import type { PriceRule } from '@/lib/pricing'

export const Route = createFileRoute('/_app/music/')({
  component: AudioLabPage,
  validateSearch: (search: Record<string, unknown>): { tab?: AudioTab } => {
    const tab = search.tab
    return tab === 'voice' || tab === 'sfx' || tab === 'music' ? { tab } : {}
  },
})

const JOB_POLL_INTERVAL = 3000

const EMPTY_TEXT: Record<AudioTab, string> = {
  music:
    'No tracks yet. Describe the music you want on the left — a score for a scene, a bed under a voiceover — and it lands here.',
  voice:
    'No voice clips yet. Paste a script on the left, pick a voice, and the narration lands here — ready for a project’s Voice lane.',
  sfx: 'No sounds yet. Describe a sound on the left — a door slam, rain on a window, a trailer hit — and it lands here.',
}

const RESULTS_TITLE: Record<AudioTab, string> = {
  music: 'Tracks',
  voice: 'Voice clips',
  sfx: 'Sounds',
}

function AudioLabPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { tab = 'music' } = Route.useSearch()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MusicTrack | null>(null)
  /** the voice / SFX request in flight, shown as a pending row */
  const [inFlight, setInFlight] = useState<{
    tab: AudioTab
    row: PendingTrack
  } | null>(null)

  const setTab = (next: AudioTab) => {
    setSelectedId(null)
    navigate({ to: '/music', search: { tab: next }, replace: true })
  }

  // ---- data ----

  const { data: musicModels = [] } = useQuery({
    queryKey: ['musicModels'],
    queryFn: async () => {
      const { getMusicModelsFn } = await import('../../../server/music.server')
      return getMusicModelsFn()
    },
    staleTime: Infinity,
  })

  const { data: audioConfig } = useQuery({
    queryKey: ['audioLabConfig'],
    queryFn: async () => {
      const { getAudioLabConfigFn } =
        await import('../../../server/audio.server')
      return getAudioLabConfigFn()
    },
    staleTime: Infinity,
  })

  const { data: musicTracks = [] } = useQuery({
    queryKey: ['music', 'tracks'],
    queryFn: async () => {
      const { listUserMusicFn } = await import('../../../server/music.server')
      return listUserMusicFn({ data: { limit: 100 } })
    },
    enabled: tab === 'music',
  })

  const { data: audioClips = [] } = useQuery({
    queryKey: ['audioClips', tab],
    queryFn: async () => {
      const { listUserAudioFn } = await import('../../../server/audio.server')
      return listUserAudioFn({
        data: { kind: tab as 'voice' | 'sfx', limit: 100 },
      })
    },
    enabled: tab !== 'music',
  })

  const tracks: Array<MusicTrack> = tab === 'music' ? musicTracks : audioClips

  // Music jobs still rendering — polled so the lab keeps showing them after a reload
  const { data: pendingMusic = [] } = useQuery({
    queryKey: ['music', 'pending'],
    queryFn: async () => {
      const { getPendingMusicJobsFn } =
        await import('../../../server/music.server')
      return getPendingMusicJobsFn()
    },
    refetchInterval: JOB_POLL_INTERVAL,
  })

  // Poll each in-flight music job; a completed one refreshes the library
  useEffect(() => {
    if (pendingMusic.length === 0) return
    let cancelled = false

    const poll = async () => {
      const { getMusicJobStatusFn } =
        await import('../../../server/music.server')
      for (const job of pendingMusic) {
        try {
          const status = await getMusicJobStatusFn({
            data: { jobId: job.jobId },
          })
          if (cancelled) return
          if (status.status === 'completed') {
            toast.success('Track ready')
            queryClient.invalidateQueries({ queryKey: ['music'] })
            queryClient.invalidateQueries({ queryKey: ['falCredits'] })
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
  }, [pendingMusic, queryClient])

  const pending: Array<PendingTrack> =
    tab === 'music' ? pendingMusic : inFlight?.tab === tab ? [inFlight.row] : []

  // ---- pricing ----

  const pricingFor = (modelId: string | null): PriceRule | undefined => {
    if (!modelId) return undefined
    return [
      ...musicModels,
      ...(audioConfig?.ttsModels ?? []),
      ...(audioConfig?.sfxModels ?? []),
    ].find((m) => m.id === modelId)?.pricing
  }

  /** what a finished clip cost, estimated from its model and length/script */
  const costOf = (track: MusicTrack): string | null => {
    const rule = pricingFor(track.model)
    const estimate =
      tab === 'voice'
        ? estimateCost(rule, { chars: track.prompt?.length ?? 0 })
        : track.durationSeconds != null || rule?.kind === 'flat'
          ? estimateCost(rule, { durationSec: track.durationSeconds ?? 0 })
          : null
    return formatEstimate(estimate)?.replace('≈ ', '') ?? null
  }

  // ---- actions ----

  const onAudioDone = (kind: 'voice' | 'sfx', label: string) => {
    toast.success(label)
    setInFlight(null)
    queryClient.invalidateQueries({ queryKey: ['audioClips', kind] })
    queryClient.invalidateQueries({ queryKey: ['falCredits'] })
  }

  const generateMusic = useMutation({
    mutationFn: async (values: MusicFormValues) => {
      const { generateMusicFn } = await import('../../../server/music.server')
      return generateMusicFn({ data: values })
    },
    onSuccess: () => {
      toast.success('Writing your track…')
      queryClient.invalidateQueries({ queryKey: ['music'] })
    },
  })

  const generateVoice = useMutation({
    mutationFn: async (values: VoiceFormValues) => {
      setInFlight({
        tab: 'voice',
        row: {
          jobId: 'voice',
          status: 'processing',
          progress: 0,
          model: values.model,
          title: values.text.slice(0, 60),
          prompt: values.text,
          durationSec: null,
          createdAt: new Date(),
        },
      })
      const { createAudioJobFn } =
        await import('../../../server/generation.server')
      return createAudioJobFn({ data: values })
    },
    onSuccess: () => onAudioDone('voice', 'Voice clip ready'),
    onError: () => setInFlight(null),
  })

  const generateSfx = useMutation({
    mutationFn: async (values: SfxFormValues) => {
      setInFlight({
        tab: 'sfx',
        row: {
          jobId: 'sfx',
          status: 'processing',
          progress: 0,
          model: values.model,
          title: values.prompt.slice(0, 60),
          prompt: values.prompt,
          durationSec: values.durationSec ?? null,
          createdAt: new Date(),
        },
      })
      const { createSfxFn } = await import('../../../server/audio.server')
      return createSfxFn({ data: values })
    },
    onSuccess: () => onAudioDone('sfx', 'Sound ready'),
    onError: () => setInFlight(null),
  })

  const errorOf = (m: { error: unknown }) =>
    m.error
      ? m.error instanceof Error
        ? m.error.message
        : 'Generation failed'
      : null

  const remove = useMutation({
    mutationFn: async (track: MusicTrack) => {
      if (tab === 'music') {
        const { deleteMusicFn } = await import('../../../server/music.server')
        return deleteMusicFn({ data: { trackId: track.id } })
      }
      const { deleteAudioAssetFn } =
        await import('../../../server/audio.server')
      return deleteAudioAssetFn({ data: { assetId: track.id } })
    },
    onSuccess: () => {
      toast.success('Deleted')
      setSelectedId(null)
      queryClient.invalidateQueries({ queryKey: ['music'] })
      queryClient.invalidateQueries({ queryKey: ['audioClips'] })
    },
    onError: () => toast.error('Failed to delete'),
  })

  // ---- playback ----

  const selected = useMemo(
    () => tracks.find((t) => t.id === selectedId),
    [tracks, selectedId],
  )
  // the transport keeps the clip it was playing even if you switch tabs
  const [playingTrack, setPlayingTrack] = useState<MusicTrack | undefined>()

  useEffect(() => {
    if (!playingId) return
    const found = tracks.find((t) => t.id === playingId)
    if (found) setPlayingTrack(found)
  }, [tracks, playingId])

  const togglePlay = (track: MusicTrack) => {
    setSelectedId(track.id)
    if (playingId === track.id) {
      setPlaying((p) => !p)
      return
    }
    setPlayingId(track.id)
    setPlayingTrack(track)
    setPlaying(true)
  }

  const step = (delta: -1 | 1) => {
    if (!playingTrack) return
    const index = tracks.findIndex((t) => t.id === playingTrack.id)
    if (index < 0) return
    const next = tracks[index + delta]
    if (!next) return
    setPlayingId(next.id)
    setPlayingTrack(next)
    setSelectedId(next.id)
    setPlaying(true)
  }

  const download = async (track: MusicTrack) => {
    setDownloadingId(track.id)
    await downloadFile(track.url, generateFilename(track.url, tab), {
      onComplete: () => toast.success('Downloaded'),
      onError: () => toast.error('Download failed'),
    })
    setDownloadingId(null)
  }

  const tabProps = { tabs: AUDIO_TABS, tab, onTabChange: setTab }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <LabShell className="h-auto flex-1">
        {tab === 'music' && (
          <CreatePanel
            {...tabProps}
            models={musicModels}
            busy={generateMusic.isPending}
            error={errorOf(generateMusic)}
            onGenerate={(values) => generateMusic.mutate(values)}
          />
        )}
        {tab === 'voice' && (
          <VoicePanel
            {...tabProps}
            models={audioConfig?.ttsModels ?? []}
            voices={audioConfig?.voices ?? []}
            busy={generateVoice.isPending}
            error={errorOf(generateVoice)}
            onGenerate={(values) => generateVoice.mutate(values)}
          />
        )}
        {tab === 'sfx' && (
          <SfxPanel
            {...tabProps}
            models={audioConfig?.sfxModels ?? []}
            busy={generateSfx.isPending}
            error={errorOf(generateSfx)}
            onGenerate={(values) => generateSfx.mutate(values)}
          />
        )}

        <div className="flex min-h-0 min-w-0 flex-1">
          <LabResults title={RESULTS_TITLE[tab]} count={tracks.length}>
            <TrackList
              kind={tab}
              costOf={costOf}
              emptyText={EMPTY_TEXT[tab]}
              tracks={tracks}
              pending={pending}
              selectedId={selectedId}
              playingId={playing ? playingId : null}
              onSelect={(track) => setSelectedId(track.id)}
              onTogglePlay={togglePlay}
            />
          </LabResults>

          <TrackInspector
            kind={tab}
            cost={selected ? costOf(selected) : null}
            track={selected}
            downloading={downloadingId === selected?.id}
            onDownload={(track) => void download(track)}
            onDelete={(track) => setDeleteTarget(track)}
          />
        </div>
      </LabShell>

      <PlayerBar
        track={playingTrack}
        playing={playing}
        onPlayingChange={setPlaying}
        onStep={step}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this clip?"
        description="The audio file stays in storage, but the clip is removed from your library and from any timeline that uses it."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
