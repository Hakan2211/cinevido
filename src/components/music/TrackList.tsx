/**
 * The results column of the Audio lab: every track (or voice clip, or sound
 * effect) the user has made, newest first, with the jobs still rendering shown
 * in place rather than in a separate queue — a track being written is still a
 * track.
 */

import { Loader2, Music, Pause, Play } from 'lucide-react'
import { TrackWaveform } from './TrackWaveform'
import { KIND } from '../studio/timeline/shared'
import type { AudioTab } from './panel-tabs'

/** the timeline lane each tab's clips land on — rows use the lane's colour */
export const LANE_FOR_TAB = {
  music: 'music',
  voice: 'voice',
  sfx: 'sfx',
} as const

/** "fal-ai/ace-step" -> "ace-step"; the vendor prefix is noise in a list */
const engineName = (model: string | null) =>
  model?.split('/').pop() ?? 'unknown'

export interface MusicTrack {
  id: string
  url: string
  filename: string
  title: string
  prompt: string | null
  model: string | null
  lyrics: string | null
  instrumental: boolean
  /** the seed the engine reported, when it reports one */
  seed: number | null
  durationSeconds: number | null
  projectId: string | null
  createdAt: Date | string
  /** voice clips: the ElevenLabs voice */
  voice?: string | null
  /** sound effects: rendered as a seamless loop */
  loop?: boolean
}

export interface PendingTrack {
  jobId: string
  status: string
  progress: number
  model: string
  title: string | null
  prompt: string
  durationSec: number | null
  createdAt: Date | string
}

interface TrackListProps {
  kind: AudioTab
  /** the estimated cost of a row, e.g. "$0.12" */
  costOf?: (track: MusicTrack) => string | null
  emptyText: string
  tracks: Array<MusicTrack>
  pending: Array<PendingTrack>
  selectedId: string | null
  playingId: string | null
  onSelect: (track: MusicTrack) => void
  onTogglePlay: (track: MusicTrack) => void
}

const fmt = (sec: number | null) =>
  sec == null
    ? '—'
    : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

export function TrackList({
  kind,
  costOf,
  emptyText,
  tracks,
  pending,
  selectedId,
  playingId,
  onSelect,
  onTogglePlay,
}: TrackListProps) {
  if (tracks.length === 0 && pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-28 text-center">
        <Music className="h-10 w-10 text-muted-foreground/50" />
        <p className="mt-5 max-w-sm text-sm text-muted-foreground">
          {emptyText}
        </p>
      </div>
    )
  }

  const waveColor = KIND[LANE_FOR_TAB[kind]].wave
  return (
    <div>
      <div className="flex flex-col gap-2">
        {/*
          A job in flight is still a track, so it keeps the row shape: the
          waveform's place is held by an indeterminate bar rather than the row
          jumping when the real thing arrives.
        */}
        {pending.map((job) => (
          <div
            key={job.jobId}
            className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
            <div className="w-40 shrink-0">
              <p className="truncate text-sm font-medium">
                {job.title || 'Generating…'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {engineName(job.model)} · Rendering
              </p>
            </div>
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-primary/10">
              <div className="h-full w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
            </div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {fmt(job.durationSec)}
            </span>
          </div>
        ))}

        {tracks.map((track) => {
          const active = track.id === selectedId
          const playing = track.id === playingId
          const cost = costOf?.(track)
          const sub =
            kind === 'voice' && track.voice
              ? track.voice
              : kind === 'sfx' && track.loop
                ? 'loop'
                : engineName(track.model)
          return (
            <div
              key={track.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(track)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSelect(track)
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                active
                  ? 'border-primary/60 bg-primary/[0.06]'
                  : 'border-border hover:bg-accent/40'
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onTogglePlay(track)
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                title={playing ? 'Pause' : 'Play'}
              >
                {playing ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>

              <div className="w-40 shrink-0">
                <p className="truncate text-sm font-medium">{track.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {fmt(track.durationSeconds)} · {sub}
                </p>
              </div>

              <TrackWaveform
                url={track.url}
                color={waveColor}
                height={30}
                className="min-w-0 flex-1"
              />

              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {cost ?? fmt(track.durationSeconds)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
