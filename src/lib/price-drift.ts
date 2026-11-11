/**
 * Price drift — does the catalog still charge what fal charges?
 *
 * fal's pricing API (`GET /v1/models/pricing?endpoint_id=…`) returns one base
 * price per endpoint, usually at its cheapest setting (Kling 4 quotes 720p,
 * Gemini Omni 360p). Our rules are quoted at the default resolution with
 * per-resolution / per-quality tables, so a price "matches" when fal's number
 * appears anywhere in the rule, not only as `usd`.
 *
 * Pure: no fetch, no server imports. The admin check lives in
 * `src/server/price-drift.server.ts`.
 */

import type { PriceRule } from './pricing'

/** One entry of fal's `prices` array */
export interface FalPrice {
  endpoint_id: string
  unit_price: number
  unit: string
  currency: string
}

export type DriftStatus =
  /** same unit, fal's price is one of the rule's numbers */
  | 'ok'
  /** same unit, fal's price is none of the rule's numbers */
  | 'drift'
  /** fal bills in a unit the rule can't be compared to — check by hand */
  | 'unit'
  /** fal has a price, the catalog has none */
  | 'unpriced'
  /** fal returned no price for the endpoint */
  | 'missing'

export interface DriftRow {
  endpoint: string
  name: string
  category: string
  rule: PriceRule | null
  fal: FalPrice | null
  status: DriftStatus
  /** what the rule charges per fal unit, for display ("$0.040/s") */
  ours: Array<number>
}

/** fal unit strings each rule kind can be compared against */
const UNITS: Record<PriceRule['kind'], Array<string>> = {
  perMegapixel: ['megapixels', 'megapixel'],
  perImage: ['images', 'image'],
  perSecond: ['seconds', 'second'],
  perKChars: ['1000 characters'],
  perMinute: ['minutes', 'minute'],
  flat: ['generations', 'generation', 'requests', 'request'],
  range: [],
}

/** Every price a rule can charge, per its own unit */
export function ruleNumbers(rule: PriceRule): Array<number> {
  const nums: Array<number> = []
  const add = (t?: Record<string, number>) =>
    t && nums.push(...Object.values(t))
  switch (rule.kind) {
    case 'perImage':
      nums.push(rule.usd)
      add(rule.byQuality)
      add(rule.byResolution)
      break
    case 'perSecond':
      nums.push(rule.usd)
      add(rule.byResolution)
      if (rule.noAudio) {
        nums.push(rule.noAudio.usd)
        add(rule.noAudio.byResolution)
      }
      break
    case 'flat':
      nums.push(rule.usd)
      add(rule.byQuality)
      break
    case 'range':
      nums.push(rule.min, rule.max)
      break
    default:
      nums.push(rule.usd)
  }
  return [...new Set(nums)].sort((a, b) => a - b)
}

/** Equal to within half a percent (fal quotes 0.0675, we might store 0.0675) */
function same(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(a, b) * 0.005
}

export function compareRule(
  rule: PriceRule | null | undefined,
  fal: FalPrice | null | undefined,
): DriftStatus {
  if (!fal) return 'missing'
  if (!rule) return 'unpriced'
  const matches = ruleNumbers(rule).some((n) => same(n, fal.unit_price))
  // fal's generic "units" (Seedream 5 Pro, SAM 3D) still match when the
  // number is the same; a different number in a foreign unit can't be judged
  if (!UNITS[rule.kind].includes(fal.unit.toLowerCase())) {
    return matches && rule.kind !== 'range' ? 'ok' : 'unit'
  }
  return matches ? 'ok' : 'drift'
}

export interface CatalogEntry {
  endpoint: string
  name: string
  category: string
  rule: PriceRule | null
}

export function buildDriftRows(
  entries: ReadonlyArray<CatalogEntry>,
  prices: ReadonlyArray<FalPrice>,
): Array<DriftRow> {
  const byEndpoint = new Map(prices.map((p) => [p.endpoint_id, p]))
  const order: Record<DriftStatus, number> = {
    drift: 0,
    missing: 1,
    unit: 2,
    unpriced: 3,
    ok: 4,
  }
  return entries
    .map((e) => {
      const fal = byEndpoint.get(e.endpoint) ?? null
      return {
        ...e,
        fal,
        status: compareRule(e.rule, fal),
        ours: e.rule ? ruleNumbers(e.rule) : [],
      }
    })
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        a.category.localeCompare(b.category) ||
        a.name.localeCompare(b.name),
    )
}
