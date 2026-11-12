/**
 * Layerize jobs — submit one and carry it to a saved layer set. Shared by the
 * image lab (layers.server.ts), the Studio's job poller (generation.server.ts)
 * and the Director's `splitIntoLayers` tool.
 *
 * Server-only helpers: nothing here is a server function, so client-imported
 * modules must not re-export from this file.
 */

import { prisma } from '../../db.server'
import { getUserFalApiKey } from '../byok.server'
import { uploadFromUrl } from './bunny.server'
import { getUserStorageConfig } from '../storage-config.server'
import { getLayerizeStatus, submitLayerize } from './layerize.server'
import { DEFAULT_MODELS, LAYERIZE_MODELS } from './types'
import { layerizeCeiling, layerizeCost } from '../../lib/layers'
import { toUsd } from '../../lib/job-cost'
import type { Box, Layer, LayerSet } from '../../lib/layers'
import type { FalLayer, FalLayerizeResult } from './layerize.server'

export const MAX_LAYERS = LAYERIZE_MODELS[0].maxOutputs - 1
// Mock storage hands back URLs that don't load; keep images viewable instead
const MOCK = process.env.MOCK_GENERATION === 'true'

function parse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

export interface StartLayerizeArgs {
  userId: string
  /** already checked to be the caller's (ownedProjectId) */
  projectId: string | null
  imageUrl: string
  sourceAssetId?: string
  prompt?: string
  maxLayers: number
  textRecognition?: boolean
  sourceWidth?: number
  sourceHeight?: number
  /** the Studio's poller only follows `processing` jobs */
  status?: 'pending' | 'processing'
}

/** fal's input limits, checked before anything is billed */
export function checkLayerizeSource(w?: number, h?: number) {
  // fal's limits: 512×512 to 6000×6000, aspect 1:16 to 16:1
  if (w && h && (w * h < 512 * 512 || w > 6000 || h > 6000)) {
    throw new Error(
      `Layerize takes images from 512×512 to 6000×6000 px; this one is ${w}×${h}.`,
    )
  }
  if (w && h && Math.max(w / h, h / w) > 16) {
    throw new Error('Layerize takes aspect ratios up to 16:1.')
  }
}

/** Submit to fal and log the job, charged at its ceiling until it returns */
export async function startLayerizeJob(args: StartLayerizeArgs) {
  const w = args.sourceWidth
  const h = args.sourceHeight
  checkLayerizeSource(w, h)
  const maxLayers = Math.min(
    MAX_LAYERS,
    Math.max(1, Math.round(args.maxLayers)),
  )

  const apiKey = await getUserFalApiKey(args.userId)
  const job = await submitLayerize(
    {
      imageUrl: args.imageUrl,
      prompt: args.prompt,
      maxLayers,
      textRecognition: args.textRecognition,
    },
    apiKey,
  )

  const ceiling = layerizeCeiling({ maxLayers, width: w, height: h })
  const dbJob = await prisma.generationJob.create({
    data: {
      userId: args.userId,
      projectId: args.projectId,
      type: 'layerize',
      status: args.status ?? 'pending',
      provider: 'fal',
      model: DEFAULT_MODELS.layerize,
      input: JSON.stringify({
        imageUrl: args.imageUrl,
        sourceAssetId: args.sourceAssetId,
        prompt: args.prompt,
        maxLayers,
        textRecognition: args.textRecognition,
        sourceWidth: w,
        sourceHeight: h,
      }),
      estimatedCostUsd: ceiling
        ? toUsd({ min: ceiling.max, max: ceiling.max })
        : null,
      externalId: job.requestId,
      statusUrl: job.statusUrl,
      responseUrl: job.responseUrl,
      cancelUrl: job.cancelUrl,
    },
  })
  return { jobId: dbJob.id, ceilingUsd: ceiling?.max ?? null, maxLayers }
}

/** fal's layers (or, failing that, its flat image list) as our Layer type */
function toLayers(result: FalLayerizeResult): Array<Layer> {
  const raw: Array<FalLayer> =
    result.layers && result.layers.length > 0
      ? result.layers
      : (result.images ?? []).map((image, i) => ({ image, z_index: i }))
  return raw
    .filter((l) => l.image?.url)
    .map((l) => ({
      url: l.image.url,
      z: l.z_index,
      box:
        l.z_index === 0
          ? undefined
          : (l.bounding_box?.absolute as Box | undefined),
      name: l.name,
      description: l.description,
      text: l.text_recognition
        ? (l.text_recognition as Layer['text'])
        : undefined,
      width: l.image.width,
      height: l.image.height,
    }))
    .sort((a, b) => a.z - b.z)
}

