/**
 * One clip on a lane: a filmstrip for picture, a waveform for sound, a label
 * for an overlay — plus the two trim handles and the crossfade wedge.
 *
 * The clip renders what it plays: the filmstrip samples the clip's own slice
 * of the source, so trimming a clip changes the pictures on it.
 */

import { useEffect, useRef, useState } from 'react'
import { PEAKS_PER_SEC, filmstrip, loadPeaks } from './frames'
import { CLIP_H, KIND, TRIM_HANDLE_PX } from './shared'
import { formatDuration } from '../../../remotion/types'
import type { ManifestClip, ManifestTrack } from '../../../remotion/types'

export type DragMode = 'move' | 'trim-start' | 'trim-end'

interface ClipProps {
  clip: ManifestClip
  track: ManifestTrack
  fps: number
  pxPerFrame: number
  selected: boolean
  onPointerDown: (
    e: React.PointerEvent,
    clip: ManifestClip,
    track: ManifestTrack,
    mode: DragMode,
  ) => void
}

export function Clip({
  clip,
  track,
  fps,
  pxPerFrame,
  selected,
  onPointerDown,
}: ClipProps) {
  const width = Math.max(2, clip.durationFrames * pxPerFrame)
  const left = clip.startFrame * pxPerFrame
  const kind = KIND[track.kind]

  const handleDown = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const mode: DragMode =
      x <= TRIM_HANDLE_PX
        ? 'trim-start'
        : x >= rect.width - TRIM_HANDLE_PX
          ? 'trim-end'
          : 'move'
    onPointerDown(e, clip, track, mode)
  }

  return (
    <div
      role="button"
      tabIndex={-1}
      onPointerDown={handleDown}
      className="absolute top-1/2 -translate-y-1/2 overflow-hidden rounded-md border transition-shadow select-none"
      style={{
        left,
        width,
        height: CLIP_H,
        borderColor: selected ? kind.accent : 'rgba(255,255,255,0.14)',
        boxShadow: selected ? `0 0 0 1px ${kind.accent}` : undefined,
        background: `linear-gradient(180deg, ${kind.accent}22, ${kind.accent}11)`,
        cursor: 'grab',
      }}
      title={clip.label || clip.component || clip.kind}
    >
      {/* body */}
      {clip.kind === 'audio' ? (
        <Waveform clip={clip} width={width} color={kind.wave} fps={fps} />
      ) : clip.kind === 'image' ? (
        <ImageBody url={clip.url} />
      ) : clip.kind === 'video' ? (
        <Filmstrip clip={clip} width={width} fps={fps} />
      ) : null}

      {/* crossfade wedge — the fade this clip comes in on */}
      {clip.transitionFrames > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0"
          style={{
            width: clip.transitionFrames * pxPerFrame,
            background: `linear-gradient(90deg, ${kind.accent}00, ${kind.accent}55)`,
          }}
        />
      )}

      {/* label */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-1 px-1.5 py-0.5">
        <span className="truncate text-[10px] font-medium text-white/90 drop-shadow">
          {clip.label || clip.component || clip.kind}
        </span>
        {width > 68 && (
          <span className="shrink-0 text-[9px] tabular-nums text-white/60">
            {formatDuration(clip.durationFrames, fps)}
          </span>
        )}
      </div>

      {/*
        Trim handles. Unselected they are a soft tint of the lane colour — a
        hint that the edge is grabbable. Selected, they become the solid white
        grips an NLE draws, so the clip you are about to trim is unmistakable.
      */}
      <div
        className="absolute inset-y-0 left-0 cursor-ew-resize"
        style={{ width: TRIM_HANDLE_PX, background: `${kind.accent}55` }}
      />
      <div
        className="absolute inset-y-0 right-0 cursor-ew-resize"
        style={{ width: TRIM_HANDLE_PX, background: `${kind.accent}55` }}
      />
      {selected && (
        <>
          <span
            className="pointer-events-none absolute top-1/2 left-[3px] h-3 w-1.5 -translate-y-1/2 rounded-[1px] bg-white shadow"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute top-1/2 right-[3px] h-3 w-1.5 -translate-y-1/2 rounded-[1px] bg-white shadow"
            aria-hidden
          />
        </>
      )}
    </div>
  )
}

// =============================================================================
// Bodies
// =============================================================================

function ImageBody({ url }: { url?: string }) {
  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      className="pointer-events-none h-full w-full object-cover opacity-70"
    />
  )
}

function Filmstrip({
  clip,
  width,
  fps,
}: {
  clip: ManifestClip
  width: number
  fps: number
}) {
  const [frames, setFrames] = useState<Array<string | null>>([])
  const thumbWidth = 64
  const count = Math.max(1, Math.min(12, Math.round(width / thumbWidth)))

  useEffect(() => {
    let alive = true
    if (!clip.url) return
    const startSec = clip.sourceInFrame / fps
    const lengthSec = clip.durationFrames / fps
    filmstrip(clip.url, startSec, lengthSec, count).then((strip) => {
      if (alive) setFrames(strip)
    })
    return () => {
      alive = false
    }
  }, [clip.url, clip.sourceInFrame, clip.durationFrames, count, fps])

  if (frames.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 flex opacity-70">
      {frames.map((src, i) =>
        src ? (
          <img
            key={i}
            src={src}
            alt=""
            className="h-full min-w-0 flex-1 object-cover"
            draggable={false}
          />
        ) : (
          <div key={i} className="h-full min-w-0 flex-1" />
        ),
      )}
    </div>
  )
}

function Waveform({
  clip,
  width,
  color,
  fps,
}: {
  clip: ManifestClip
  width: number
  color: string
  fps: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [peaks, setPeaks] = useState<Float32Array | null>(null)

  useEffect(() => {
    let alive = true
    if (!clip.url) return
    loadPeaks(clip.url).then((p) => {
      if (alive) setPeaks(p)
    })
    return () => {
      alive = false
    }
  }, [clip.url])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !peaks || peaks.length === 0) return

    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(width))
    const h = CLIP_H
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = color

    // the clip shows its own slice of the take, so trimming moves the waveform
    const startPeak = (clip.sourceInFrame / fps) * PEAKS_PER_SEC
    const peakSpan = (clip.durationFrames / fps) * PEAKS_PER_SEC
    const mid = h / 2

    for (let x = 0; x < w; x++) {
      const idx = Math.round(startPeak + (peakSpan * x) / w)
      const v = peaks[Math.min(peaks.length - 1, Math.max(0, idx))] ?? 0
      const bar = Math.max(1, v * (h - 10))
      ctx.fillRect(x, mid - bar / 2, 1, bar)
    }
  }, [peaks, width, color, clip.sourceInFrame, clip.durationFrames, fps])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
