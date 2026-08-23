/**
 * The sequence editor: transport + tools on top, lanes below, clip inspector
 * on the right. Drag to move, edge-drag to trim, razor at the playhead,
 * per-clip crossfade and gain, per-lane mute/gain/lock.
 *
 * Every edit funnels through `apply`, which hands the whole new manifest to
 * the workspace — the workspace owns persistence, this owns the cut.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Magnet, Minus, Plus, Scissors, Trash2 } from 'lucide-react'
import { Tracks } from './Tracks'
import { Inspector } from './Inspector'
import {
  ZOOM_DEFAULT,
  clampZoom,
  cutPoints,
  probeDurationSeconds,
} from './shared'
import {
  addClip,
  appendClip,
  clipKindForAsset,
  findClip,
  formatTimecode,
  mapTrack,
  newId,
  removeClip as removeClipFromManifest,
  sequenceEndFrame,
  splitClipAt,
  trackKindForAsset,
  updateClip,
} from '../../../remotion/types'
import { Button } from '../../ui/button'
import type {
  ManifestClip,
  ManifestTrack,
  ProjectManifest,
} from '../../../remotion/types'

export interface TimelineAsset {
  id: string
  type: string
  url: string
  filename: string
  durationSeconds: number | null
}

interface TimelineProps {
  manifest: ProjectManifest
  fps: number
  currentFrame: number
  selectedClipId: string | null
  onSeek: (frame: number) => void
  onSelectClip: (clipId: string | null) => void
  onManifestChange: (manifest: ProjectManifest) => void
  /** Optional: Called when play/pause is toggled via keyboard */
  onTogglePlay?: () => void
  /** Optional: Is the video currently playing */
  isPlaying?: boolean
  /** Project assets, so a clip dropped from the library knows what it plays */
  assets?: Array<TimelineAsset>
  /** Hide the inspector column (mobile) */
  showInspector?: boolean
}

