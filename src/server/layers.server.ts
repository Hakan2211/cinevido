/**
 * Layer sets — server functions for the image lab's Layers tab.
 *
 * - startLayerizeFn: split an image with Seedream 5.5 Layerize (BYOK, queued)
 * - getLayerizeJobStatusFn: poll; on completion copy every layer to storage and
 *   save the set as one image asset (base image + `metadata.layerSet`)
 * - applyLayerEditFn: swap one layer for the result of a finished edit job
 * - saveLayerFn: put one layer in the library as its own image
 * - composeLayersFn: bake moved / hidden layers into a new image (sharp)
 *
 * The client imports this module, so it exports server functions only.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import sharp from 'sharp'
import { prisma } from '../db.server'
import { authMiddleware } from './middleware.server'
import { getUserFalApiKey } from './byok.server'
import { ownedProjectId } from './project-access.server'
import { uploadBuffer, uploadFromUrl } from './services/bunny.server'
import { getUserStorageConfig } from './storage-config.server'
import { getLayerizeStatus, submitLayerize } from './services/layerize.server'
import { DEFAULT_MODELS, LAYERIZE_MODELS } from './services/types'
import {
  LAYER_COMPOSITE_MODEL,
  layerSetOf,
  layerizeCeiling,
  layerizeCost,
  placeOnCanvas,
  sortedLayers,
} from '../lib/layers'
import { toUsd } from '../lib/job-cost'
import type { Box, Layer, LayerSet, LayerView } from '../lib/layers'
import type { FalLayer, FalLayerizeResult } from './services/layerize.server'

const MAX_LAYERS = LAYERIZE_MODELS[0].maxOutputs - 1
// Mock storage hands back URLs that don't load; keep images viewable instead
const MOCK = process.env.MOCK_GENERATION === 'true'

const startSchema = z.object({
  imageUrl: z.string().url(),
  sourceAssetId: z.string().optional(),
  prompt: z.string().max(1000).optional(),
  maxLayers: z.number().int().min(1).max(MAX_LAYERS),
  textRecognition: z.boolean().optional(),
  /** measured by the client, to pick the price tier (unknown → 2K rate) */
  sourceWidth: z.number().int().positive().optional(),
  sourceHeight: z.number().int().positive().optional(),
  projectId: z.string().optional(),
})

const jobIdSchema = z.object({ jobId: z.string() })

function parse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

export const startLayerizeFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(startSchema)
  .handler(async ({ data, context }) => {
    const w = data.sourceWidth
    const h = data.sourceHeight
    // fal's limits: 512×512 to 6000×6000, aspect 1:16 to 16:1
    if (w && h && (w * h < 512 * 512 || w > 6000 || h > 6000)) {
      throw new Error(
        `Layerize takes images from 512×512 to 6000×6000 px; this one is ${w}×${h}.`,
      )
    }
    if (w && h && Math.max(w / h, h / w) > 16) {
      throw new Error('Layerize takes aspect ratios up to 16:1.')
    }

    const apiKey = await getUserFalApiKey(context.user.id)
    const job = await submitLayerize(
      {
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        maxLayers: data.maxLayers,
        textRecognition: data.textRecognition,
      },
      apiKey,
    )

    // Charged at the ceiling now, re-priced at the real layer count on return
    const ceiling = layerizeCeiling({
      maxLayers: data.maxLayers,
      width: w,
      height: h,
    })
    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: await ownedProjectId(data.projectId, context.user.id),
        type: 'layerize',
        status: 'pending',
        provider: 'fal',
        model: DEFAULT_MODELS.layerize,
        input: JSON.stringify({
          imageUrl: data.imageUrl,
          sourceAssetId: data.sourceAssetId,
          prompt: data.prompt,
          maxLayers: data.maxLayers,
          textRecognition: data.textRecognition,
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
    return { jobId: dbJob.id }
  })

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

export const getLayerizeJobStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(jobIdSchema)
  .handler(async ({ data, context }) => {
    const job = await prisma.generationJob.findUnique({
      where: { id: data.jobId },
    })
    if (!job || job.userId !== context.user.id || job.type !== 'layerize') {
      throw new Error('Job not found')
    }
    const done = () => {
      const output = parse<{ assetId?: string }>(job.output, {})
      return {
        status: job.status as 'completed' | 'failed',
        assetId: output.assetId ?? null,
        error: job.error,
      }
    }
    if (job.status === 'completed' || job.status === 'failed') return done()
    if (!job.statusUrl || !job.responseUrl)
      throw new Error('Job has no queue URLs')

    const apiKey = await getUserFalApiKey(context.user.id)
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
        status: 'failed' as const,
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
      return { status: 'processing' as const, assetId: null, error: null }
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
      const storage = (await getUserStorageConfig(context.user.id)) ?? undefined
      const stamp = Date.now()
      const layers = await Promise.all(
        fresh.map(async (layer) => {
          if (MOCK) return layer
          try {
            const up = await uploadFromUrl(
              layer.url,
              {
                folder: `images/${context.user.id}/layers`,
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
          userId: context.user.id,
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
      return { status: 'completed' as const, assetId: asset.id, error: null }
    } catch (err) {
      // release the claim so the next poll can try again
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { progress: 0 },
      })
      throw err
    }
  })

/** The set asset, owned by the caller, with its parsed layer set */
async function loadSet(assetId: string, userId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } })
  if (!asset || asset.userId !== userId) throw new Error('Layer set not found')
  const metadata = parse<Record<string, unknown>>(asset.metadata, {})
  const set = layerSetOf(metadata)
  if (!set) throw new Error('This image has no layers')
  return { asset, metadata, set }
}

function layerAt(set: LayerSet, z: number): Layer {
  const layer = set.layers.find((l) => l.z === z)
  if (!layer) throw new Error(`No layer ${z}`)
  return layer
}

export const getLayerSetFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ assetId: z.string() }))
  .handler(async ({ data, context }) => {
    const { asset, set } = await loadSet(data.assetId, context.user.id)
    return { id: asset.id, url: asset.storageUrl, prompt: asset.prompt, set }
  })

