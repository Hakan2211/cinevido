/**
 * 3D Model Server Functions
 *
 * Server functions for AI 3D model generation using Fal.ai.
 * Supports text-to-3D, image-to-3D, and image-to-world generation.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import {
  generate3DModel,
  getJobStatus,
  cancelJob,
} from './services/fal.service'
import { uploadFromUrl } from './services/bunny.service'
import { get3DModelById } from './services/types'
import type { Fal3DModelResult } from './services/fal.service'

// =============================================================================
// Schemas
// =============================================================================

const generate3DModelSchema = z.object({
  modelId: z.string(),
  mode: z.enum(['text-to-3d', 'image-to-3d', 'image-to-world']),

  // Common
  prompt: z.string().optional(),
  seed: z.number().optional(),

  // Image inputs
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  backImageUrl: z.string().optional(),
  leftImageUrl: z.string().optional(),
  rightImageUrl: z.string().optional(),

  // Mesh controls
  enablePbr: z.boolean().optional(),
  faceCount: z.number().min(40000).max(1500000).optional(),
  generateType: z.enum(['Normal', 'LowPoly', 'Geometry']).optional(),
  polygonType: z.enum(['triangle', 'quadrilateral']).optional(),
  topology: z.enum(['quad', 'triangle']).optional(),
  targetPolycount: z.number().optional(),
  shouldRemesh: z.boolean().optional(),
  symmetryMode: z.enum(['off', 'auto', 'on']).optional(),

  // Meshy-specific
  meshyMode: z.enum(['preview', 'full']).optional(),
  artStyle: z.enum(['realistic', 'sculpture']).optional(),
  shouldTexture: z.boolean().optional(),
  enablePromptExpansion: z.boolean().optional(),
  texturePrompt: z.string().optional(),
  textureImageUrl: z.string().optional(),
  isATpose: z.boolean().optional(),

  // Rodin-specific
  geometryFileFormat: z.enum(['glb', 'usdz', 'fbx', 'obj', 'stl']).optional(),
  material: z.enum(['PBR', 'Shaded', 'All']).optional(),
  qualityMeshOption: z.string().optional(),
  useOriginalAlpha: z.boolean().optional(),
  addons: z.enum(['HighPack']).optional(),
  previewRender: z.boolean().optional(),

  // SAM-specific
  maskUrls: z.array(z.string()).optional(),
  samPrompt: z.string().optional(),
  pointPrompts: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        label: z.union([z.literal(0), z.literal(1)]),
        objectId: z.number().optional(),
      }),
    )
    .optional(),
  boxPrompts: z
    .array(
      z.object({
        xMin: z.number(),
        yMin: z.number(),
        xMax: z.number(),
        yMax: z.number(),
        objectId: z.number().optional(),
      }),
    )
    .optional(),
  exportMeshes: z.boolean().optional(),
  include3dKeypoints: z.boolean().optional(),
  exportTexturedGlb: z.boolean().optional(),

  // Hunyuan World
  labelsFg1: z.string().optional(),
  labelsFg2: z.string().optional(),
  classes: z.string().optional(),
  exportDrc: z.boolean().optional(),
})

const list3DModelsSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  mode: z.enum(['text-to-3d', 'image-to-3d', 'image-to-world']).optional(),
})

const assetIdSchema = z.object({
  assetId: z.string(),
})

// =============================================================================
// 3D Model Generation
// =============================================================================

/**
 * Start a 3D model generation job
 * Returns asset ID for polling status
 */
