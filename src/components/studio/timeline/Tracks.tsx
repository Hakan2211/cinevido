/**
 * The lanes: headers on the left (code, name, mixer), ruler + lanes + playhead
 * on the right. Everything here is geometry off `pxPerSec`, so zoom is the only
 * thing that changes when the sequence gets long.
 *
 * This file owns the pointer math — where a frame is, which lane the cursor is
 * over — and reports edits upward as intentions (move this clip here, trim it
 * to there) rather than manifests.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Lock, LockOpen, Volume2, VolumeX } from 'lucide-react'
import { Clip } from './Clip'
import {
  GAIN_MAX,
  HEADER_W,
  KIND,
  RULER_H,
  TRACK_H,
  formatGainDb,
  rulerLabel,
  snapCandidates,
  snapFrame,
  snapToEdges,
  tickStepSeconds,
} from './shared'
import { trackCode } from '../../../remotion/types'
import type { DragMode } from './Clip'
import type {
  ManifestClip,
  ManifestTrack,
  ProjectManifest,
} from '../../../remotion/types'

interface TracksProps {
  manifest: ProjectManifest
  fps: number
  pxPerSec: number
  playhead: number
  playing: boolean
  snapEnabled: boolean
  selectedClipId: string | null
  onSeek: (frame: number) => void
  onSelectClip: (clipId: string | null) => void
  /** live drag: put this clip at this frame, optionally on another lane */
  onMoveClip: (clipId: string, startFrame: number, trackId: string) => void
  /** live trim: the clip's new window into its source */
  onTrimClip: (clipId: string, patch: Partial<ManifestClip>) => void
  onPatchTrack: (trackId: string, patch: Partial<ManifestTrack>) => void
  /** an asset dropped from the media rail onto a lane */
  onDropAsset: (assetId: string, trackId: string, startFrame: number) => void
  /** the editor hands its "fit to view" up so the F key can reach it */
  fitRef: React.RefObject<() => void>
  onZoomChange: (pxPerSec: number) => void
}

interface DragState {
  mode: DragMode
  clipId: string
  trackId: string
  /** pointer offset into the clip, in frames */
  grabOffset: number
  origin: ManifestClip
}

