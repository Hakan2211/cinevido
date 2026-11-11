/**
 * Admin: compare every catalog price to fal's pricing API.
 *
 * The pricing API is free but rate-limited and answers 400 for the whole
 * request if any endpoint id is unknown, so ids go in batches of 40 and a
 * failed batch is reported instead of retried one by one.
 */

import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from './middleware.server'
import { getUserFalApiKey } from './byok.server'
import {
  AUDIO_MODELS,
  EDIT_MODELS,
  IMAGE_MODELS,
  IMAGE_TO_3D_MODELS,
  IMAGE_TO_WORLD_MODELS,
  MOTION_CONTROL_MODELS,
  MUSIC_MODELS,
  SFX_MODELS,
  TEXT_TO_3D_MODELS,
  UPSCALE_MODELS,
  VIDEO_MODELS,
  VIDEO_UPSCALE_MODELS,
} from './services/types'
import type { ModelConfig } from './services/types'
import { buildDriftRows } from '../lib/price-drift'
import type { CatalogEntry, DriftRow, FalPrice } from '../lib/price-drift'

const BATCH = 40

function catalogEntries(): Array<CatalogEntry> {
  const lists: Array<
    [string, ReadonlyArray<ModelConfig & { endpoint?: string }>]
  > = [
    ['Image', IMAGE_MODELS],
    ['Edit', EDIT_MODELS],
    ['Upscale', UPSCALE_MODELS],
    ['Video', VIDEO_MODELS],
    ['Video upscale', VIDEO_UPSCALE_MODELS],
    ['Voice', AUDIO_MODELS],
    ['SFX', SFX_MODELS],
    ['Music', MUSIC_MODELS],
    [
      '3D',
      [...TEXT_TO_3D_MODELS, ...IMAGE_TO_3D_MODELS, ...IMAGE_TO_WORLD_MODELS],
    ],
    ['Motion', MOTION_CONTROL_MODELS],
  ]
  const seen = new Set<string>()
  const entries: Array<CatalogEntry> = []
  for (const [category, models] of lists) {
    for (const m of models) {
      const endpoint = m.endpoint ?? m.id
      if (seen.has(endpoint)) continue
      seen.add(endpoint)
      entries.push({
        endpoint,
        name: m.name,
        category,
        rule: m.pricing ?? null,
      })
    }
  }
  return entries
}

export interface PriceDriftReport {
  rows: Array<DriftRow>
  /** batches fal refused, with its message */
  errors: Array<string>
  checkedAt: string
}

export const checkPriceDriftFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .handler(async ({ context }): Promise<PriceDriftReport> => {
    const apiKey = await getUserFalApiKey(context.user.id)
    const entries = catalogEntries()
    const ids = entries.map((e) => e.endpoint)
    const prices: Array<FalPrice> = []
    const errors: Array<string> = []
    const refused = new Set<string>()

    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      const url = new URL('https://api.fal.ai/v1/models/pricing')
      for (const id of batch) {
        url.searchParams.append('endpoint_id', id)
      }
      const res = await fetch(url, {
        headers: { Authorization: `Key ${apiKey}` },
      })
      const body = (await res.json().catch(() => null)) as {
        prices?: Array<FalPrice>
        error?: { message?: string } | string
        message?: string
      } | null
      if (!res.ok) {
        const msg =
          (typeof body?.error === 'object'
            ? body.error.message
            : body?.message) ?? res.statusText
        errors.push(`Models ${i + 1}–${i + batch.length}: ${res.status} ${msg}`)
        batch.forEach((id) => refused.add(id))
        continue
      }
      prices.push(...(body?.prices ?? []))
    }

    // A refused batch would otherwise show its models as "missing"
    return {
      rows: buildDriftRows(
        entries.filter((e) => !refused.has(e.endpoint)),
        prices,
      ),
      errors,
      checkedAt: new Date().toISOString(),
    }
  })