export const generate3DModelFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(generate3DModelSchema)
  .handler(async ({ data, context }) => {
    console.log('[3D] generate3DModelFn called:', {
      modelId: data.modelId,
      mode: data.mode,
      prompt: data.prompt?.slice(0, 50),
      userId: context.user.id,
    })

    const modelConfig = get3DModelById(data.modelId)

    if (!modelConfig) {
      console.error('[3D] Unknown model:', data.modelId)
      throw new Error(`Unknown 3D model: ${data.modelId}`)
    }

    // Calculate credits to charge
    const creditsToCharge = modelConfig.credits

    // Check user credits (admins have unlimited)
    const isAdmin = context.user.role === 'admin'
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { credits: true },
    })

    console.log(
      '[3D] User credits:',
      user?.credits,
      'Required:',
      creditsToCharge,
      'isAdmin:',
      isAdmin,
    )

    if (!isAdmin && (!user || user.credits < creditsToCharge)) {
      console.error('[3D] Insufficient credits')
      throw new Error(
        `Insufficient credits. Required: ${creditsToCharge}, Available: ${user?.credits || 0}`,
      )
    }

    // Start generation job via Fal.ai
    console.log('[3D] Starting FAL 3D generation job...')
    const job = await generate3DModel({
      modelId: data.modelId,
      prompt: data.prompt,
      seed: data.seed,
      imageUrl: data.imageUrl,
      imageUrls: data.imageUrls,
      backImageUrl: data.backImageUrl,
      leftImageUrl: data.leftImageUrl,
      rightImageUrl: data.rightImageUrl,
      enablePbr: data.enablePbr,
      faceCount: data.faceCount,
      generateType: data.generateType,
      polygonType: data.polygonType,
      topology: data.topology,
      targetPolycount: data.targetPolycount,
      shouldRemesh: data.shouldRemesh,
      symmetryMode: data.symmetryMode,
      mode: data.meshyMode,
      artStyle: data.artStyle,
      shouldTexture: data.shouldTexture,
      enablePromptExpansion: data.enablePromptExpansion,
      texturePrompt: data.texturePrompt,
      textureImageUrl: data.textureImageUrl,
      isATpose: data.isATpose,
      geometryFileFormat: data.geometryFileFormat,
      material: data.material,
      qualityMeshOption: data.qualityMeshOption,
      useOriginalAlpha: data.useOriginalAlpha,
      addons: data.addons,
      previewRender: data.previewRender,
      maskUrls: data.maskUrls,
      samPrompt: data.samPrompt,
      pointPrompts: data.pointPrompts,
      boxPrompts: data.boxPrompts,
      exportMeshes: data.exportMeshes,
      include3dKeypoints: data.include3dKeypoints,
      exportTexturedGlb: data.exportTexturedGlb,
      labelsFg1: data.labelsFg1,
      labelsFg2: data.labelsFg2,
      classes: data.classes,
      exportDrc: data.exportDrc,
    })
    console.log('[3D] FAL job created:', job)

    // Create asset record in database with Fal.ai URLs for status polling
    const asset = await prisma.model3DAsset.create({
      data: {
        userId: context.user.id,
        modelId: data.modelId,
        endpoint: modelConfig.endpoint,
        mode: data.mode,
        prompt: data.prompt,
        sourceImageUrls: data.imageUrls
          ? JSON.stringify(data.imageUrls)
          : data.imageUrl
            ? JSON.stringify([data.imageUrl])
            : null,
        settings: JSON.stringify({
          enablePbr: data.enablePbr,
          faceCount: data.faceCount,
          generateType: data.generateType,
          topology: data.topology,
          targetPolycount: data.targetPolycount,
        }),
        status: 'pending',
        requestId: job.requestId,
        statusUrl: job.statusUrl,
        responseUrl: job.responseUrl,
        cancelUrl: job.cancelUrl,
        creditsUsed: creditsToCharge,
      },
    })
    console.log('[3D] Asset record created:', asset.id)

    // Deduct credits (unless admin)
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: context.user.id },
        data: { credits: { decrement: creditsToCharge } },
      })
      console.log('[3D] Deducted', creditsToCharge, 'credits')
    }

    return {
      assetId: asset.id,
      status: 'pending',
      creditsUsed: creditsToCharge,
    }
  })

/**
 * Check the status of a 3D generation job and update on completion
 */
