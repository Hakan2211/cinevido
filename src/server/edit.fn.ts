/**
 * Image Edit Server Functions
 *
 * Server functions for AI image editing operations:
 * - Inpainting (edit masked regions)
 * - Outpainting (expand image beyond borders)
 * - Upscaling (enhance resolution with AI)
 * - Variations (create variations from reference)
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import {
  createVariation,
  getEditJobStatus,
  getEditModels,
  getUpscaleModels,
  getVariationModels,
  inpaintImage,
  outpaintImage,
  upscaleImage,
} from './services/edit.service'
import {
  EDIT_MODELS,
  UPSCALE_MODELS,
  VARIATION_MODELS,
  getModelById,
} from './services/types'
import { uploadFromUrl } from './services/bunny.service'
import type { FalEditResult } from './services/edit.service'

// =============================================================================
// Schemas
// =============================================================================

const inpaintSchema = z.object({
  imageUrl: z.string().url(),
  maskUrl: z.string().url(), // Base64 data URL or hosted URL
  prompt: z.string().min(1).max(2000),
  model: z.string().optional(),
  sourceAssetId: z.string().optional(), // Original image asset ID for linking
  projectId: z.string().optional(),
})

const outpaintSchema = z.object({
  imageUrl: z.string().url(),
  prompt: z.string().min(1).max(2000),
  model: z.string().optional(),
  top: z.number().min(0).max(1024).optional(),
  bottom: z.number().min(0).max(1024).optional(),
  left: z.number().min(0).max(1024).optional(),
  right: z.number().min(0).max(1024).optional(),
  sourceAssetId: z.string().optional(),
  projectId: z.string().optional(),
})

const upscaleSchema = z.object({
  imageUrl: z.string().url(),
  model: z.string().optional(),
  scale: z.number().min(2).max(4).optional(),
  creativity: z.number().min(0).max(1).optional(),
  prompt: z.string().max(500).optional(),
  sourceAssetId: z.string().optional(),
  projectId: z.string().optional(),
})

const variationSchema = z.object({
  imageUrl: z.string().url(),
  prompt: z.string().max(2000).optional(),
  model: z.string().optional(),
  strength: z.number().min(0).max(1).optional(), // How different from original
  sourceAssetId: z.string().optional(),
  projectId: z.string().optional(),
})

const jobIdSchema = z.object({
  jobId: z.string(),
})

// =============================================================================
// Inpainting
// =============================================================================

/**
 * Start an inpainting job - edit masked regions of an image
 */
export const inpaintImageFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(inpaintSchema)
  .handler(async ({ data, context }) => {
    const modelId = data.model || 'fal-ai/flux-pro/v1/fill'
    const modelConfig = getModelById(modelId, EDIT_MODELS)

    if (!modelConfig) {
      throw new Error(`Unknown edit model: ${modelId}`)
    }

    // Check user credits (admins have unlimited)
    const isAdmin = context.user.role === 'admin'
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { credits: true },
    })

    if (!isAdmin && (!user || user.credits < modelConfig.credits)) {
      throw new Error(
        `Insufficient credits. Required: ${modelConfig.credits}, Available: ${user?.credits || 0}`,
      )
    }

    // Start inpaint job
    const job = await inpaintImage({
      imageUrl: data.imageUrl,
      maskUrl: data.maskUrl,
      prompt: data.prompt,
      model: modelId,
    })

    // Create job record
    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId || null,
        type: 'edit',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          imageUrl: data.imageUrl,
          maskUrl: data.maskUrl,
          prompt: data.prompt,
          editType: 'inpaint',
          sourceAssetId: data.sourceAssetId,
        }),
        externalId: job.requestId,
        creditsUsed: modelConfig.credits,
      },
    })

    // Deduct credits (skip for admins)
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: context.user.id },
        data: { credits: { decrement: modelConfig.credits } },
      })
    }

    return {
      jobId: dbJob.id,
      externalId: job.requestId,
      model: modelId,
      editType: 'inpaint',
      credits: modelConfig.credits,
      status: 'pending',
    }
  })

// =============================================================================
// Outpainting
// =============================================================================

/**
 * Start an outpainting job - expand image beyond borders
 */
