/**
 * The centre column: every track the user has made, newest first, with the
 * jobs still rendering shown as cards in place rather than a separate queue —
 * a track that is being written is still a track.
 */

import { Loader2, Music, Pause, Play } from 'lucide-react'
import { TrackWaveform } from './TrackWaveform'
import { KIND } from '../studio/timeline/shared'

/** the same green the Music lane uses, so a track looks the same in both places */
const WAVE_COLOR = KIND.music.wave

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
  tracks,
  pending,
  selectedId,
  playingId,
  onSelect,
  onTogglePlay,
}: TrackListProps) {
  if (tracks.length === 0 && pending.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Music className="h-10 w-10 text-muted-foreground/40" />
        <p className="max-w-xs text-sm text-muted-foreground">
          No tracks yet. Describe the music you want on the left — a score for a
          scene, a bed under a voiceover — and it lands here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-col gap-2">
        {/*
          A job in flight is still a track, so it keeps the row shape: the
          waveform's place is held by an indeterminate bar rather than the row
          jumping when the real thing arrives.
        */}
        {pending.map((job) => (
          <div
            key={job.jobId}
            className="flex items-center gap-3 rounded-lg border border-dashed p-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
            <div className="w-40 shrink-0">
              <p className="truncate text-sm font-medium">
                {job.title || 'Generating…'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {engineName(job.model)} · Generating
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
          return (
            <div
              key={track.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(track)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSelect(track)
              }}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
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
                  {fmt(track.durationSeconds)} · {engineName(track.model)}
                </p>
              </div>

              <TrackWaveform
                url={track.url}
                color={WAVE_COLOR}
                height={30}
                className="min-w-0 flex-1"
              />

              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {fmt(track.durationSeconds)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
