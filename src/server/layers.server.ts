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
import { ownedProjectId } from './project-access.server'
import { uploadBuffer } from './services/bunny.server'
import { getUserStorageConfig } from './storage-config.server'
import {
  MAX_LAYERS,
  advanceLayerizeJob,
  startLayerizeJob,
} from './services/layer-jobs.server'
import {
  CAMERA_MOVES,
  LAYER_COMPOSITE_MODEL,
  addLayerSetToManifest,
  layerSetOf,
  placeOnCanvas,
  sortedLayers,
} from '../lib/layers'
import { layerTextSvg } from '../remotion/layer-text'
import { migrateManifest, sequenceEndFrame } from '../remotion/types'
import type { Box, Layer, LayerSet, LayerView } from '../lib/layers'
import type { CameraMove } from '../lib/layers'
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
    const { jobId } = await startLayerizeJob({
      userId: context.user.id,
      projectId: await ownedProjectId(data.projectId, context.user.id),
      imageUrl: data.imageUrl,
      sourceAssetId: data.sourceAssetId,
      prompt: data.prompt,
      maxLayers: data.maxLayers,
      textRecognition: data.textRecognition,
      sourceWidth: data.sourceWidth,
      sourceHeight: data.sourceHeight,
    })
    return { jobId }
  })

export const getLayerizeJobStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(jobIdSchema)
  .handler(async ({ data, context }) =>
    advanceLayerizeJob(data.jobId, context.user.id),
  )

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
    return {
      id: asset.id,
      url: asset.storageUrl,
      prompt: asset.prompt,
      projectId: asset.projectId,
      set,
    }
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
      const view = views.get(layer.z)
      const box: Box = layer.box ?? [0, 0, set.width, set.height]
      const place = placeOnCanvas(canvas, box, view?.dx ?? 0, view?.dy ?? 0)
      if (!place) continue
      // live text is drawn, not fetched
      const buf = layer.live
        ? Buffer.from(
            layerTextSvg(layer.live, place.width, place.height, {
              pixels: true,
            }),
          )
        : await fetchBuffer(layer.url)
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

const liveTextSchema = z.object({
  text: z.string().max(500),
  color: z.string().max(40).optional(),
  fontFamily: z.string().max(80).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
})

/**
 * Make a text layer editable (or turn it back into its pixels with `live:
 * null`). Free: the text is drawn by us, not re-rendered by a model.
 */
export const setLayerLiveTextFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      assetId: z.string(),
      z: z.number().int().min(1),
      live: liveTextSchema.nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { asset, metadata, set } = await loadSet(
      data.assetId,
      context.user.id,
    )
    layerAt(set, data.z)
    const next: LayerSet = {
      ...set,
      layers: set.layers.map((l) => {
        if (l.z !== data.z) return l
        const { live: _old, ...rest } = l
        return data.live ? { ...rest, live: data.live } : rest
      }),
    }
    await prisma.asset.update({
      where: { id: asset.id },
      data: { metadata: JSON.stringify({ ...metadata, layerSet: next }) },
    })
    return { set: next }
  })

const moveIds = CAMERA_MOVES.map((m) => m.id) as [
  CameraMove,
  ...Array<CameraMove>,
]

/**
 * Put a layer set on a project's timeline as one 2.5D shot: each visible
 * layer on its own video lane, live text on the overlay lanes, every layer
 * with its own camera (nearer layers move more). No fal cost.
 */
export const sendLayersToTimelineFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      assetId: z.string(),
      projectId: z.string(),
      durationSec: z.number().min(1).max(30),
      move: z.enum(moveIds),
      /** the viewer's current arrangement; saved on the set too */
      views: z.array(viewSchema).max(100).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { asset, metadata, set } = await loadSet(
      data.assetId,
      context.user.id,
    )
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { id: true, userId: true, name: true, fps: true, manifest: true },
    })
    if (!project || project.userId !== context.user.id) {
      throw new Error('Project not found')
    }
    const views = data.views
      ? Object.fromEntries(
          data.views.map((v) => [
            String(v.z),
            { visible: v.visible, dx: v.dx, dy: v.dy },
          ]),
        )
      : set.views
    const arranged: LayerSet = { ...set, views }
    const fps = project.fps || 30
    const placed = addLayerSetToManifest(
      migrateManifest(project.manifest),
      arranged,
      {
        durationFrames: Math.round(data.durationSec * fps),
        move: data.move,
        assetId: asset.id,
        label: asset.prompt?.slice(0, 40) || undefined,
      },
    )
    await prisma.project.update({
      where: { id: project.id },
      data: {
        manifest: JSON.stringify(placed.manifest),
        duration: sequenceEndFrame(placed.manifest),
      },
    })
    if (data.views) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          metadata: JSON.stringify({ ...metadata, layerSet: arranged }),
        },
      })
    }
    return {
      projectId: project.id,
      projectName: project.name,
      clips: placed.clipIds.length,
      startFrame: placed.startFrame,
    }
  })