export const outpaintImageFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(outpaintSchema)
  .handler(async ({ data, context }) => {
    const modelId = data.model || 'fal-ai/flux-pro/v1/fill'
    const modelConfig = getModelById(modelId, EDIT_MODELS)

    if (!modelConfig) {
      throw new Error(`Unknown edit model: ${modelId}`)
    }

    // Check user credits (admins have unlimited)
    const isAdmin = context.user.role === 'admin'
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { credits: true },
    })

    if (!isAdmin && (!user || user.credits < modelConfig.credits)) {
      throw new Error(
        `Insufficient credits. Required: ${modelConfig.credits}, Available: ${user?.credits || 0}`,
      )
    }

    // Start outpaint job
    const job = await outpaintImage({
      imageUrl: data.imageUrl,
      prompt: data.prompt,
      model: modelId,
      top: data.top,
      bottom: data.bottom,
      left: data.left,
      right: data.right,
    })

    // Create job record
    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId || null,
        type: 'edit',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          imageUrl: data.imageUrl,
          prompt: data.prompt,
          editType: 'outpaint',
          top: data.top,
          bottom: data.bottom,
          left: data.left,
          right: data.right,
          sourceAssetId: data.sourceAssetId,
        }),
        externalId: job.requestId,
        creditsUsed: modelConfig.credits,
      },
    })

    // Deduct credits (skip for admins)
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: context.user.id },
        data: { credits: { decrement: modelConfig.credits } },
      })
    }

    return {
      jobId: dbJob.id,
      externalId: job.requestId,
      model: modelId,
      editType: 'outpaint',
      credits: modelConfig.credits,
      status: 'pending',
    }
  })

// =============================================================================
// Upscaling
// =============================================================================

/**
 * Start an upscale job - enhance image resolution with AI
 */
export const upscaleImageFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(upscaleSchema)
  .handler(async ({ data, context }) => {
    const modelId = data.model || 'fal-ai/creative-upscaler'
    const modelConfig = getModelById(modelId, UPSCALE_MODELS)

    if (!modelConfig) {
      throw new Error(`Unknown upscale model: ${modelId}`)
    }

    // Check user credits (admins have unlimited)
    const isAdmin = context.user.role === 'admin'
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { credits: true },
    })

    if (!isAdmin && (!user || user.credits < modelConfig.credits)) {
      throw new Error(
        `Insufficient credits. Required: ${modelConfig.credits}, Available: ${user?.credits || 0}`,
      )
    }

    // Start upscale job
    const job = await upscaleImage({
      imageUrl: data.imageUrl,
      model: modelId,
      scale: data.scale,
      creativity: data.creativity,
      prompt: data.prompt,
    })

    // Create job record
    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId || null,
        type: 'upscale',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          imageUrl: data.imageUrl,
          scale: data.scale || 2,
          creativity: data.creativity,
          prompt: data.prompt,
          editType: 'upscale',
          sourceAssetId: data.sourceAssetId,
        }),
        externalId: job.requestId,
        creditsUsed: modelConfig.credits,
      },
    })

    // Deduct credits (skip for admins)
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: context.user.id },
        data: { credits: { decrement: modelConfig.credits } },
      })
    }

    return {
      jobId: dbJob.id,
      externalId: job.requestId,
      model: modelId,
      editType: 'upscale',
      credits: modelConfig.credits,
      status: 'pending',
    }
  })

// =============================================================================
// Variations
// =============================================================================

/**
 * Start a variation job - create variations of an image
 */
export const createVariationFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(variationSchema)
  .handler(async ({ data, context }) => {
    const modelId = data.model || 'fal-ai/flux-pro/v1.1/redux'
    const modelConfig = getModelById(modelId, VARIATION_MODELS)

    if (!modelConfig) {
      throw new Error(`Unknown variation model: ${modelId}`)
    }

    // Check user credits (admins have unlimited)
    const isAdmin = context.user.role === 'admin'
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { credits: true },
    })

    if (!isAdmin && (!user || user.credits < modelConfig.credits)) {
      throw new Error(
        `Insufficient credits. Required: ${modelConfig.credits}, Available: ${user?.credits || 0}`,
      )
    }

    // Start variation job
    const job = await createVariation({
      imageUrl: data.imageUrl,
      prompt: data.prompt,
      model: modelId,
      strength: data.strength,
    })

    // Create job record
    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId || null,
        type: 'variation',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          imageUrl: data.imageUrl,
          prompt: data.prompt,
          strength: data.strength,
          editType: 'variation',
          sourceAssetId: data.sourceAssetId,
        }),
        externalId: job.requestId,
        creditsUsed: modelConfig.credits,
      },
    })

    // Deduct credits (skip for admins)
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: context.user.id },
        data: { credits: { decrement: modelConfig.credits } },
      })
    }

    return {
      jobId: dbJob.id,
      externalId: job.requestId,
      model: modelId,
      editType: 'variation',
      credits: modelConfig.credits,
      status: 'pending',
    }
  })

