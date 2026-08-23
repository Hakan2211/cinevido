/**
 * The right column of the editor. With a clip selected it shows what that clip
 * actually is — its slice of the source, where it sits, how loud it plays and
 * the fade it comes in on. With nothing selected it shows the sequence itself.
 *
 * Deliberately NOT a compositing inspector: the render is a cuts-first
 * composition, so position/scale/rotation knobs would be wired to nothing.
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { GAIN_MAX, GAIN_MAX_DB, KIND, formatGainDb } from './shared'
import {
  clipCount,
  clipHasAudio,
  formatDuration,
  formatTimecode,
  parseTimecode,
  sequenceEndFrame,
} from '../../../remotion/types'
import type {
  ManifestClip,
  ManifestTrack,
  ProjectManifest,
} from '../../../remotion/types'

interface InspectorProps {
  manifest: ProjectManifest
  fps: number
  clip?: ManifestClip
  track?: ManifestTrack
  onPatchClip: (patch: Partial<ManifestClip>) => void
  onDeleteClip: () => void
}

export function Inspector({
  manifest,
  fps,
  clip,
  track,
  onPatchClip,
  onDeleteClip,
}: InspectorProps) {
  const end = sequenceEndFrame(manifest)
  const hours = end >= fps * 3600

  if (!clip || !track) {
    return (
      <aside className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-l p-3">
        <Label>Sequence</Label>
        <Row label="Duration" value={formatTimecode(end, fps, hours)} />
        <Row label="Clips" value={String(clipCount(manifest))} />
        <Row label="Lanes" value={String(manifest.tracks.length)} />
        <Row label="Frame rate" value={`${fps} fps`} />
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Select a clip to trim it, set its crossfade or change its level.
        </p>
        <Label>Keys</Label>
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          <li>
            <Key>space</Key> play · <Key>←</Key>/<Key>→</Key> step frame
          </li>
          <li>
            <Key>shift</Key>+<Key>←</Key>/<Key>→</Key> step second
          </li>
          <li>
            <Key>,</Key>/<Key>.</Key> previous / next cut
          </li>
          <li>
            <Key>s</Key> razor · <Key>d</Key> duplicate · <Key>del</Key> delete
          </li>
          <li>
            <Key>+</Key>/<Key>-</Key> zoom · <Key>f</Key> fit
          </li>
        </ul>
      </aside>
    )
  }

  const kind = KIND[track.kind]
  const sourceOut = clip.sourceInFrame + clip.durationFrames

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-l p-3">
      <div className="flex items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ background: `${kind.accent}33`, color: kind.accent }}
        >
          {kind.label}
        </span>
        <span className="truncate text-sm font-medium">
          {clip.label || clip.component || clip.kind}
        </span>
      </div>

      <TimecodeField
        label="Source in"
        frame={clip.sourceInFrame}
        fps={fps}
        hours={hours}
        disabled={clip.kind === 'component'}
        min={0}
        onCommit={(v) => onPatchClip({ sourceInFrame: Math.max(0, v) })}
      />
      <TimecodeField
        label="Source out"
        frame={sourceOut}
        fps={fps}
        hours={hours}
        disabled={clip.kind === 'component'}
        min={clip.sourceInFrame + 1}
        onCommit={(v) =>
          onPatchClip({
            durationFrames: Math.max(1, v - clip.sourceInFrame),
          })
        }
      />
      <TimecodeField
        label="Start"
        frame={clip.startFrame}
        fps={fps}
        hours={hours}
        min={0}
        onCommit={(v) => onPatchClip({ startFrame: Math.max(0, v) })}
      />
      <TimecodeField
        label="Crossfade"
        frame={clip.transitionFrames}
        fps={fps}
        hours={hours}
        min={0}
        max={Math.max(0, clip.durationFrames - 1)}
        onCommit={(v) =>
          onPatchClip({
            transitionFrames: Math.max(0, Math.min(clip.durationFrames - 1, v)),
          })
        }
      />

      {clipHasAudio(clip) && (
        <GainField
          gain={clip.gain}
          onChange={(v) => onPatchClip({ gain: v })}
        />
      )}

      <div className="mt-1 border-t pt-2 text-[11px] text-muted-foreground">
        <div className="flex justify-between">
          <span>Length</span>
          <span className="tabular-nums">
            {formatDuration(clip.durationFrames, fps)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Ends</span>
          <span className="tabular-nums">
            {formatTimecode(clip.startFrame + clip.durationFrames, fps, hours)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onDeleteClip}
        className="mt-auto flex items-center justify-center gap-2 rounded border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete clip
      </button>
    </aside>
  )
}

// =============================================================================
// Bits
// =============================================================================

/**
 * A timecode you can type into, with a nudge stepper.
 *
 * The text is local state while focused so a half-typed value never rewrites
 * the clip; it commits on blur or Enter, and an unreadable entry silently
 * reverts rather than snapping the clip to zero. Arrow keys nudge by a frame.
 */
function TimecodeField({
  label,
  frame,
  fps,
  hours,
  min = 0,
  max,
  disabled,
  onCommit,
}: {
  label: string
  frame: number
  fps: number
  hours: boolean
  min?: number
  max?: number
  disabled?: boolean
  onCommit: (frame: number) => void
}) {
  const shown = formatTimecode(frame, fps, hours)
  const [draft, setDraft] = useState<string | null>(null)

  const clamp = (v: number) =>
    Math.max(min, max === undefined ? v : Math.min(max, v))

  const commit = (text: string) => {
    const parsed = parseTimecode(text, fps)
    setDraft(null)
    if (parsed !== null && clamp(parsed) !== frame) onCommit(clamp(parsed))
  }

  const nudge = (delta: number) => {
    const next = clamp(frame + delta)
    if (next !== frame) onCommit(next)
  }

  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center">
        <input
          value={draft ?? shown}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setDraft(null)
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              nudge(1)
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              nudge(-1)
            }
          }}
          className="w-[92px] rounded-l border border-r-0 bg-background px-1.5 py-1 text-right font-mono text-[11px] tabular-nums disabled:opacity-40"
        />
        <span className="flex flex-col rounded-r border">
          <button
            type="button"
            disabled={disabled}
            onClick={() => nudge(1)}
            className="flex h-3 w-4 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
            title={`${label} +1 frame`}
          >
            <ChevronUp className="h-2.5 w-2.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => nudge(-1)}
            className="flex h-3 w-4 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
            title={`${label} -1 frame`}
          >
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        </span>
      </span>
    </label>
  )
}

/** The level fader, in decibels, with the scale drawn under it. */
function GainField({
  gain,
  onChange,
}: {
  gain: number
  onChange: (gain: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Gain</span>
        <span className="font-mono tabular-nums text-primary">
          {formatGainDb(gain)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={GAIN_MAX}
        step={0.01}
        value={gain}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full accent-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>-∞</span>
        <span>0 dB</span>
        <span>+{GAIN_MAX_DB} dB</span>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </div>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
      {children}
    </kbd>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