export const get3DModelStatusFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(assetIdSchema)
  .handler(async ({ data, context }) => {
    console.log('[3D] get3DModelStatusFn called:', data.assetId)

    const asset = await prisma.model3DAsset.findUnique({
      where: { id: data.assetId },
    })

    if (!asset) {
      throw new Error('Asset not found')
    }

    if (asset.userId !== context.user.id && context.user.role !== 'admin') {
      throw new Error('Unauthorized')
    }

    // If already completed or failed, return current status
    if (asset.status === 'completed' || asset.status === 'failed') {
      return {
        status: asset.status,
        modelGlbUrl: asset.modelGlbUrl,
        thumbnailUrl: asset.thumbnailUrl,
        modelUrls: asset.modelUrls ? JSON.parse(asset.modelUrls) : null,
        error: asset.error,
      }
    }

    // Poll Fal.ai for status
    if (!asset.statusUrl || !asset.responseUrl) {
      throw new Error('Missing status URLs')
    }

    const statusResult = await getJobStatus(asset.statusUrl, asset.responseUrl)
    console.log('[3D] Status result:', statusResult.status)

    // Update progress if available
    if (statusResult.progress !== undefined) {
      await prisma.model3DAsset.update({
        where: { id: asset.id },
        data: { progress: statusResult.progress },
      })
    }

    // Handle completion
    if (statusResult.status === 'completed' && statusResult.result) {
      console.log('[3D] Job completed, processing result...')

      const result = statusResult.result as Fal3DModelResult

      // Extract URLs from result based on model output format
      let modelGlbUrl: string | null = null
      let thumbnailUrl: string | null = null
      let worldFileUrl: string | null = null
      let gaussianSplatUrl: string | null = null
      const modelUrls: Record<string, string> = {}
      const textureUrls: Array<Record<string, string>> = []

      // Common outputs
      if (result.model_glb?.url) {
        modelGlbUrl = result.model_glb.url
        modelUrls.glb = result.model_glb.url
      }
      if (result.thumbnail?.url) {
        thumbnailUrl = result.thumbnail.url
      }
      if (result.model_urls) {
        if (result.model_urls.glb?.url)
          modelUrls.glb = result.model_urls.glb.url
        if (result.model_urls.obj?.url)
          modelUrls.obj = result.model_urls.obj.url
        if (result.model_urls.fbx?.url)
          modelUrls.fbx = result.model_urls.fbx.url
        if (result.model_urls.usdz?.url)
          modelUrls.usdz = result.model_urls.usdz.url
        if (result.model_urls.stl?.url)
          modelUrls.stl = result.model_urls.stl.url
      }
      if (result.texture_urls) {
        for (const tex of result.texture_urls) {
          const texObj: Record<string, string> = {}
          if (tex.base_color?.url) texObj.base_color = tex.base_color.url
          if (tex.metallic?.url) texObj.metallic = tex.metallic.url
          if (tex.normal?.url) texObj.normal = tex.normal.url
          if (tex.roughness?.url) texObj.roughness = tex.roughness.url
          if (Object.keys(texObj).length > 0) {
            textureUrls.push(texObj)
          }
        }
      }

      // Rodin specific
      if (result.model_mesh?.url) {
        modelGlbUrl = result.model_mesh.url
        modelUrls.glb = result.model_mesh.url
      }

      // Bytedance Seed3D specific
      if (result.model?.url) {
        modelGlbUrl = result.model.url
        modelUrls.glb = result.model.url
      }

      // SAM 3D Objects specific
      if (result.gaussian_splat?.url) {
        gaussianSplatUrl = result.gaussian_splat.url
      }

      // Hunyuan World specific
      if (result.world_file?.url) {
        worldFileUrl = result.world_file.url
      }

      // Upload GLB to Bunny CDN for permanent storage
      let permanentGlbUrl = modelGlbUrl
      if (modelGlbUrl) {
        try {
          const uploadResult = await uploadFromUrl(modelGlbUrl, {
            folder: `3d-models/${context.user.id}`,
            filename: `model-${asset.id}.glb`,
          })
          permanentGlbUrl = uploadResult.url
          modelUrls.glb = uploadResult.url
          console.log('[3D] Uploaded GLB to Bunny:', permanentGlbUrl)
        } catch (err) {
          console.error('[3D] Failed to upload GLB to Bunny:', err)
          // Continue with fal.ai URL as fallback
        }
      }

      // Upload thumbnail to Bunny CDN
      let permanentThumbnailUrl = thumbnailUrl
      if (thumbnailUrl) {
        try {
          const uploadResult = await uploadFromUrl(thumbnailUrl, {
            folder: `3d-models/${context.user.id}`,
            filename: `thumbnail-${asset.id}.png`,
          })
          permanentThumbnailUrl = uploadResult.url
          console.log(
            '[3D] Uploaded thumbnail to Bunny:',
            permanentThumbnailUrl,
          )
        } catch (err) {
          console.error('[3D] Failed to upload thumbnail to Bunny:', err)
        }
      }

      // Update asset with completed data
      await prisma.model3DAsset.update({
        where: { id: asset.id },
        data: {
          status: 'completed',
          modelGlbUrl: permanentGlbUrl,
          thumbnailUrl: permanentThumbnailUrl,
          modelUrls:
            Object.keys(modelUrls).length > 0
              ? JSON.stringify(modelUrls)
              : null,
          textureUrls:
            textureUrls.length > 0 ? JSON.stringify(textureUrls) : null,
          worldFileUrl,
          gaussianSplatUrl,
          seed: result.seed,
          progress: 100,
        },
      })

      return {
        status: 'completed',
        modelGlbUrl: permanentGlbUrl,
        thumbnailUrl: permanentThumbnailUrl,
        modelUrls,
        worldFileUrl,
        gaussianSplatUrl,
      }
    }

    // Handle failure
    if (statusResult.status === 'failed') {
      console.log('[3D] Job failed:', statusResult.error)

      // Refund credits on failure
      const isAdmin = context.user.role === 'admin'
      if (!isAdmin && asset.creditsUsed > 0) {
        await prisma.user.update({
          where: { id: context.user.id },
          data: { credits: { increment: asset.creditsUsed } },
        })
        console.log('[3D] Refunded', asset.creditsUsed, 'credits')
      }

      await prisma.model3DAsset.update({
        where: { id: asset.id },
        data: {
          status: 'failed',
          error: statusResult.error || 'Generation failed',
        },
      })

      return {
        status: 'failed',
        error: statusResult.error || 'Generation failed',
      }
    }

    // Still processing
    return {
      status: statusResult.status === 'pending' ? 'pending' : 'processing',
      progress: statusResult.progress,
    }
  })

