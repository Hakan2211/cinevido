/**
 * Settings → Usage: this month's spend, a daily spend series and the last
 * jobs with their cost.
 *
 * Spend comes from two places:
 *  - fal's usage API (`GET /v1/models/usage`), read with the user's read-only
 *    billing key. Real billed amounts, but for the whole fal account — runs
 *    made outside Cinevido count too.
 *  - our own estimates (`estimatedCostUsd`, written at submit time from the
 *    catalog price). Always available, Cinevido-only, an estimate.
 * The page shows fal's number when it has a billing key and ours otherwise,
 * and the jobs table always uses ours (fal's per-request billing is
 * enterprise-only).
 */

import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from './middleware.server'
import { getBillingKey } from './byok.server'
import {
  AUDIO_MODELS,
  EDIT_MODELS,
  IMAGE_MODELS,
  MOTION_CONTROL_MODELS,
  MUSIC_MODELS,
  SFX_MODELS,
  UPSCALE_MODELS,
  VIDEO_MODELS,
  VIDEO_UPSCALE_MODELS,
  get3DModelById,
} from './services/types'

async function getPrisma() {
  const { prisma } = await import('../db.server')
  return prisma
}

// =============================================================================
// Types
// =============================================================================

export type JobKind =
  | 'Image'
  | 'Edit'
  | 'Upscale'
  | 'Video'
  | 'Motion'
  | 'Voice'
  | 'SFX'
  | 'Music'
  | '3D'

export interface UsageJob {
  id: string
  kind: JobKind
  modelName: string
  prompt: string | null
  /** seconds of output, for time-based media */
  durationSec: number | null
  costUsd: number | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  /** an image to show in the row, when the job produced one */
  thumbnailUrl: string | null
  /** a video to show a frame of, when the job produced one */
  videoUrl: string | null
}

export interface DailySpend {
  /** YYYY-MM-DD, UTC */
  day: string
  usd: number
}

export interface UsageSummary {
  /** first day of the month, UTC, ISO */
  periodStart: string
  /** whose numbers `monthUsd` and `daily` are */
  source: 'fal' | 'estimate'
  monthUsd: number
  daily: Array<DailySpend>
  /** Cinevido's own estimate for the month, whichever source is shown */
  estimatedMonthUsd: number
  /** set when the fal usage API was tried and failed */
  falError: string | null
  recentJobs: Array<UsageJob>
  checkedAt: string
}

// =============================================================================
// fal usage API
// =============================================================================

interface FalUsageResult {
  cost: number
}
interface FalUsagePage {
  next_cursor: string | null
  has_more: boolean
  time_series?: Array<{ bucket: string; results: Array<FalUsageResult> }>
}

const FAL_TTL_MS = 5 * 60_000
const falCache = new Map<
  string,
  { at: number; key: string; period: string; value: Array<DailySpend> }
>()

/** Daily cost buckets since `start`, all endpoints, from fal */
async function fetchFalDaily(
  key: string,
  start: Date,
): Promise<Array<DailySpend>> {
  const byDay = new Map<string, number>()
  let cursor: string | null = null
  // A month of daily buckets is one page today; follow the cursor a few
  // times in case fal starts paginating.
  for (let page = 0; page < 5; page++) {
    const url = new URL('https://api.fal.ai/v1/models/usage')
    url.searchParams.set('expand', 'time_series')
    url.searchParams.set('timeframe', 'day')
    url.searchParams.set('start', start.toISOString())
    if (cursor) url.searchParams.set('cursor', cursor)
    const response = await fetch(url, {
      headers: { Authorization: `Key ${key}` },
    })
    if (response.status === 401 || response.status === 403) {
      throw new Error('Your billing key can no longer read usage')
    }
    if (!response.ok) throw new Error(`fal answered ${response.status}`)
    const body = (await response.json()) as FalUsagePage
    for (const bucket of body.time_series ?? []) {
      const day = bucket.bucket.slice(0, 10)
      const usd = bucket.results.reduce((sum, r) => sum + (r.cost || 0), 0)
      byDay.set(day, (byDay.get(day) ?? 0) + usd)
    }
    if (!body.has_more || !body.next_cursor) break
    cursor = body.next_cursor
  }
  return [...byDay].map(([day, usd]) => ({ day, usd }))
}

// =============================================================================
// Names
// =============================================================================

const MODEL_NAMES = new Map<string, string>(
  [
    ...IMAGE_MODELS,
    ...EDIT_MODELS,
    ...UPSCALE_MODELS,
    ...VIDEO_MODELS,
    ...VIDEO_UPSCALE_MODELS,
    ...MOTION_CONTROL_MODELS,
    ...AUDIO_MODELS,
    ...SFX_MODELS,
    ...MUSIC_MODELS,
  ].map((m) => [m.id, m.name]),
)

function kindOf(type: string, input: Record<string, unknown>): JobKind {
  switch (type) {
    case 'image':
      return 'Image'
    case 'edit':
      return 'Edit'
    case 'upscale':
    case 'video-upscale':
      return 'Upscale'
    case 'video':
      return input.generationType === 'motion-control' ? 'Motion' : 'Video'
    case 'audio':
      return 'Voice'
    case 'sfx':
      return 'SFX'
    case 'music':
      return 'Music'
    default:
      return 'Image'
  }
}

