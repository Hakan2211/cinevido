/**
 * Layer sets — an image split by Seedream 5.5 Layerize into a base image plus
 * cut-out PNG layers, each with a position, stacking order and a name.
 *
 * A layer set is stored on one image Asset: `storageUrl` is the base image
 * (z = 0) and `metadata.layerSet` holds every layer. Moving / hiding layers is
 * client state until "Save as image" bakes it on the server (sharp).
 *
 * Shared by client and server — no server-only imports.
 */

import { estimateCost } from './pricing'
import type { CostEstimate } from './pricing'
import { LAYERIZE_MODELS } from '@/server/services/types'
import { addClip, tracksOfKind, trackEndFrame } from '../remotion/types'
import type {
  CameraKey,
  LayerTextProps,
  ManifestClip,
  ProjectManifest,
} from '../remotion/types'

/** [left, top, right, bottom] */
export type Box = [number, number, number, number]

export interface TextRun {
  text: string
  style?: {
    similar_font_family?: string
    foreground_color?: string
    bold?: boolean
    italic?: boolean
  }
}

export interface LayerText {
  text: string
  lines?: Array<{ runs?: Array<TextRun> }>
}

export interface Layer {
  url: string
  /** stacking order, bottom to top; the base is 0 */
  z: number
  /** position in the base image, pixels — absent on the base */
  box?: Box
  name?: string
  description?: string
  text?: LayerText
  /** set when the layer was replaced by an edit: what fal returned first */
  originalUrl?: string
  /**
   * Editable text drawn in place of the layer's pixels (a text layer the user
   * made editable). Shown in the viewer, baked by "Save as image", and sent
   * to the timeline as a LayerText clip.
   */
  live?: LayerTextProps
  width?: number
  height?: number
}

export interface LayerSet {
  /** base image size: the canvas every box is measured in */
  width: number
  height: number
  layers: Array<Layer>
  sourceAssetId?: string
  /** the arrangement last saved with "Save as image", by z */
  views?: Record<string, LayerView>
}

/** Per-layer view state: hidden, or moved by (dx, dy) base pixels */
export interface LayerView {
  visible: boolean
  dx: number
  dy: number
}

/** `Asset.model` of an image baked from a layer set (no fal cost) */
export const LAYER_COMPOSITE_MODEL = 'cinevido/layer-composite'

/** Layer choices offered in the lab (fal's own default is 30 incl. base) */
export const LAYER_COUNTS = [4, 8, 16, 30] as const
export const DEFAULT_LAYER_COUNT = 8

const model = () => LAYERIZE_MODELS[0]

/**
 * What a layerize run costs: every output (base + layers) at the rate the
 * base image's size sets, plus the input fee once. With `auto` sizing the base
 * follows the source, so the source size picks the rate; unknown → 2K rate.
 */
export function layerizeCost(input: {
  outputs: number
  width?: number
  height?: number
}): CostEstimate | null {
  const m = model()
  const each = estimateCost(m.pricing, {
    width: input.width,
    height: input.height,
    numImages: Math.max(1, input.outputs),
  })
  if (!each) return null
  return { min: each.min + m.inputFeeUsd, max: each.max + m.inputFeeUsd }
}

/** Before the run the layer count is unknown: the ceiling is every slot used */
export function layerizeCeiling(input: {
  maxLayers: number
  width?: number
  height?: number
}): CostEstimate | null {
  const top = layerizeCost({ ...input, outputs: input.maxLayers + 1 })
  // the fewest outputs is the base plus one layer
  const low = layerizeCost({ ...input, outputs: 2 })
  return top && low ? { min: low.min, max: top.max } : null
}

/** Read a layer set off an asset's parsed metadata (null if it isn't one) */
export function layerSetOf(metadata: unknown): LayerSet | null {
  const set = (metadata as { layerSet?: LayerSet } | null)?.layerSet
  if (!set || !Array.isArray(set.layers) || !set.width || !set.height) {
    return null
  }
  return set
}

