/**
 * The right column: what the selected track actually is — the words it sings,
 * the engine that wrote it, and the two things you do with a finished track
 * (download it, or throw it away).
 */

import { useState } from 'react'
import { ChevronDown, Download, Loader2, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { TrackWaveform } from './TrackWaveform'
import { KIND } from '../studio/timeline/shared'
import type { MusicTrack } from './TrackList'

interface TrackInspectorProps {
  track?: MusicTrack
  downloading: boolean
  onDownload: (track: MusicTrack) => void
  onDelete: (track: MusicTrack) => void
}

export function TrackInspector({
  track,
  downloading,
  onDownload,
  onDelete,
}: TrackInspectorProps) {
  if (!track) {
    return (
      <aside className="hidden w-72 shrink-0 flex-col gap-3 border-l p-4 xl:flex">
        <Label>Track</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Select a track to see its prompt, its lyrics and the engine that wrote
          it.
        </p>
      </aside>
    )
  }

  const engine = track.model?.split('/').pop() ?? '—'
  const hasLyrics = !!track.lyrics && track.lyrics !== '[inst]'

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l p-4 xl:flex">
      <div>
        <h3 className="text-sm font-semibold break-words">{track.title}</h3>
        <p className="text-xs text-muted-foreground">
          {engine} · {fmtLength(track.durationSeconds)}
        </p>
      </div>

      <TrackWaveform
        url={track.url}
        color={KIND.music.wave}
        height={72}
        className="w-full"
      />

      <div className="flex flex-col gap-1.5 border-t pt-3">
        <Row label="Engine" value={engine} />
        <Row label="Length" value={fmtLength(track.durationSeconds)} />
        <Row
          label="Arrangement"
          value={track.instrumental ? 'Instrumental' : 'Vocals'}
        />
        <Row
          label="Seed"
          value={track.seed == null ? '—' : String(track.seed)}
        />
        <Row
          label="Created"
          value={new Date(track.createdAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        />
      </div>

      {track.prompt && (
        <Collapsible label="Prompt" defaultOpen={!hasLyrics}>
          <p className="text-xs leading-relaxed break-words text-muted-foreground">
            {track.prompt}
          </p>
        </Collapsible>
      )}

      {hasLyrics && (
        <Collapsible label="Lyrics" defaultOpen>
          <pre className="max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {track.lyrics}
          </pre>
        </Collapsible>
      )}

      <div className="mt-auto flex gap-2 pt-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onDownload(track)}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-2 h-3.5 w-3.5" />
          )}
          Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(track)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </aside>
  )
}

/** A section that can be folded away — lyrics get long. */
function Collapsible({
  label,
  defaultOpen,
  children,
}: {
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="border-t pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-[10px] font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground"
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}

const fmtLength = (sec: number | null) =>
  sec == null
    ? 'unknown'
    : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate">{value}</span>
    </div>
  )
}