/**
 * Cancel a pending 3D generation job
 */
export const cancel3DModelJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(assetIdSchema)
  .handler(async ({ data, context }) => {
    console.log('[3D] cancel3DModelJobFn called:', data.assetId)

    const asset = await prisma.model3DAsset.findUnique({
      where: { id: data.assetId },
    })

    if (!asset) {
      throw new Error('Asset not found')
    }

    if (asset.userId !== context.user.id && context.user.role !== 'admin') {
      throw new Error('Unauthorized')
    }

    if (asset.status !== 'pending' && asset.status !== 'processing') {
      throw new Error('Cannot cancel completed or failed job')
    }

    // Cancel via Fal.ai
    if (asset.cancelUrl) {
      await cancelJob(asset.cancelUrl)
    }

    // Refund credits
    const isAdmin = context.user.role === 'admin'
    if (!isAdmin && asset.creditsUsed > 0) {
      await prisma.user.update({
        where: { id: context.user.id },
        data: { credits: { increment: asset.creditsUsed } },
      })
      console.log('[3D] Refunded', asset.creditsUsed, 'credits on cancel')
    }

    // Update asset status
    await prisma.model3DAsset.update({
      where: { id: asset.id },
      data: {
        status: 'failed',
        error: 'Cancelled by user',
      },
    })

    return { success: true }
  })

/**
 * List user's 3D model assets
 */
export const listUser3DModelsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(list3DModelsSchema)
  .handler(async ({ data, context }) => {
    const limit = data?.limit || 20
    const offset = data?.offset || 0

    const where: { userId: string; mode?: string } = {
      userId: context.user.id,
    }

    if (data?.mode) {
      where.mode = data.mode
    }

    const [assets, total] = await Promise.all([
      prisma.model3DAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.model3DAsset.count({ where }),
    ])

    return {
      assets: assets.map((asset) => ({
        id: asset.id,
        modelId: asset.modelId,
        mode: asset.mode,
        prompt: asset.prompt,
        status: asset.status,
        modelGlbUrl: asset.modelGlbUrl,
        thumbnailUrl: asset.thumbnailUrl,
        modelUrls: asset.modelUrls ? JSON.parse(asset.modelUrls) : null,
        error: asset.error,
        progress: asset.progress,
        createdAt: asset.createdAt,
      })),
      total,
      hasMore: offset + assets.length < total,
    }
  })

/**
 * Get a single 3D model asset
 */
export const get3DModelFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(assetIdSchema)
  .handler(async ({ data, context }) => {
    const asset = await prisma.model3DAsset.findUnique({
      where: { id: data.assetId },
    })

    if (!asset) {
      throw new Error('Asset not found')
    }

    if (asset.userId !== context.user.id && context.user.role !== 'admin') {
      throw new Error('Unauthorized')
    }

    return {
      id: asset.id,
      modelId: asset.modelId,
      endpoint: asset.endpoint,
      mode: asset.mode,
      prompt: asset.prompt,
      sourceImageUrls: asset.sourceImageUrls
        ? JSON.parse(asset.sourceImageUrls)
        : null,
      settings: asset.settings ? JSON.parse(asset.settings) : null,
      status: asset.status,
      modelGlbUrl: asset.modelGlbUrl,
      thumbnailUrl: asset.thumbnailUrl,
      modelUrls: asset.modelUrls ? JSON.parse(asset.modelUrls) : null,
      textureUrls: asset.textureUrls ? JSON.parse(asset.textureUrls) : null,
      worldFileUrl: asset.worldFileUrl,
      gaussianSplatUrl: asset.gaussianSplatUrl,
      error: asset.error,
      progress: asset.progress,
      seed: asset.seed,
      creditsUsed: asset.creditsUsed,
      createdAt: asset.createdAt,
    }
  })

/**
 * Delete a 3D model asset
 */
export const delete3DModelFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(assetIdSchema)
  .handler(async ({ data, context }) => {
    console.log('[3D] delete3DModelFn called:', data.assetId)

    const asset = await prisma.model3DAsset.findUnique({
      where: { id: data.assetId },
    })

    if (!asset) {
      throw new Error('Asset not found')
    }

    if (asset.userId !== context.user.id && context.user.role !== 'admin') {
      throw new Error('Unauthorized')
    }

    // Delete from database
    await prisma.model3DAsset.delete({
      where: { id: data.assetId },
    })

    // Note: We could also delete from Bunny CDN here, but for now we'll leave the files
    // as they may be useful for debugging or recovery

    return { success: true }
  })
