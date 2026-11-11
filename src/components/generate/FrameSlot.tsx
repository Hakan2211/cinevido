/**
 * FrameSlot — an image input in a lab panel: start/end frames, edit
 * references, the image to upscale. Empty it's a dashed "+ label" button;
 * filled it shows the image with Change / remove on hover.
 */

import { Plus, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SlotImage {
  id: string
  url: string
  prompt: string | null
  /** Library metadata — width/height feed cost estimates */
  metadata?: { width?: number; height?: number } | null
}

export function FrameSlot({
  image,
  label,
  optional,
  aspect = 'video',
  badge,
  onPick,
  onClear,
}: {
  image: SlotImage | null
  label: string
  optional?: boolean
  aspect?: 'video' | 'square'
  /** Shown top-left on a filled slot (e.g. the reference number) */
  badge?: React.ReactNode
  onPick: () => void
  onClear: () => void
}) {
  const aspectClass = aspect === 'square' ? 'aspect-square' : 'aspect-video'
  if (!image) {
    return (
      <button
        type="button"
        onClick={onPick}
        className={cn(
          aspectClass,
          'flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:bg-accent/40 hover:text-foreground',
        )}
      >
        <Plus className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
        {optional && <span className="text-[10px]">optional</span>}
      </button>
    )
  }
  return (
    <div
      className={cn(
        aspectClass,
        'group relative overflow-hidden rounded-xl border border-border',
      )}
    >
      <img src={image.url} alt={label} className="h-full w-full object-cover" />
      {badge !== undefined ? (
        <span className="absolute top-1.5 left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/70 px-1 text-[10px] font-semibold text-white tabular-nums">
          {badge}
        </span>
      ) : (
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {label}
        </span>
      )}
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={onPick}
          className="rounded-md bg-white/15 px-2 py-1 text-xs font-medium text-white hover:bg-white/25"
        >
          Change
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md bg-white/15 p-1 text-white hover:bg-white/25"
          aria-label={`Remove ${label.toLowerCase()}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/** The big empty "Upload or choose an image" target. */
export function EmptyImageDrop({
  onPick,
  title = 'Upload or choose an image',
  hint = 'JPG, PNG · or pick from your library',
}: {
  onPick: () => void
  title?: string
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-center transition-colors hover:border-muted-foreground/60 hover:bg-accent/40"
    >
      <Upload className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-medium">{title}</span>
      <span className="text-[10px] text-muted-foreground">{hint}</span>
    </button>
  )
}
