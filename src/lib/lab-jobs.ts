/**
 * Lab jobs: the renders started from the Image, Video and Motion labs.
 *
 * They run in the background. The app-wide job tracker
 * (src/components/jobs/JobTracker.tsx) lists the user's unfinished lab jobs
 * from the database, polls each one until fal is done (which is what saves the
 * result), and tells the user when it lands, on whatever page they are on.
 * The labs read their pending cards from the tracker instead of keeping the
 * job in page state, so leaving a lab and coming back loses nothing.
 *
 * Director jobs are not lab jobs: they belong to a project and the Studio's
 * runner finishes them. Layer edits are finished by the layer viewer.
 */

import { formatUsd } from './pricing'

/** What the lab started */
export type LabJobKind =
  | 'image'
  | 'edit'
  | 'upscale'
  | 'layers'
  | 'video'
  | 'video-upscale'
  | 'motion'

export type LabId = 'images' | 'videos' | 'motion'

export const LAB_OF: Record<LabJobKind, LabId> = {
  image: 'images',
  edit: 'images',
  upscale: 'images',
  layers: 'images',
  video: 'videos',
  'video-upscale': 'videos',
  motion: 'motion',
}

export const LAB_PATH = {
  images: '/images',
  videos: '/videos',
  motion: '/motion-control',
} as const satisfies Record<LabId, string>

/** The `generation_job.type` values a lab job can have */
export const LAB_JOB_TYPES = [
  'image',
  'edit',
  'upscale',
  'layerize',
  'video',
  'video-upscale',
] as const

/** Jobs older than this are not shown any more (fal drops results anyway) */
export const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000

export interface LabJob {
  id: string
  kind: LabJobKind
  model: string
  status: 'pending' | 'processing'
  progress: number
  createdAt: string
  prompt: string | null
  /** images in the batch (pending cards to show) */
  count: number
  /** edit / upscale / layers / video upscale: the image or clip it started from */
  sourceAssetId: string | null
  /** what the whole job should cost, from the catalog at submit time */
  costUsd: number | null
}

/** The job row as the database has it */
export interface JobRow {
  id: string
  type: string
  model: string
  status: string
  progress: number
  createdAt: Date | string
  input: string
  estimatedCostUsd: number | null
  projectId: string | null
}

interface JobInput {
  prompt?: string | null
  numImages?: number
  generationType?: string
  purpose?: string
  sourceAssetId?: string
  sourceAssetIds?: Array<string>
  sourceImageId?: string
}

function parseInput(raw: string): JobInput {
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' ? (value as JobInput) : {}
  } catch {
    return {}
  }
}

/** Which lab job a row is, or null if it isn't one */
export function labJobKind(
  type: string,
  input: Pick<JobInput, 'generationType' | 'purpose'>,
): LabJobKind | null {
  switch (type) {
    case 'image':
      return 'image'
    case 'edit':
      return input.purpose === 'layer' ? null : 'edit'
    case 'upscale':
      return 'upscale'
    case 'layerize':
      return 'layers'
    case 'video':
      return input.generationType === 'motion-control' ? 'motion' : 'video'
    case 'video-upscale':
      return 'video-upscale'
    default:
      return null
  }
}

/** A database row → the lab job the tracker shows, or null if it isn't one */
export function toLabJob(row: JobRow): LabJob | null {
  if (row.projectId) return null
  if (row.status !== 'pending' && row.status !== 'processing') return null
  const input = parseInput(row.input)
  const kind = labJobKind(row.type, input)
  if (!kind) return null
  return {
    id: row.id,
    kind,
    model: row.model,
    status: row.status,
    progress: row.progress,
    createdAt:
      typeof row.createdAt === 'string'
        ? row.createdAt
        : row.createdAt.toISOString(),
    prompt: input.prompt ?? null,
    count:
      kind === 'image' ? Math.max(1, Math.min(4, input.numImages ?? 1)) : 1,
    sourceAssetId:
      input.sourceAssetId ??
      input.sourceAssetIds?.[0] ??
      input.sourceImageId ??
      null,
    costUsd: row.estimatedCostUsd,
  }
}

/** The cost shown on a pending card: per image for a batch, a ceiling for Layerize */
export function labJobCostLabel(job: LabJob): string | null {
  if (job.costUsd == null) return null
  if (job.kind === 'layers') return `≤ ${formatUsd(job.costUsd)}`
  return `≈ ${formatUsd(job.costUsd / job.count)}`
}

/** How a poll of one job came back, the same for every kind */
export interface LabJobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  queuePosition: number | null
  error: string | null
  /** the saved result (first image of a batch) */
  assetId: string | null
  url: string | null
}

/** Normalise what a status server function returned */
export function normaliseStatus(raw: unknown): LabJobStatus {
  const r = (raw ?? {}) as {
    status?: string
    progress?: number
    queuePosition?: number | null
    error?: string | null
    assetId?: string | null
    output?: {
      url?: string
      assetId?: string
      images?: Array<{ url?: string; assetId?: string }>
    } | null
  }
  const status =
    r.status === 'completed' ||
    r.status === 'failed' ||
    r.status === 'processing'
      ? r.status
      : 'pending'
  return {
    status,
    progress: typeof r.progress === 'number' ? r.progress : 0,
    queuePosition: r.queuePosition ?? null,
    error: r.error ?? null,
    assetId:
      r.output?.assetId ?? r.output?.images?.[0]?.assetId ?? r.assetId ?? null,
    url: r.output?.url ?? r.output?.images?.[0]?.url ?? null,
  }
}

/** What the toast says when a job lands */
export const DONE_LABEL: Record<LabJobKind, string> = {
  image: 'Image ready',
  edit: 'Edit ready',
  upscale: 'Upscale ready',
  layers: 'Layers ready',
  video: 'Video ready',
  'video-upscale': 'Upscaled clip ready',
  motion: 'Motion clip ready',
}

export const FAILED_LABEL: Record<LabJobKind, string> = {
  image: 'Image failed',
  edit: 'Edit failed',
  upscale: 'Upscale failed',
  layers: 'Layerize failed',
  video: 'Video failed',
  'video-upscale': 'Video upscale failed',
  motion: 'Motion clip failed',
}