/** Layers bottom to top */
export function sortedLayers(set: LayerSet): Array<Layer> {
  return [...set.layers].sort((a, b) => a.z - b.z)
}

/** Where a layer sits, in percent of the base — for CSS stacking */
export function layerRect(
  set: LayerSet,
  layer: Layer,
  view?: LayerView,
): { left: number; top: number; width: number; height: number } {
  const [l, t, r, b] = layer.box ?? [0, 0, set.width, set.height]
  const dx = view?.dx ?? 0
  const dy = view?.dy ?? 0
  return {
    left: ((l + dx) / set.width) * 100,
    top: ((t + dy) / set.height) * 100,
    width: ((r - l) / set.width) * 100,
    height: ((b - t) / set.height) * 100,
  }
}

/**
 * Where a layer lands on the canvas after a move, clipped to it: the overlay
 * size, its offset, and the part of the overlay to keep. Null if it's off the
 * canvas entirely. Used by the server composite (sharp needs in-bounds overlays).
 */
export function placeOnCanvas(
  canvas: { width: number; height: number },
  box: Box,
  dx: number,
  dy: number,
): {
  width: number
  height: number
  left: number
  top: number
  crop: { left: number; top: number; width: number; height: number }
} | null {
  const width = Math.max(1, Math.round(box[2] - box[0]))
  const height = Math.max(1, Math.round(box[3] - box[1]))
  const x = Math.round(box[0] + dx)
  const y = Math.round(box[1] + dy)
  const left = Math.max(0, x)
  const top = Math.max(0, y)
  const right = Math.min(canvas.width, x + width)
  const bottom = Math.min(canvas.height, y + height)
  if (right <= left || bottom <= top) return null
  return {
    width,
    height,
    left,
    top,
    crop: {
      left: left - x,
      top: top - y,
      width: right - left,
      height: bottom - top,
    },
  }
}

// =============================================================================
// Text layers
// =============================================================================

/** fal's recognised text as editable text: lines, first styled run's look */
export function liveTextFromLayer(layer: Layer): LayerTextProps | null {
  const t = layer.text
  if (!t?.text?.trim()) return null
  const lines =
    t.lines
      ?.map((line) => (line.runs ?? []).map((r) => r.text).join(''))
      .filter((line) => line.trim()) ?? []
  const style = t.lines
    ?.flatMap((line) => line.runs ?? [])
    .find((r) => r.style)?.style
  return {
    text: lines.length > 0 ? lines.join('\n') : t.text.trim(),
    color: style?.foreground_color,
    fontFamily: style?.similar_font_family,
    bold: style?.bold,
    italic: style?.italic,
  }
}

/** What "Replace text" asks the layer edit model for */
export function replaceTextPrompt(oldText: string, newText: string): string {
  const from = oldText.replace(/\s+/g, ' ').trim()
  const to = newText.replace(/\s+/g, ' ').trim()
  return `Replace the text "${from}" with "${to}". Keep exactly the same typeface, weight, colour, size, letter spacing and effects, in the same place. Change nothing else and keep the background transparent.`
}

// =============================================================================
// Layers → timeline (2.5D parallax)
// =============================================================================

export type CameraMove =
  | 'push-in'
  | 'pull-out'
  | 'pan-left'
  | 'pan-right'
  | 'still'

export const CAMERA_MOVES: ReadonlyArray<{ id: CameraMove; label: string }> = [
  { id: 'push-in', label: 'Push in' },
  { id: 'pull-out', label: 'Pull out' },
  { id: 'pan-left', label: 'Pan left' },
  { id: 'pan-right', label: 'Pan right' },
  { id: 'still', label: 'Still' },
]

const round4 = (n: number) => Math.round(n * 10_000) / 10_000

/**
 * The camera for one layer: nearer layers (depth → 1) move and zoom more
 * than the base (depth 0), which is what reads as depth. The base always
 * stays zoomed enough to cover the frame while it moves.
 */
