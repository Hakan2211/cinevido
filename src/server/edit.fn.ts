/**
 * Image Edit Server Functions
 *
 * Server functions for AI image editing operations:
 * - Prompt-based editing (describe what to change - no masks!)
 * - Upscaling (enhance resolution with AI)
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import {
  editImage,
  getEditJobStatus,
  getEditModels,
  getUpscaleModels,
  upscaleImage,
} from './services/edit.service'
import {
  UPSCALE_MODELS,
  getEditModelById,
  getModelById,
} from './services/types'
import { uploadFromUrl } from './services/bunny.service'

// =============================================================================
// Schemas
// =============================================================================

// Schema for prompt-based image editing (no mask required!)
const editSchema = z.object({
  imageUrls: z.array(z.string().url()).min(1).max(14), // Array of image URLs
  prompt: z.string().min(1).max(2000),
  model: z.string().optional(),
  sourceAssetIds: z.array(z.string()).optional(), // Original image asset IDs for linking
  projectId: z.string().optional(),
})

const upscaleSchema = z.object({
  imageUrl: z.string().url(),
  model: z.string().optional(),
  scale: z.number().min(1).max(10).optional(), // SeedVR supports up to 10x
  sourceAssetId: z.string().optional(),
  projectId: z.string().optional(),
  outputFormat: z.enum(['png', 'jpg', 'jpeg', 'webp']).optional(),

  // Legacy fields (for old models compatibility)
  creativity: z.number().min(0).max(1).optional(),
  prompt: z.string().max(500).optional(),

  // SeedVR specific options
  upscaleMode: z.enum(['factor', 'target']).optional(),
  targetResolution: z.enum(['720p', '1080p', '1440p', '2160p']).optional(),
  noiseScale: z.number().min(0).max(1).optional(),

  // Topaz specific options
  topazModel: z.string().optional(),
  subjectDetection: z.enum(['All', 'Foreground', 'Background']).optional(),
  faceEnhancement: z.boolean().optional(),
  faceEnhancementStrength: z.number().min(0).max(1).optional(),
  faceEnhancementCreativity: z.number().min(0).max(1).optional(),
})

const jobIdSchema = z.object({
  jobId: z.string(),
})

// =============================================================================
// Prompt-Based Image Editing
// =============================================================================

/**
 * Start an edit job - transform image(s) using natural language prompts
 * No masks required! Just describe what to change.
 */