export interface LayerizeProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  queuePosition?: number
  assetId: string | null
  error: string | null
}

/**
 * Poll a layerize job once; on completion copy every layer to storage and
 * save the set as one image asset (base image + `metadata.layerSet`), then
 * re-price the job at the real layer count. Safe to call from several tabs:
 * only the caller that claims the job saves it.
 */
export async function advanceLayerizeJob(
  jobId: string,
  userId: string,
): Promise<LayerizeProgress> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } })
  if (!job || job.userId !== userId || job.type !== 'layerize') {
    throw new Error('Job not found')
  }
  if (job.status === 'completed' || job.status === 'failed') {
    const output = parse<{ assetId?: string }>(job.output, {})
    return {
      status: job.status,
      assetId: output.assetId ?? null,
      error: job.error,
    }
  }
  if (!job.statusUrl || !job.responseUrl)
    throw new Error('Job has no queue URLs')

  const apiKey = await getUserFalApiKey(userId)
  const fal = await getLayerizeStatus(job.statusUrl, job.responseUrl, apiKey)

  if (fal.status === 'failed') {
    await prisma.generationJob.update({
      where: { id: job.id },
      // fal doesn't bill a failed run
      data: {
        status: 'failed',
        error: fal.error ?? 'Layerize failed',
        estimatedCostUsd: 0,
      },
    })
    return {
      status: 'failed',
      assetId: null,
      error: fal.error ?? 'Layerize failed',
    }
  }
  if (fal.status !== 'completed' || !fal.result) {
    if (fal.status === 'processing' && job.status !== 'processing') {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: 'processing' },
      })
    }
    return {
      status: fal.status,
      queuePosition: fal.queuePosition,
      assetId: null,
      error: null,
    }
  }

  // Two tabs can poll at once: only the one that claims the job saves it
  const claim = await prisma.generationJob.updateMany({
    where: { id: job.id, progress: { lt: 99 } },
    data: { progress: 99, status: 'processing' },
  })
  if (claim.count === 0) {
    return { status: 'processing', assetId: null, error: null }
  }

  try {
    const input = parse<{
      prompt?: string
      sourceAssetId?: string
      sourceWidth?: number
      sourceHeight?: number
    }>(job.input, {})
    const fresh = toLayers(fal.result)
    const base = fresh.find((l) => l.z === 0) ?? fresh[0]
    if (!base) throw new Error('Layerize returned no images')

    // Copy every layer off fal's temporary URLs (keep fal's on failure)
    const storage = (await getUserStorageConfig(userId)) ?? undefined
    const stamp = Date.now()
    const layers = await Promise.all(
      fresh.map(async (layer) => {
        if (MOCK) return layer
        try {
          const up = await uploadFromUrl(
            layer.url,
            {
              folder: `images/${userId}/layers`,
              filename: `layer-${stamp}-${layer.z}.png`,
            },
            storage,
          )
          return { ...layer, url: up.url }
        } catch (err) {
          console.error('[LAYERS] upload failed, keeping fal URL:', err)
          return layer
        }
      }),
    )
    const storedBase = layers.find((l) => l.z === base.z)!
    const width = base.width ?? input.sourceWidth ?? 1024
    const height = base.height ?? input.sourceHeight ?? 1024
    const set: LayerSet = {
      width,
      height,
      layers,
      sourceAssetId: input.sourceAssetId,
    }

    const asset = await prisma.asset.create({
      data: {
        userId,
        projectId: job.projectId,
        type: 'image',
        storageUrl: storedBase.url,
        filename: `layers-${stamp}.png`,
        prompt: input.prompt || null,
        provider: 'fal',
        model: job.model,
        metadata: JSON.stringify({
          width,
          height,
          sourceAssetId: input.sourceAssetId,
          layerSet: set,
        }),
      },
    })

    const cost = layerizeCost({ outputs: layers.length, width, height })
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: 100,
        output: JSON.stringify({ assetId: asset.id, layers: layers.length }),
        estimatedCostUsd: toUsd(cost),
      },
    })
    return { status: 'completed', assetId: asset.id, error: null }
  } catch (err) {
    // release the claim so the next poll can try again
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { progress: 0 },
    })
    throw err
  }
}