// =============================================================================
// Job Status
// =============================================================================

/**
 * Check the status of an edit job (inpaint, outpaint, upscale, variation)
 */
export const getEditJobStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(jobIdSchema)
  .handler(async ({ data, context }) => {
    const job = await prisma.generationJob.findUnique({
      where: { id: data.jobId },
    })

    if (!job) {
      throw new Error('Job not found')
    }

    if (job.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    // If already completed or failed, return cached result
    if (job.status === 'completed' || job.status === 'failed') {
      return {
        jobId: job.id,
        status: job.status,
        progress: job.status === 'completed' ? 100 : 0,
        output: job.output ? JSON.parse(job.output) : null,
        error: job.error,
      }
    }

    // Poll Fal.ai for status
    if (!job.externalId) {
      throw new Error('Job has no external ID')
    }

    const falStatus = await getEditJobStatus(job.externalId, job.model)

    // Update job status in database
    if (falStatus.status === 'completed' && falStatus.result) {
      const result = falStatus.result
      // Handle both 'images' array and single 'image' response formats
      const falTempUrl = result.images?.[0]?.url || result.image?.url
      const imageWidth = result.images?.[0]?.width || result.image?.width
      const imageHeight = result.images?.[0]?.height || result.image?.height

      if (falTempUrl) {
        const inputData = JSON.parse(job.input)
        const filename = `${inputData.editType}-${Date.now()}.png`

        // Upload the edited image from FAL's temporary URL to Bunny CDN
        let permanentUrl = falTempUrl

        try {
          const uploadResult = await uploadFromUrl(falTempUrl, {
            folder: `images/${context.user.id}`,
            filename,
          })
          permanentUrl = uploadResult.url
        } catch (uploadError) {
          // Log error but continue - we'll fall back to FAL's URL
          console.error('Failed to upload to Bunny CDN:', uploadError)
        }

        // Create asset for the edited image with permanent CDN URL
        const asset = await prisma.asset.create({
          data: {
            userId: context.user.id,
            projectId: job.projectId,
            type: 'image',
            storageUrl: permanentUrl,
            filename,
            prompt: inputData.prompt || null,
            provider: 'fal',
            model: job.model,
            metadata: JSON.stringify({
              width: imageWidth,
              height: imageHeight,
              seed: result.seed,
              editType: inputData.editType,
              sourceAssetId: inputData.sourceAssetId,
            }),
          },
        })

        // Update job as completed
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            progress: 100,
            output: JSON.stringify({
              url: permanentUrl,
              assetId: asset.id,
              width: imageWidth,
              height: imageHeight,
              editType: inputData.editType,
            }),
          },
        })

        return {
          jobId: job.id,
          status: 'completed' as const,
          progress: 100,
          output: {
            url: permanentUrl,
            assetId: asset.id,
            width: imageWidth,
            height: imageHeight,
            editType: inputData.editType,
          },
        }
      }
    }

    if (falStatus.status === 'failed') {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: falStatus.error || 'Edit operation failed',
        },
      })

      return {
        jobId: job.id,
        status: 'failed' as const,
        progress: 0,
        error: falStatus.error || 'Edit operation failed',
      }
    }

    // Still processing
    const progress =
      falStatus.progress || (falStatus.status === 'processing' ? 50 : 10)

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: falStatus.status === 'processing' ? 'processing' : 'pending',
        progress,
      },
    })

    return {
      jobId: job.id,
      status: falStatus.status === 'processing' ? 'processing' : 'pending',
      progress,
    }
  })

// =============================================================================
// Model Info
// =============================================================================

/**
 * Get available edit models (inpainting/outpainting)
 */
export const getEditModelsFn = createServerFn({ method: 'GET' }).handler(() => {
  return {
    models: getEditModels(),
  }
})

/**
 * Get available upscale models
 */
export const getUpscaleModelsFn = createServerFn({ method: 'GET' }).handler(
  () => {
    return {
      models: getUpscaleModels(),
    }
  },
)

/**
 * Get available variation models
 */
export const getVariationModelsFn = createServerFn({ method: 'GET' }).handler(
  () => {
    return {
      models: getVariationModels(),
    }
  },
)

/**
 * Get all edit-related models (combined)
 */
export const getAllEditModelsFn = createServerFn({ method: 'GET' }).handler(
  () => {
    return {
      edit: getEditModels(),
      upscale: getUpscaleModels(),
      variation: getVariationModels(),
    }
  },
)