export function Tracks({
  manifest,
  fps,
  pxPerSec,
  playhead,
  playing,
  snapEnabled,
  selectedClipId,
  onSeek,
  onSelectClip,
  onMoveClip,
  onTrimClip,
  onPatchTrack,
  onDropAsset,
  fitRef,
  onZoomChange,
}: TracksProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lanesRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)

  const pxPerFrame = pxPerSec / fps
  const end = manifest.tracks.reduce(
    (max, t) =>
      Math.max(
        max,
        t.clips.reduce(
          (m, c) => Math.max(m, c.startFrame + c.durationFrames),
          0,
        ),
      ),
    0,
  )
  // always leave a screen of empty sequence to drag into
  const contentFrames = Math.max(end + fps * 10, viewportWidth / pxPerFrame)
  const contentWidth = contentFrames * pxPerFrame

  // ---- viewport ----
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewportWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // "fit": the whole cut, with a little air, across the viewport
  useEffect(() => {
    fitRef.current = () => {
      if (!viewportWidth || end <= 0) return
      onZoomChange((viewportWidth / (end / fps)) * 0.96)
    }
  }, [fitRef, viewportWidth, end, fps, onZoomChange])

  // keep the playhead on screen while the transport runs
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !playing) return
    const x = playhead * pxPerFrame
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 80) {
      el.scrollLeft = Math.max(0, x - el.clientWidth / 2)
    }
  }, [playhead, playing, pxPerFrame])

  // ---- pointer helpers ----
  const frameAt = useCallback(
    (clientX: number) => {
      const el = lanesRef.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      return snapFrame((clientX - rect.left) / pxPerFrame)
    },
    [pxPerFrame],
  )

  /** which lane the pointer is over, clamped to the lane stack */
  const trackAt = useCallback(
    (clientY: number): ManifestTrack | undefined => {
      const el = lanesRef.current
      if (!el) return undefined
      const rect = el.getBoundingClientRect()
      const index = Math.floor((clientY - rect.top) / TRACK_H)
      return manifest.tracks[
        Math.max(0, Math.min(manifest.tracks.length - 1, index))
      ]
    },
    [manifest.tracks],
  )

  const applySnap = useCallback(
    (frame: number, exceptClipId: string | null) =>
      snapEnabled
        ? snapToEdges(
            frame,
            snapCandidates(manifest.tracks, exceptClipId, playhead),
            pxPerFrame,
          )
        : snapFrame(frame),
    [snapEnabled, manifest.tracks, playhead, pxPerFrame],
  )

  // ---- scrubbing the ruler ----
  const scrub = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    onSeek(frameAt(e.clientX))
  }

  const scrubMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1) return
    onSeek(frameAt(e.clientX))
  }

  // ---- dragging clips ----
  const onClipPointerDown = (
    e: React.PointerEvent,
    clip: ManifestClip,
    track: ManifestTrack,
    mode: DragMode,
  ) => {
    if (track.locked) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    onSelectClip(clip.id)
    drag.current = {
      mode,
      clipId: clip.id,
      trackId: track.id,
      grabOffset: frameAt(e.clientX) - clip.startFrame,
      origin: { ...clip },
    }
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = drag.current
      if (!state) return
      const frame = frameAt(e.clientX)

      if (state.mode === 'move') {
        const wanted = applySnap(frame - state.grabOffset, state.clipId)
        const target = trackAt(e.clientY)
        const source = manifest.tracks.find((t) => t.id === state.trackId)
        // a clip only crosses to a lane of its own kind — a voice take has no
        // business landing on the picture track
        const lane =
          target && source && target.kind === source.kind && !target.locked
            ? target
            : source
        if (lane) onMoveClip(state.clipId, Math.max(0, wanted), lane.id)
        return
      }

      const origin = state.origin
      if (state.mode === 'trim-start') {
        const wanted = applySnap(frame, state.clipId)
        const maxStart = origin.startFrame + origin.durationFrames - 1
        const start = Math.max(
          Math.max(0, origin.startFrame - origin.sourceInFrame),
          Math.min(wanted, maxStart),
        )
        const delta = start - origin.startFrame
        onTrimClip(state.clipId, {
          startFrame: start,
          sourceInFrame: Math.max(0, origin.sourceInFrame + delta),
          durationFrames: Math.max(1, origin.durationFrames - delta),
        })
        return
      }

      // trim-end
      const wanted = applySnap(frame, state.clipId)
      onTrimClip(state.clipId, {
        durationFrames: Math.max(1, wanted - origin.startFrame),
      })
    }

    const onUp = () => {
      drag.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [applySnap, frameAt, trackAt, onMoveClip, onTrimClip, manifest.tracks])

  // ---- ruler ticks ----
  const step = tickStepSeconds(pxPerSec)
  const ticks: Array<number> = []
  for (let t = 0; t <= contentFrames / fps; t += step) ticks.push(t)

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto">
      {/* lane headers */}
      <div
        className="shrink-0 border-r bg-muted/30"
        style={{ width: HEADER_W }}
      >
        <div style={{ height: RULER_H }} className="border-b" />
        {manifest.tracks.map((track, i) => (
          <TrackHead
            key={track.id}
            track={track}
            code={trackCode(manifest, i)}
            onPatch={(patch) => onPatchTrack(track.id, patch)}
          />
        ))}
      </div>

      {/* ruler + lanes */}
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
        <div className="relative" style={{ width: contentWidth }}>
          {/* ruler */}
          <div
            className="relative cursor-ew-resize border-b bg-muted/20"
            style={{ height: RULER_H }}
            onPointerDown={scrub}
            onPointerMove={scrubMove}
          >
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 bottom-0 border-l border-border/60"
                style={{ left: t * fps * pxPerFrame }}
              >
                <span className="pl-1 text-[10px] tabular-nums text-muted-foreground">
                  {rulerLabel(t)}
                </span>
              </div>
            ))}
          </div>

          {/* lanes */}
          <div ref={lanesRef} className="relative">
            {manifest.tracks.map((track) => (
              <div
                key={track.id}
                className="relative border-b"
                style={{
                  height: TRACK_H,
                  background: KIND[track.kind].tint,
                }}
                onPointerDown={(e) => {
                  if (e.target !== e.currentTarget) return
                  onSelectClip(null)
                  onSeek(frameAt(e.clientX))
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const assetId = e.dataTransfer.getData('text/asset-id')
                  if (!assetId || track.locked) return
                  onDropAsset(
                    assetId,
                    track.id,
                    applySnap(frameAt(e.clientX), null),
                  )
                }}
              >
                {track.clips.map((clip) => (
                  <Clip
                    key={clip.id}
                    clip={clip}
                    track={track}
                    fps={fps}
                    pxPerFrame={pxPerFrame}
                    selected={clip.id === selectedClipId}
                    onPointerDown={onClipPointerDown}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* playhead */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-primary"
            style={{ left: playhead * pxPerFrame }}
          >
            <div className="absolute -top-0.5 -left-1.5 h-3 w-3 rotate-45 bg-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Lane header — the mixer lives here
// =============================================================================

function TrackHead({
  track,
  code,
  onPatch,
}: {
  track: ManifestTrack
  code: string
  onPatch: (patch: Partial<ManifestTrack>) => void
}) {
  const kind = KIND[track.kind]
  const hasAudio = track.kind !== 'video' && track.kind !== 'component'

  return (
    <div
      className="flex flex-col justify-center gap-1.5 border-b px-2"
      style={{ height: TRACK_H }}
    >
      {/* row 1 — who the lane is */}
      <div className="flex items-center gap-1.5">
        <span
          className="rounded px-1 text-[10px] font-semibold tabular-nums"
          style={{ background: `${kind.accent}33`, color: kind.accent }}
        >
          {code}
        </span>
        <span className="truncate text-xs font-medium">{track.name}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={track.muted ? 'Unmute lane' : 'Mute lane'}
            onClick={() => onPatch({ muted: !track.muted })}
          >
            {track.muted ? (
              <VolumeX className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={track.locked ? 'Unlock lane' : 'Lock lane'}
            onClick={() => onPatch({ locked: !track.locked })}
          >
            {track.locked ? (
              <Lock className="h-3.5 w-3.5 text-primary" />
            ) : (
              <LockOpen className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* row 2 — the fader, in dB, or nothing at all on a silent lane */}
      {hasAudio ? (
        <div className="flex items-center gap-1.5">
          <input
            type="range"
            min={0}
            max={GAIN_MAX}
            step={0.01}
            value={track.gain}
            onChange={(e) => onPatch({ gain: Number(e.target.value) })}
            className="h-1 min-w-0 flex-1 accent-primary disabled:opacity-40"
            disabled={track.muted}
            title={`Lane gain ${formatGainDb(track.gain)}`}
          />
          <span className="w-[52px] shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
            {formatGainDb(track.gain)}
          </span>
        </div>
      ) : (
        <div className="h-4" />
      )}
    </div>
  )
}