export const editImageFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(editSchema)
  .handler(async ({ data, context }) => {
    console.log('[EDIT_FN] editImageFn called:', {
      userId: context.user.id,
      model: data.model,
      imageCount: data.imageUrls.length,
      promptPreview: data.prompt.slice(0, 50) + '...',
    })

    const modelId = data.model || 'fal-ai/flux-pro/kontext'
    const modelConfig = getEditModelById(modelId)

    if (!modelConfig) {
      console.error('[EDIT_FN] Unknown model:', modelId)
      throw new Error(`Unknown edit model: ${modelId}`)
    }

    // Validate image count against model's maxImages
    if (data.imageUrls.length > modelConfig.maxImages) {
      throw new Error(
        `Model ${modelConfig.name} supports max ${modelConfig.maxImages} image(s), got ${data.imageUrls.length}`,
      )
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

    // Start edit job
    console.log('[EDIT_FN] Starting edit job with editImage()...')
    const job = await editImage({
      imageUrls: data.imageUrls,
      prompt: data.prompt,
      model: modelId,
    })
    console.log('[EDIT_FN] Edit job started:', {
      requestId: job.requestId,
      status: job.status,
      statusUrl: job.statusUrl,
      responseUrl: job.responseUrl,
    })

    // Create job record - save statusUrl and responseUrl in input for later polling
    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId || null,
        type: 'edit',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          imageUrls: data.imageUrls,
          prompt: data.prompt,
          editType: 'edit',
          sourceAssetIds: data.sourceAssetIds,
          // Save fal.ai queue URLs for status polling - DO NOT construct these from modelId!
          statusUrl: job.statusUrl,
          responseUrl: job.responseUrl,
        }),
        externalId: job.requestId,
        creditsUsed: modelConfig.credits,
      },
    })
    console.log('[EDIT_FN] DB job created:', {
      dbJobId: dbJob.id,
      externalId: job.requestId,
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
      editType: 'edit',
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
    const modelId = data.model || 'fal-ai/seedvr/upscale/image'
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

    // Start upscale job with all new parameters
    const job = await upscaleImage({
      imageUrl: data.imageUrl,
      model: modelId,
      scale: data.scale,
      outputFormat: data.outputFormat,
      // Legacy
      creativity: data.creativity,
      prompt: data.prompt,
      // SeedVR specific
      upscaleMode: data.upscaleMode,
      targetResolution: data.targetResolution,
      noiseScale: data.noiseScale,
      // Topaz specific
      topazModel: data.topazModel,
      subjectDetection: data.subjectDetection,
      faceEnhancement: data.faceEnhancement,
      faceEnhancementStrength: data.faceEnhancementStrength,
      faceEnhancementCreativity: data.faceEnhancementCreativity,
    })
    console.log('[EDIT_FN] Upscale job started:', {
      requestId: job.requestId,
      statusUrl: job.statusUrl,
      responseUrl: job.responseUrl,
      model: modelId,
    })

    // Create job record - save all parameters for reference
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
          editType: 'upscale',
          sourceAssetId: data.sourceAssetId,
          // Model-specific params
          upscaleMode: data.upscaleMode,
          targetResolution: data.targetResolution,
          noiseScale: data.noiseScale,
          topazModel: data.topazModel,
          subjectDetection: data.subjectDetection,
          faceEnhancement: data.faceEnhancement,
          // Save fal.ai queue URLs for status polling
          statusUrl: job.statusUrl,
          responseUrl: job.responseUrl,
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
// Job Status
// =============================================================================

/**
 * Check the status of an edit job (edit, upscale, variation)
 */
export const getEditJobStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(jobIdSchema)
  .handler(async ({ data, context }) => {
    console.log('[EDIT_FN] getEditJobStatusFn called:', { jobId: data.jobId })

    const job = await prisma.generationJob.findUnique({
      where: { id: data.jobId },
    })

    if (!job) {
      console.error('[EDIT_FN] Job not found:', data.jobId)
      throw new Error('Job not found')
    }

    console.log('[EDIT_FN] Found job:', {
      id: job.id,
      status: job.status,
      externalId: job.externalId,
      model: job.model,
    })

    if (job.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    // If already completed or failed, return cached result
    if (job.status === 'completed' || job.status === 'failed') {
      console.log('[EDIT_FN] Returning cached result, status:', job.status)
      return {
        jobId: job.id,
        status: job.status,
        progress: job.status === 'completed' ? 100 : 0,
        output: job.output ? JSON.parse(job.output) : null,
        error: job.error,
      }
    }

    // Poll Fal.ai for status using the saved URLs
    if (!job.externalId) {
      console.error('[EDIT_FN] Job has no external ID!')
      throw new Error('Job has no external ID')
    }

    // Get statusUrl and responseUrl from saved input
    const inputData = JSON.parse(job.input)
    const { statusUrl, responseUrl } = inputData

    if (!statusUrl || !responseUrl) {
      console.error(
        '[EDIT_FN] Job missing statusUrl or responseUrl in input!',
        {
          statusUrl,
          responseUrl,
        },
      )
      throw new Error(
        'Job is missing fal.ai queue URLs. This job may have been created before the fix was applied.',
      )
    }

    console.log('[EDIT_FN] Polling fal.ai for status using saved URLs...')
    const falStatus = await getEditJobStatus(statusUrl, responseUrl)
    console.log('[EDIT_FN] fal.ai status result:', {
      status: falStatus.status,
      hasResult: !!falStatus.result,
    })

    // Update job status in database
    if (falStatus.status === 'completed' && falStatus.result) {
      console.log('[EDIT_FN] Job completed! Processing result...')
      const result = falStatus.result
      // Handle both 'images' array and single 'image' response formats
      const falTempUrl = result.images?.[0]?.url || result.image?.url
      const imageWidth = result.images?.[0]?.width || result.image?.width
      const imageHeight = result.images?.[0]?.height || result.image?.height

      console.log('[EDIT_FN] Extracted from result:', {
        falTempUrl: falTempUrl?.slice(0, 80) + '...',
        imageWidth,
        imageHeight,
      })

      if (falTempUrl) {
        // inputData already parsed above
        const filename = `${inputData.editType}-${Date.now()}.png`

        // Upload the edited image from FAL's temporary URL to Bunny CDN
        let permanentUrl = falTempUrl

        console.log('[EDIT_FN] Uploading to Bunny CDN...')
        try {
          const uploadResult = await uploadFromUrl(falTempUrl, {
            folder: `images/${context.user.id}`,
            filename,
          })
          permanentUrl = uploadResult.url
          console.log('[EDIT_FN] Bunny upload success:', permanentUrl)
        } catch (uploadError) {
          // Log error but continue - we'll fall back to FAL's URL
          console.error('[EDIT_FN] Failed to upload to Bunny CDN:', uploadError)
          console.log('[EDIT_FN] Falling back to FAL temp URL')
        }

        // Create asset for the edited image with permanent CDN URL
        console.log('[EDIT_FN] Creating asset in DB...')
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
        console.log('[EDIT_FN] Asset created:', asset.id)

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
        console.log('[EDIT_FN] Job marked as completed')

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
      console.error('[EDIT_FN] Job failed!', falStatus.error)
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

    console.log('[EDIT_FN] Job still in progress:', {
      falStatus: falStatus.status,
      progress,
    })

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
 * Get all edit-related models (combined)
 */
export const getAllEditModelsFn = createServerFn({ method: 'GET' }).handler(
  () => {
    return {
      edit: getEditModels(),
      upscale: getUpscaleModels(),
    }
  },
)
