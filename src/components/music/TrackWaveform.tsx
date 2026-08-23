/**
 * A track's waveform, drawn as discrete bars.
 *
 * The timeline draws a solid one-pixel-per-column wave because a clip's width
 * is meaningful there — it *is* the duration. In the library nothing is to
 * scale, so bars read better and stay legible at any row height.
 *
 * Peaks come from the same session cache the timeline uses, so a track already
 * sampled on the timeline costs nothing here, and a file the CDN will not serve
 * cross-origin degrades to a flat centre line rather than an error.
 */

import { useEffect, useRef, useState } from 'react'
import { loadPeaks } from '../studio/timeline/frames'

interface TrackWaveformProps {
  url: string
  color: string
  /** css height; the canvas fills its container's width */
  height?: number
  /** 0–1, the portion already played — drawn brighter */
  progress?: number
  className?: string
}

const BAR_W = 2
const GAP = 1

export function TrackWaveform({
  url,
  color,
  height = 28,
  progress,
  className,
}: TrackWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [peaks, setPeaks] = useState<Float32Array | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    let alive = true
    loadPeaks(url).then((p) => {
      if (alive) setPeaks(p)
    })
    return () => {
      alive = false
    }
  }, [url])

  // the row is flexible, so the canvas follows the box rather than a prop
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width < 1) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const mid = height / 2

    // nothing decoded (or nothing to decode): a quiet centre line, not an error
    if (!peaks || peaks.length === 0) {
      ctx.fillStyle = color
      ctx.globalAlpha = 0.25
      ctx.fillRect(0, mid - 0.5, width, 1)
      return
    }

    const step = BAR_W + GAP
    const bars = Math.max(1, Math.floor(width / step))
    const played = progress == null ? -1 : progress * bars

    for (let i = 0; i < bars; i++) {
      // each bar is the loudest peak in the slice it covers, so quiet passages
      // stay quiet instead of being averaged into the same grey mush
      const from = Math.floor((peaks.length * i) / bars)
      const to = Math.max(from + 1, Math.floor((peaks.length * (i + 1)) / bars))
      let max = 0
      for (let j = from; j < to && j < peaks.length; j++) {
        if (peaks[j] > max) max = peaks[j]
      }
      const bar = Math.max(2, max * (height - 2))
      ctx.fillStyle = color
      ctx.globalAlpha = played < 0 || i <= played ? 1 : 0.35
      ctx.fillRect(i * step, mid - bar / 2, BAR_W, bar)
    }
    ctx.globalAlpha = 1
  }, [peaks, width, height, color, progress])

  return (
    <div ref={boxRef} className={className} style={{ height }}>
      <canvas ref={canvasRef} style={{ width: '100%', height }} aria-hidden />
    </div>
  )
}
