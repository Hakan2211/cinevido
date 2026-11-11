/**
 * Model pricing — what a generation will cost on the user's fal.ai account.
 *
 * Shared by client and server (no server-only imports). Prices are USD and
 * come from fal's pricing API (`GET /v1/models/pricing`) plus the per-model
 * pricing notes on fal.ai/models/<id>, which carry the resolution / audio /
 * quality multipliers the API's single base price does not. They are
 * ESTIMATES: fal bills the account, and token-billed models vary per request.
 *
 * Last checked against fal: 2026-11-11.
 */

export type ModelTier = 'draft' | 'standard' | 'hero'

export const TIER_LABELS: Record<ModelTier, string> = {
  draft: 'Draft',
  standard: 'Workhorse',
  hero: 'Hero',
}

export type PriceRule =
  /** a fixed price per output image, optionally by quality or resolution */
  | {
      kind: 'perImage'
      usd: number
      byQuality?: Record<string, number>
      byResolution?: Record<string, number>
    }
  /** billed per output megapixel (rounded up, minimum 1) */
  | { kind: 'perMegapixel'; usd: number }
  /** billed per second of output; `noAudio` overrides when audio is off */
  | {
      kind: 'perSecond'
      usd: number
      byResolution?: Record<string, number>
      noAudio?: { usd: number; byResolution?: Record<string, number> }
    }
  /** billed per 1,000 characters of input text (speech) */
  | { kind: 'perKChars'; usd: number }
  /** billed per minute of output audio */
  | { kind: 'perMinute'; usd: number }
  /** one price per run, whatever the settings */
  | { kind: 'flat'; usd: number }
  /** token-billed or otherwise unpredictable — we only show a typical range */
  | { kind: 'range'; min: number; max: number; per: 'image' | 'run' }

export interface CostParams {
  numImages?: number
  width?: number
  height?: number
  quality?: string
  resolution?: string
  durationSec?: number
  audio?: boolean
  chars?: number
}

export interface CostEstimate {
  min: number
  max: number
}

function pick(
  table: Record<string, number> | undefined,
  key: string | undefined,
  fallback: number,
): number {
  if (!table || !key) return fallback
  return table[key] ?? table[key.toLowerCase()] ?? fallback
}

/** Estimate a run's cost. Returns null when the model has no price on file. */
export function estimateCost(
  rule: PriceRule | undefined,
  params: CostParams = {},
): CostEstimate | null {
  if (!rule) return null
  const images = Math.max(1, params.numImages ?? 1)

  switch (rule.kind) {
    case 'perImage': {
      const usd = rule.byQuality
        ? pick(rule.byQuality, params.quality, rule.usd)
        : pick(rule.byResolution, params.resolution, rule.usd)
      return exact(usd * images)
    }
    case 'perMegapixel': {
      const px = (params.width ?? 1024) * (params.height ?? 1024)
      const mp = Math.max(1, Math.ceil(px / 1_000_000))
      return exact(rule.usd * mp * images)
    }
    case 'perSecond': {
      const seconds = params.durationSec ?? 5
      const table =
        params.audio === false && rule.noAudio ? rule.noAudio : undefined
      const usd = table
        ? pick(table.byResolution, params.resolution, table.usd)
        : pick(rule.byResolution, params.resolution, rule.usd)
      return exact(usd * seconds)
    }
    case 'perKChars':
      return exact(rule.usd * Math.max(1, (params.chars ?? 0) / 1000))
    case 'perMinute':
      return exact(rule.usd * ((params.durationSec ?? 60) / 60))
    case 'flat':
      return exact(rule.usd)
    case 'range': {
      const n = rule.per === 'image' ? images : 1
      return { min: rule.min * n, max: rule.max * n }
    }
  }
}

function exact(usd: number): CostEstimate {
  return { min: usd, max: usd }
}

export function formatUsd(usd: number): string {
  if (usd > 0 && usd < 0.01) return '<$0.01'
  // three decimals below a dime so $0.027 and $0.094 stay distinct
  if (usd < 0.1) return `$${usd.toFixed(3).replace(/0$/, '')}`
  return `$${usd.toFixed(2)}`
}

/** "≈ $0.47" or "≈ $0.04–0.13" */
export function formatEstimate(estimate: CostEstimate | null): string | null {
  if (!estimate) return null
  if (Math.abs(estimate.max - estimate.min) < 0.0005) {
    return `≈ ${formatUsd(estimate.min)}`
  }
  return `≈ ${formatUsd(estimate.min)}–${formatUsd(estimate.max).replace('$', '')}`
}

/** The model's headline rate for pickers: "$0.094/s", "$0.027/img", "$0.08/1k chars" */
export function formatRate(rule: PriceRule | undefined): string | null {
  if (!rule) return null
  switch (rule.kind) {
    case 'perImage': {
      const values = Object.values(rule.byQuality ?? rule.byResolution ?? {})
      if (values.length > 1) {
        return `${formatUsd(Math.min(...values))}–${formatUsd(Math.max(...values)).replace('$', '')}/img`
      }
      return `${formatUsd(rule.usd)}/img`
    }
    case 'perMegapixel':
      return `${formatUsd(rule.usd)}/MP`
    case 'perSecond':
      // The default-resolution, audio-on rate — what Generate will charge
      // unless the user changes settings. (A "from" low would undersell
      // Seedance 2.5 by half.)
      return `${formatUsd(rule.usd)}/s`
    case 'perKChars':
      return `${formatUsd(rule.usd)}/1k chars`
    case 'perMinute':
      return `${formatUsd(rule.usd)}/min`
    case 'flat':
      return `${formatUsd(rule.usd)}/run`
    case 'range':
      return `${formatUsd(rule.min)}–${formatUsd(rule.max).replace('$', '')}/${rule.per === 'image' ? 'img' : 'run'}`
  }
}
