/**
 * What a video upscale will cost. fal bills these by the OUTPUT:
 *
 *   SeedVR2    $0.001 per megapixel, counted width × height × frames
 *   Topaz      per second by output size (≤720p / ≤1080p / above); 60fps ×2
 *   Bytedance  per second by target size (1080p / 2K / 4K) at 30fps; 60fps ×2
 *
 * The rates live on the models in the catalog (`pricing`); this works out the
 * output size from the source clip (measured in the browser) and the settings.
 * Browsers cannot read a clip's frame rate, so SeedVR is a 24–30fps range.
 */

import type { CostEstimate, PriceRule } from './pricing'

export interface UpscaleSource {
  width: number
  height: number
  durationSec: number
}

export interface UpscaleSettings {
  modelId: string
  /** SeedVR (factor mode) and Topaz */
  factor?: number
  /** SeedVR target mode: output height, e.g. 1080 */
  targetHeight?: number
  /** Bytedance: '1080p' | '2k' | '4k' */
  bytedanceResolution?: string
  /** Topaz target fps / Bytedance '60fps' */
  fps?: number
}

const BYTEDANCE_HEIGHT: Record<string, number> = {
  '1080p': 1080,
  '2k': 1440,
  '4k': 2160,
}

/** Output frame size for these settings */
export function upscaleOutputSize(
  source: UpscaleSource,
  settings: UpscaleSettings,
): { width: number; height: number } {
  const aspect = source.width / source.height
  const isSeedVR = settings.modelId.includes('seedvr')
  const isBytedance = settings.modelId.includes('bytedance')
  const targetHeight = isBytedance
    ? BYTEDANCE_HEIGHT[settings.bytedanceResolution ?? '1080p']
    : isSeedVR
      ? settings.targetHeight
      : undefined
  if (targetHeight) {
    return { width: Math.round(targetHeight * aspect), height: targetHeight }
  }
  const f = settings.factor ?? 2
  return { width: source.width * f, height: source.height * f }
}

export function estimateVideoUpscale(
  rule: PriceRule | undefined,
  source: UpscaleSource | null,
  settings: UpscaleSettings,
): CostEstimate | null {
  if (!rule || !source || source.durationSec <= 0) return null
  const out = upscaleOutputSize(source, settings)
  const seconds = source.durationSec
  const fpsMultiplier = (settings.fps ?? 30) > 30 ? 2 : 1

  if (rule.kind === 'perMegapixel') {
    const mpPerSecond = (out.width * out.height) / 1_000_000
    return {
      min: rule.usd * mpPerSecond * 24 * seconds,
      max: rule.usd * mpPerSecond * 30 * seconds,
    }
  }

  if (rule.kind === 'perSecond') {
    const table = rule.byResolution ?? {}
    let usd = rule.usd
    if (settings.modelId.includes('bytedance')) {
      usd = table[settings.bytedanceResolution ?? '1080p'] ?? rule.usd
    } else {
      // Topaz tiers by the output's short side
      const short = Math.min(out.width, out.height)
      const tier = short <= 720 ? '720p' : short <= 1080 ? '1080p' : '4k'
      usd = table[tier] ?? rule.usd
    }
    const total = usd * seconds * fpsMultiplier
    return { min: total, max: total }
  }

  return null
}