/**
 * Replace a layer with a finished edit of it. The new image comes from the
 * caller's own completed edit job — never from a URL the client sends.
 */
export const applyLayerEditFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      assetId: z.string(),
      z: z.number().int().min(0),
      editJobId: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { asset, metadata, set } = await loadSet(
      data.assetId,
      context.user.id,
    )
    const job = await prisma.generationJob.findUnique({
      where: { id: data.editJobId },
    })
    if (
      !job ||
      job.userId !== context.user.id ||
      job.type !== 'edit' ||
      job.status !== 'completed'
    ) {
      throw new Error('That edit has not finished')
    }
    const output = parse<{ url?: string; width?: number; height?: number }>(
      job.output,
      {},
    )
    if (!output.url) throw new Error('The edit has no image')

    const layer = layerAt(set, data.z)
    const next: LayerSet = {
      ...set,
      layers: set.layers.map((l) =>
        l.z === data.z
          ? {
              ...l,
              url: output.url!,
              originalUrl: layer.originalUrl ?? layer.url,
              width: output.width,
              height: output.height,
            }
          : l,
      ),
    }
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        // the base is the asset's own image
        ...(data.z === 0 && { storageUrl: output.url }),
        metadata: JSON.stringify({ ...metadata, layerSet: next }),
      },
    })
    return { set: next }
  })

/** One layer as its own library image (same stored file) */
export const saveLayerFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ assetId: z.string(), z: z.number().int().min(0) }))
  .handler(async ({ data, context }) => {
    const { asset, set } = await loadSet(data.assetId, context.user.id)
    const layer = layerAt(set, data.z)
    const created = await prisma.asset.create({
      data: {
        userId: context.user.id,
        projectId: asset.projectId,
        type: 'image',
        storageUrl: layer.url,
        filename: `${(layer.name ?? 'layer').replace(/[^\w-]+/g, '-').toLowerCase()}.png`,
        prompt: layer.description ?? layer.name ?? null,
        provider: 'fal',
        model: asset.model,
        metadata: JSON.stringify({
          width: layer.width,
          height: layer.height,
          // the base is opaque; separated layers are cut-outs
          transparent: layer.z !== 0 || undefined,
          sourceAssetId: asset.id,
        }),
      },
    })
    return { assetId: created.id }
  })

const viewSchema = z.object({
  z: z.number().int().min(0),
  visible: z.boolean(),
  dx: z.number().finite(),
  dy: z.number().finite(),
})

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load a layer (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Bake the current view (hidden layers left out, moved layers at their new
 * place) into a new PNG and save it to the library. The view is stored on the
 * set too, so reopening it shows the same arrangement.
 */
export const composeLayersFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({ assetId: z.string(), views: z.array(viewSchema).max(100) }),
  )
  .handler(async ({ data, context }) => {
    const { asset, metadata, set } = await loadSet(
      data.assetId,
      context.user.id,
    )
    const views = new Map<number, LayerView>(
      data.views.map((v) => [v.z, { visible: v.visible, dx: v.dx, dy: v.dy }]),
    )
    const canvas = { width: set.width, height: set.height }
    const visible = sortedLayers(set).filter(
      (l) => views.get(l.z)?.visible ?? true,
    )
    if (visible.length === 0) throw new Error('Show at least one layer')

    const overlays: Array<sharp.OverlayOptions> = []
    for (const layer of visible) {
      const buf = await fetchBuffer(layer.url)
      const view = views.get(layer.z)
      const box: Box = layer.box ?? [0, 0, set.width, set.height]
      const place = placeOnCanvas(canvas, box, view?.dx ?? 0, view?.dy ?? 0)
      if (!place) continue
      // an edited layer can come back at another size: fit it to its box
      let img = sharp(buf)
        .ensureAlpha()
        .resize(place.width, place.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
      const clipped =
        place.crop.width !== place.width || place.crop.height !== place.height
      if (clipped) {
        img = sharp(await img.png().toBuffer()).extract(place.crop)
      }
      overlays.push({
        input: await img.png().toBuffer(),
        left: place.left,
        top: place.top,
      })
    }

    const png = await sharp({
      create: {
        width: canvas.width,
        height: canvas.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(overlays)
      .png()
      .toBuffer()

    const storage = (await getUserStorageConfig(context.user.id)) ?? undefined
    const filename = `layers-composite-${Date.now()}.png`
    const up = await uploadBuffer(
      png,
      'image/png',
      { folder: `images/${context.user.id}`, filename },
      storage,
    )
    const url = MOCK
      ? `data:image/png;base64,${png.toString('base64')}`
      : up.url
    const baseShown = views.get(0)?.visible ?? true
    const created = await prisma.asset.create({
      data: {
        userId: context.user.id,
        projectId: asset.projectId,
        type: 'image',
        storageUrl: url,
        filename,
        prompt: asset.prompt,
        provider: 'cinevido',
        model: LAYER_COMPOSITE_MODEL,
        metadata: JSON.stringify({
          width: canvas.width,
          height: canvas.height,
          transparent: !baseShown || undefined,
          sourceAssetId: asset.id,
        }),
      },
    })

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        metadata: JSON.stringify({
          ...metadata,
          layerSet: { ...set, views: Object.fromEntries(views) },
        }),
      },
    })
    return { assetId: created.id, url }
  })