export function parallaxCamera(
  move: CameraMove,
  depth: number,
): { from: CameraKey; to: CameraKey } {
  const d = Math.min(1, Math.max(0, depth))
  const key = (x: number, scale: number): CameraKey => ({
    x: round4(x),
    y: 0,
    scale: round4(scale),
  })
  switch (move) {
    case 'push-in':
      return { from: key(0, 1.02), to: key(0, 1.06 + 0.14 * d) }
    case 'pull-out':
      return { from: key(0, 1.06 + 0.14 * d), to: key(0, 1.02) }
    case 'pan-left':
    case 'pan-right': {
      // the camera pans left → the picture slides right, the front most
      const sign = move === 'pan-left' ? 1 : -1
      const x = 0.015 + 0.05 * d
      const scale = 1.08 + 0.04 * d
      return { from: key(-sign * x, scale), to: key(sign * x, scale) }
    }
    case 'still':
    default:
      return { from: key(0, 1), to: key(0, 1) }
  }
}

/** Where the cut currently ends on the picture lanes */
export function pictureEndFrame(manifest: ProjectManifest): number {
  return [
    ...tracksOfKind(manifest, 'video'),
    ...tracksOfKind(manifest, 'component'),
  ].reduce((max, t) => Math.max(max, trackEndFrame(t)), 0)
}

/**
 * Stack a layer set on the timeline as one shot: every visible layer on its
 * own video lane (V1 = base, V2…), live text on the overlay lanes, all
 * starting together at the end of the cut, each with its parallax camera.
 * Moved layers keep their new place. Returns the manifest and clip ids.
 */
export function addLayerSetToManifest(
  manifest: ProjectManifest,
  set: LayerSet,
  opts: {
    durationFrames: number
    move: CameraMove
    startFrame?: number
    assetId?: string
    label?: string
  },
): { manifest: ProjectManifest; clipIds: Array<string>; startFrame: number } {
  const views = set.views ?? {}
  const visible = sortedLayers(set).filter(
    (l) => views[String(l.z)]?.visible ?? true,
  )
  if (visible.length === 0) throw new Error('Show at least one layer')

  const start = Math.max(
    0,
    Math.round(opts.startFrame ?? pictureEndFrame(manifest)),
  )
  const duration = Math.max(1, Math.round(opts.durationFrames))
  const canvas = { width: set.width, height: set.height }
  let next = manifest
  const clipIds: Array<string> = []
  let videoLane = 0
  let textLane = 0

  visible.forEach((layer, rank) => {
    const view = views[String(layer.z)]
    const [l, t, r, b] = layer.box ?? [0, 0, set.width, set.height]
    const dx = view?.dx ?? 0
    const dy = view?.dy ?? 0
    const depth = visible.length > 1 ? rank / (visible.length - 1) : 0
    const name = layer.z === 0 ? 'Base' : (layer.name ?? `Layer ${layer.z}`)
    const base: Omit<ManifestClip, 'id' | 'kind'> = {
      label: `${opts.label ? `${opts.label} · ` : ''}${name}`.slice(0, 80),
      startFrame: start,
      durationFrames: duration,
      sourceInFrame: 0,
      transitionFrames: 0,
      gain: 1,
      placement: {
        canvas,
        box: [l + dx, t + dy, r + dx, b + dy],
        ...parallaxCamera(opts.move, depth),
      },
    }
    const placed = layer.live
      ? addClip(
          next,
          'component',
          {
            ...base,
            kind: 'component',
            component: 'LayerText',
            props: { ...layer.live },
          },
          textLane++,
        )
      : addClip(
          next,
          'video',
          { ...base, kind: 'image', url: layer.url, assetId: opts.assetId },
          videoLane++,
        )
    next = placed.manifest
    clipIds.push(placed.clip.id)
  })
  return { manifest: next, clipIds, startFrame: start }
}