function parse(json: string | null): Record<string, unknown> {
  if (!json) return {}
  try {
    const value: unknown = JSON.parse(json)
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null

function asStatus(s: string): UsageJob['status'] {
  return s === 'completed' || s === 'failed' || s === 'processing'
    ? s
    : 'pending'
}

// =============================================================================
// Server function
// =============================================================================

const RECENT_JOBS = 10

export const getUsageFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<UsageSummary> => {
    const prisma = await getPrisma()
    const userId = context.user.id
    const now = new Date()
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    )

    // ---- our estimates for the month (failed runs aren't billed) ----
    const [monthJobs, month3D, jobs, models3D] = await Promise.all([
      prisma.generationJob.findMany({
        where: {
          userId,
          createdAt: { gte: periodStart },
          status: { not: 'failed' },
          estimatedCostUsd: { not: null },
        },
        select: { createdAt: true, estimatedCostUsd: true },
      }),
      prisma.model3DAsset.findMany({
        where: {
          userId,
          createdAt: { gte: periodStart },
          status: { not: 'failed' },
          estimatedCostUsd: { not: null },
        },
        select: { createdAt: true, estimatedCostUsd: true },
      }),
      prisma.generationJob.findMany({
        where: { userId, type: { not: 'render' } },
        orderBy: { createdAt: 'desc' },
        take: RECENT_JOBS,
      }),
      prisma.model3DAsset.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: RECENT_JOBS,
      }),
    ])

    const estimatedByDay = new Map<string, number>()
    let estimatedMonthUsd = 0
    for (const row of [...monthJobs, ...month3D]) {
      const usd = row.estimatedCostUsd ?? 0
      const day = row.createdAt.toISOString().slice(0, 10)
      estimatedByDay.set(day, (estimatedByDay.get(day) ?? 0) + usd)
      estimatedMonthUsd += usd
    }

    // ---- fal's real numbers, when the user has a billing key ----
    let falDaily: Array<DailySpend> | null = null
    let falError: string | null = null
    const key = await getBillingKey(userId)
    if (key) {
      const cached = falCache.get(userId)
      if (
        cached &&
        cached.key === key &&
        cached.period === periodStart.toISOString() &&
        Date.now() - cached.at < FAL_TTL_MS
      ) {
        falDaily = cached.value
      } else {
        try {
          falDaily = await fetchFalDaily(key, periodStart)
          falCache.set(userId, {
            at: Date.now(),
            key,
            period: periodStart.toISOString(),
            value: falDaily,
          })
        } catch (error) {
          falError = error instanceof Error ? error.message : 'Network error'
        }
      }
    }

    // ---- one row per day of the month so far ----
    const source = falDaily ? 'fal' : 'estimate'
    const byDay = falDaily
      ? new Map(falDaily.map((d) => [d.day, d.usd]))
      : estimatedByDay
    const daily: Array<DailySpend> = []
    for (
      let d = new Date(periodStart);
      d <= now;
      d = new Date(d.getTime() + 86_400_000)
    ) {
      const day = d.toISOString().slice(0, 10)
      daily.push({ day, usd: byDay.get(day) ?? 0 })
    }
    const monthUsd = daily.reduce((sum, d) => sum + d.usd, 0)

    // ---- last jobs, generations and 3D together ----
    const rows: Array<UsageJob> = [
      ...jobs.map((job): UsageJob => {
        const input = parse(job.input)
        const output = parse(job.output)
        const kind = kindOf(job.type, input)
        const url = str(output.url)
        const isVisual = kind === 'Image' || kind === 'Edit'
        const isVideo = kind === 'Video' || kind === 'Motion'
        return {
          id: job.id,
          kind,
          modelName: MODEL_NAMES.get(job.model) ?? job.model,
          prompt: str(input.prompt) ?? str(input.text),
          durationSec:
            num(output.duration) ??
            num(input.duration) ??
            num(input.durationSec),
          costUsd: job.estimatedCostUsd,
          status: asStatus(job.status),
          createdAt: job.createdAt.toISOString(),
          thumbnailUrl: isVisual || job.type === 'upscale' ? url : null,
          videoUrl: isVideo || job.type === 'video-upscale' ? url : null,
        }
      }),
      ...models3D.map(
        (asset): UsageJob => ({
          id: asset.id,
          kind: '3D',
          modelName: get3DModelById(asset.modelId)?.name ?? asset.modelId,
          prompt: asset.prompt,
          durationSec: null,
          costUsd: asset.estimatedCostUsd,
          status: asStatus(asset.status),
          createdAt: asset.createdAt.toISOString(),
          thumbnailUrl: asset.thumbnailUrl,
          videoUrl: null,
        }),
      ),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, RECENT_JOBS)

    return {
      periodStart: periodStart.toISOString(),
      source,
      monthUsd,
      daily,
      estimatedMonthUsd,
      falError,
      recentJobs: rows,
      checkedAt: new Date().toISOString(),
    }
  })
