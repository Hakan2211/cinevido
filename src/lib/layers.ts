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