export function Timeline({
  manifest,
  fps,
  currentFrame,
  selectedClipId,
  onSeek,
  onSelectClip,
  onManifestChange,
  onTogglePlay,
  isPlaying = false,
  assets = [],
  showInspector = true,
}: TimelineProps) {
  const [pxPerSec, setPxPerSec] = useState(ZOOM_DEFAULT)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const fitRef = useRef<() => void>(() => {})

  const end = sequenceEndFrame(manifest)
  const selected = selectedClipId
    ? findClip(manifest, selectedClipId)
    : undefined

  const apply = useCallback(
    (next: ProjectManifest) => onManifestChange(next),
    [onManifestChange],
  )

  // ---- clip ops ----

  const patchClip = useCallback(
    (clipId: string, patch: Partial<ManifestClip>) => {
      apply(updateClip(manifest, clipId, patch))
    },
    [apply, manifest],
  )

  /** move, possibly onto another lane of the same kind */
  const moveClip = useCallback(
    (clipId: string, startFrame: number, trackId: string) => {
      const found = findClip(manifest, clipId)
      if (!found) return

      if (found.track.id === trackId) {
        apply(updateClip(manifest, clipId, { startFrame }))
        return
      }

      const moved: ManifestClip = { ...found.clip, startFrame }
      const without = removeClipFromManifest(manifest, clipId)
      apply(
        mapTrack(without, trackId, (t) => ({
          ...t,
          clips: [...t.clips, moved].sort(
            (a, b) => a.startFrame - b.startFrame,
          ),
        })),
      )
    },
    [apply, manifest],
  )

  const patchTrack = useCallback(
    (trackId: string, patch: Partial<ManifestTrack>) => {
      apply(mapTrack(manifest, trackId, (t) => ({ ...t, ...patch })))
    },
    [apply, manifest],
  )

  const deleteSelected = useCallback(() => {
    if (!selectedClipId) return
    apply(removeClipFromManifest(manifest, selectedClipId))
    onSelectClip(null)
  }, [apply, manifest, onSelectClip, selectedClipId])

  const duplicateSelected = useCallback(() => {
    const found = selectedClipId
      ? findClip(manifest, selectedClipId)
      : undefined
    if (!found) return
    const copy: ManifestClip = {
      ...found.clip,
      id: newId(),
      startFrame: found.clip.startFrame + found.clip.durationFrames,
    }
    apply(
      mapTrack(manifest, found.track.id, (t) => ({
        ...t,
        clips: [...t.clips, copy].sort((a, b) => a.startFrame - b.startFrame),
      })),
    )
    onSelectClip(copy.id)
  }, [apply, manifest, onSelectClip, selectedClipId])

  /**
   * Razor. The selected clip is cut when the playhead is inside it; otherwise
   * every clip the playhead crosses is cut, which is what an editor means by
   * "cut here" with nothing selected.
   */
  const razor = useCallback(() => {
    const selectedSpans =
      selected &&
      currentFrame > selected.clip.startFrame &&
      currentFrame < selected.clip.startFrame + selected.clip.durationFrames

    if (selectedSpans && selected) {
      const { manifest: next, tailId } = splitClipAt(
        manifest,
        selected.clip.id,
        currentFrame,
      )
      apply(next)
      if (tailId) onSelectClip(tailId)
      return
    }

    let next = manifest
    for (const track of manifest.tracks) {
      if (track.locked) continue
      const under = track.clips.find(
        (c) =>
          currentFrame > c.startFrame &&
          currentFrame < c.startFrame + c.durationFrames,
      )
      if (under) next = splitClipAt(next, under.id, currentFrame).manifest
    }
    if (next !== manifest) apply(next)
  }, [apply, currentFrame, manifest, onSelectClip, selected])

  const stepCut = useCallback(
    (dir: -1 | 1) => {
      const points = cutPoints(manifest.tracks)
      const next =
        dir === 1
          ? points.find((p) => p > currentFrame + 0.5)
          : [...points].reverse().find((p) => p < currentFrame - 0.5)
      onSeek(next ?? (dir === 1 ? end : 0))
    },
    [currentFrame, end, manifest.tracks, onSeek],
  )

  // ---- adding assets ----

  const addAsset = useCallback(
    async (assetId: string, trackId?: string, startFrame?: number) => {
      const asset = assets.find((a) => a.id === assetId)
      if (!asset) return

      const seconds =
        asset.durationSeconds ??
        (await probeDurationSeconds(asset.url, clipKindForAsset(asset.type)))
      const durationFrames = Math.max(1, Math.round(seconds * fps))

      const clip = {
        id: newId(),
        kind: clipKindForAsset(asset.type),
        assetId: asset.id,
        url: asset.url,
        label: asset.filename,
        durationFrames,
        sourceInFrame: 0,
        transitionFrames: 0,
        gain: 1,
      }

      if (trackId) {
        const track = manifest.tracks.find((t) => t.id === trackId)
        if (!track) return
        apply(
          mapTrack(manifest, trackId, (t) => ({
            ...t,
            clips: [...t.clips, { ...clip, startFrame: startFrame ?? 0 }].sort(
              (a, b) => a.startFrame - b.startFrame,
            ),
          })),
        )
      } else {
        const kind = trackKindForAsset(asset.type)
        const placed =
          startFrame === undefined
            ? appendClip(manifest, kind, clip)
            : addClip(manifest, kind, { ...clip, startFrame })
        apply(placed.manifest)
      }
      onSelectClip(clip.id)
    },
    [apply, assets, fps, manifest, onSelectClip],
  )

  // ---- keyboard: the transport and the razor, the way an NLE binds them ----

  const keyOps = useRef<Record<string, () => void>>({})
  keyOps.current = useMemo(
    () => ({
      ' ': () => onTogglePlay?.(),
      k: () => onTogglePlay?.(),
      ArrowLeft: () => onSeek(Math.max(0, currentFrame - 1)),
      ArrowRight: () => onSeek(currentFrame + 1),
      Home: () => onSeek(0),
      End: () => onSeek(end),
      ',': () => stepCut(-1),
      '.': () => stepCut(1),
      s: razor,
      d: duplicateSelected,
      Delete: deleteSelected,
      Backspace: deleteSelected,
      '+': () => setPxPerSec((z) => clampZoom(z * 1.4)),
      '=': () => setPxPerSec((z) => clampZoom(z * 1.4)),
      '-': () => setPxPerSec((z) => clampZoom(z / 1.4)),
      f: () => fitRef.current(),
      m: () => {
        if (selected)
          patchTrack(selected.track.id, { muted: !selected.track.muted })
      },
    }),
    [
      currentFrame,
      deleteSelected,
      duplicateSelected,
      end,
      onSeek,
      onTogglePlay,
      patchTrack,
      razor,
      selected,
      stepCut,
    ],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      // shift + arrows steps a second — handled here so the map stays flat
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        onSeek(
          e.key === 'ArrowLeft'
            ? Math.max(0, currentFrame - fps)
            : currentFrame + fps,
        )
        return
      }
      const op = keyOps.current[e.key]
      if (!op) return
      e.preventDefault()
      op()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentFrame, fps, onSeek])

  // ---- render ----

  const hours = end >= fps * 3600

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/*
        Toolbar. No transport here on purpose: play/pause lives in the floating
        pill over the preview, and stepping cut to cut is `,` / `.` (listed in
        the inspector's key map). Two play buttons on one screen is one too many.
      */}
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <Button
          variant={snapEnabled ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={() => setSnapEnabled((v) => !v)}
          title={`Snap: ${snapEnabled ? 'on' : 'off'}`}
        >
          <Magnet className="h-3.5 w-3.5" />
        </Button>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={razor}
          title="Razor at playhead (s)"
        >
          <Scissors className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={duplicateSelected}
          disabled={!selected}
          title="Duplicate clip (d)"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={deleteSelected}
          disabled={!selected}
          title="Delete clip (del)"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPxPerSec((z) => clampZoom(z / 1.4))}
            title="Zoom out (-)"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <input
            type="range"
            min={8}
            max={400}
            step={1}
            value={pxPerSec}
            onChange={(e) => setPxPerSec(clampZoom(Number(e.target.value)))}
            className="h-1 w-24 accent-primary"
            title="Zoom"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPxPerSec((z) => clampZoom(z * 1.4))}
            title="Zoom in (+)"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => fitRef.current()}
            title="Fit sequence (f)"
          >
            Fit
          </Button>

          <div className="mx-0.5 h-5 w-px bg-border" />

          <span className="font-mono text-xs tabular-nums">
            {formatTimecode(currentFrame, fps, hours)}
            <span className="text-muted-foreground">
              {' / '}
              {formatTimecode(end, fps, hours)}
            </span>
          </span>
        </div>
      </div>

      {/* lanes + inspector */}
      <div className="flex min-h-0 flex-1">
        <Tracks
          manifest={manifest}
          fps={fps}
          pxPerSec={pxPerSec}
          playhead={currentFrame}
          playing={isPlaying}
          snapEnabled={snapEnabled}
          selectedClipId={selectedClipId}
          onSeek={onSeek}
          onSelectClip={onSelectClip}
          onMoveClip={moveClip}
          onTrimClip={patchClip}
          onPatchTrack={patchTrack}
          onDropAsset={(assetId, trackId, startFrame) => {
            void addAsset(assetId, trackId, startFrame)
          }}
          fitRef={fitRef}
          onZoomChange={(z) => setPxPerSec(clampZoom(z))}
        />

        {showInspector && (
          <Inspector
            manifest={manifest}
            fps={fps}
            clip={selected?.clip}
            track={selected?.track}
            onPatchClip={(patch) =>
              selectedClipId && patchClip(selectedClipId, patch)
            }
            onDeleteClip={deleteSelected}
          />
        )}
      </div>
    </div>
  )
}
