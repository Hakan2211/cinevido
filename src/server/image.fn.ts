/**
 * Image Server Functions
 *
 * Server functions for AI image generation using Fal.ai.
 * Handles generation jobs, asset creation, and user image library.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import {
  generateImage,
  getImageModels,
  getJobStatus,
} from './services/fal.service'
import { uploadFromUrl } from './services/bunny.service'
import {
  GPT_IMAGE_QUALITY_TIERS,
  IMAGE_MODELS,
  getModelById,
} from './services/types'
import type { FalImageResult } from './services/fal.service'

// =============================================================================
// Schemas
// =============================================================================

const generateImageSchema = z.object({
  prompt: z.string().min(1).max(2000),
  model: z.string().optional(),
  width: z.number().min(256).max(4096).optional(),
  height: z.number().min(256).max(4096).optional(),
  negativePrompt: z.string().max(1000).optional(),
  projectId: z.string().optional(),
  quality: z.enum(['low', 'medium', 'high']).optional(), // GPT Image quality tier
  style: z.string().optional(), // Recraft V3 style
})

const listImagesSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  projectId: z.string().optional(), // filter by project
})

const imageIdSchema = z.object({
  imageId: z.string(),
})

const jobIdSchema = z.object({
  jobId: z.string(),
})

// =============================================================================
// Image Generation
// =============================================================================

/**
 * Start an image generation job
 * Returns job ID for polling status
 */
export const generateImageFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(generateImageSchema)
  .handler(async ({ data, context }) => {
    console.log('[IMAGE] generateImageFn called:', {
      prompt: data.prompt.slice(0, 50) + '...',
      model: data.model,
      userId: context.user.id,
    })

    const modelId =
      data.model || 'imagineart/imagineart-1.5-preview/text-to-image'
    const modelConfig = getModelById(modelId, IMAGE_MODELS)

    if (!modelConfig) {
      console.error('[IMAGE] Unknown model:', modelId)
      throw new Error(`Unknown model: ${modelId}`)
    }

    // Calculate credits to charge (some models have variable pricing)
    let creditsToCharge = modelConfig.credits

    // GPT Image has variable pricing based on quality
    if (modelId === 'fal-ai/gpt-image-1.5' && data.quality) {
      const qualityTier = GPT_IMAGE_QUALITY_TIERS.find(
        (t) => t.id === data.quality,
      )
      if (qualityTier) {
        creditsToCharge = qualityTier.credits
      }
    }

    // Recraft V3 vector style costs double
    if (modelId.includes('recraft') && data.style === 'vector_illustration') {
      creditsToCharge = creditsToCharge * 2
    }

    // Check user credits (admins have unlimited)
    const isAdmin = context.user.role === 'admin'
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { credits: true },
    })

    console.log(
      '[IMAGE] User credits:',
      user?.credits,
      'Required:',
      creditsToCharge,
      'isAdmin:',
      isAdmin,
    )

    if (!isAdmin && (!user || user.credits < creditsToCharge)) {
      console.error('[IMAGE] Insufficient credits')
      throw new Error(
        `Insufficient credits. Required: ${creditsToCharge}, Available: ${user?.credits || 0}`,
      )
    }

    // Start generation job via Fal.ai
    console.log('[IMAGE] Starting FAL generation job...')
    const job = await generateImage({
      prompt: data.prompt,
      model: modelId,
      width: data.width || 1024,
      height: data.height || 1024,
      negativePrompt: data.negativePrompt,
      quality: data.quality,
      style: data.style,
    })
    console.log('[IMAGE] FAL job created:', job)

    // Create job record in database with Fal.ai URLs for status polling
    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId || null,
        type: 'image',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          prompt: data.prompt,
          width: data.width || 1024,
          height: data.height || 1024,
          negativePrompt: data.negativePrompt,
          quality: data.quality,
          style: data.style,
        }),
        externalId: job.requestId,
        // Store Fal.ai URLs for reliable status polling
        statusUrl: job.statusUrl,
        responseUrl: job.responseUrl,
        cancelUrl: job.cancelUrl,
        creditsUsed: creditsToCharge,
      },
    })
    console.log('[IMAGE] DB job created:', dbJob.id, {
      statusUrl: job.statusUrl,
      responseUrl: job.responseUrl,
    })

    // Deduct credits (skip for admins)
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: context.user.id },
        data: { credits: { decrement: creditsToCharge } },
      })
    }

    console.log('[IMAGE] generateImageFn complete, returning jobId:', dbJob.id)
    return {
      jobId: dbJob.id,
      externalId: job.requestId,
      model: modelId,
      credits: creditsToCharge,
      status: 'pending',
    }
  })

/**
 * Check the status of an image generation job
 */
export const getImageJobStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(jobIdSchema)
  .handler(async ({ data, context }) => {
    console.log('[IMAGE] getImageJobStatusFn called:', { jobId: data.jobId })

    const job = await prisma.generationJob.findUnique({
      where: { id: data.jobId },
    })

    if (!job) {
      console.error('[IMAGE] Job not found:', data.jobId)
      throw new Error('Job not found')
    }

    console.log('[IMAGE] Job from DB:', {
      id: job.id,
      status: job.status,
      externalId: job.externalId,
      model: job.model,
      statusUrl: job.statusUrl,
      responseUrl: job.responseUrl,
    })

    if (job.userId !== context.user.id) {
      console.error('[IMAGE] Unauthorized access attempt')
      throw new Error('Unauthorized')
    }

    // If already completed or failed, return cached result
    if (job.status === 'completed' || job.status === 'failed') {
      console.log(
        '[IMAGE] Job already finished, returning cached result:',
        job.status,
      )
      return {
        jobId: job.id,
        status: job.status,
        progress: job.status === 'completed' ? 100 : 0,
        output: job.output ? JSON.parse(job.output) : null,
        error: job.error,
      }
    }

    // Poll Fal.ai for status using the stored URLs
    if (!job.statusUrl || !job.responseUrl) {
      console.error('[IMAGE] Job has no status/response URLs!')
      throw new Error('Job is missing Fal.ai URLs for status polling')
    }

    console.log('[IMAGE] Polling FAL for status using stored URLs...')
    const falStatus = await getJobStatus(job.statusUrl, job.responseUrl)
    console.log('[IMAGE] FAL status response:', {
      status: falStatus.status,
      hasResult: !!falStatus.result,
      progress: falStatus.progress,
    })

    // Update job status in database
    if (falStatus.status === 'completed' && falStatus.result) {
      console.log('[IMAGE] FAL job completed! Processing result...')
      const result = falStatus.result as FalImageResult

      // Handle both response formats:
      // - Most models: { images: [{ url, width, height }] }
      // - Some models (Bria): { image: { url, width, height } }
      const imageData = result.images?.[0] || result.image
      const falTempUrl = imageData?.url

      console.log('[IMAGE] Result structure:', {
        hasImages: !!result.images,
        hasImage: !!result.image,
        imagesLength: result.images?.length,
        extractedUrl: falTempUrl?.slice(0, 50) + '...',
      })

      if (falTempUrl && imageData) {
        console.log(
          '[IMAGE] Extracted FAL temp URL:',
          falTempUrl.slice(0, 80) + '...',
        )

        // Upload the generated image from FAL's temporary URL to Bunny CDN
        // This ensures the image is permanently stored and accessible
        // Don't hardcode extension - let Bunny detect from content-type (handles SVG, PNG, etc.)
        const filename = `generated-${Date.now()}`
        let permanentUrl = falTempUrl

        console.log('[IMAGE] Uploading to Bunny CDN...')
        try {
          const uploadResult = await uploadFromUrl(falTempUrl, {
            folder: `images/${context.user.id}`,
            filename, // Extension will be auto-detected from content-type
          })
          permanentUrl = uploadResult.url
          console.log('[IMAGE] Bunny upload success:', permanentUrl)
        } catch (uploadError) {
          // Log error but continue - we'll fall back to FAL's URL
          // which may expire, but at least shows the image initially
          console.error('[IMAGE] Failed to upload to Bunny CDN:', uploadError)
          console.log('[IMAGE] Falling back to FAL temp URL')
        }

        // Create asset for the generated image with permanent CDN URL
        console.log('[IMAGE] Creating asset in DB...')
        const asset = await prisma.asset.create({
          data: {
            userId: context.user.id,
            projectId: job.projectId,
            type: 'image',
            storageUrl: permanentUrl,
            filename,
            prompt: JSON.parse(job.input).prompt,
            provider: 'fal',
            model: job.model,
            metadata: JSON.stringify({
              width: imageData.width,
              height: imageData.height,
              seed: result.seed,
            }),
          },
        })
        console.log('[IMAGE] Asset created:', asset.id)

        // Update job as completed
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            progress: 100,
            output: JSON.stringify({
              url: permanentUrl,
              assetId: asset.id,
              width: imageData.width,
              height: imageData.height,
            }),
          },
        })
        console.log('[IMAGE] Job updated to completed')

        return {
          jobId: job.id,
          status: 'completed' as const,
          progress: 100,
          output: {
            url: permanentUrl,
            assetId: asset.id,
            width: imageData.width,
            height: imageData.height,
          },
        }
      } else {
        console.error(
          '[IMAGE] FAL result has no image URL! Result:',
          JSON.stringify(result, null, 2),
        )
      }
    }

    if (falStatus.status === 'failed') {
      console.error('[IMAGE] FAL job failed!')
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: 'Generation failed',
        },
      })

      return {
        jobId: job.id,
        status: 'failed' as const,
        progress: 0,
        error: 'Generation failed',
      }
    }

    // Still processing
    const progress =
      falStatus.progress || (falStatus.status === 'processing' ? 50 : 10)

    console.log(
      '[IMAGE] Job still processing, status:',
      falStatus.status,
      'progress:',
      progress,
    )

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
// Image Library
// =============================================================================

/**
 * List user's images
 */
export const listUserImagesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listImagesSchema)
  .handler(async ({ data, context }) => {
    const images = await prisma.asset.findMany({
      where: {
        userId: context.user.id,
        type: 'image',
        ...(data.projectId && { projectId: data.projectId }),
      },
      orderBy: { createdAt: 'desc' },
      take: data.limit || 20,
      skip: data.offset || 0,
    })

    const total = await prisma.asset.count({
      where: {
        userId: context.user.id,
        type: 'image',
        ...(data.projectId && { projectId: data.projectId }),
      },
    })

    return {
      images: images.map((img) => ({
        id: img.id,
        url: img.storageUrl,
        filename: img.filename,
        prompt: img.prompt,
        model: img.model,
        metadata: img.metadata ? JSON.parse(img.metadata) : null,
        projectId: img.projectId,
        createdAt: img.createdAt,
      })),
      total,
    }
  })

/**
 * Get a single image by ID
 */
export const getImageFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(imageIdSchema)
  .handler(async ({ data, context }) => {
    const image = await prisma.asset.findUnique({
      where: { id: data.imageId },
    })

    if (!image) {
      throw new Error('Image not found')
    }

    if (image.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    return {
      id: image.id,
      url: image.storageUrl,
      filename: image.filename,
      prompt: image.prompt,
      model: image.model,
      provider: image.provider,
      metadata: image.metadata ? JSON.parse(image.metadata) : null,
      projectId: image.projectId,
      createdAt: image.createdAt,
    }
  })

/**
 * Delete an image
 */
export const deleteImageFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(imageIdSchema)
  .handler(async ({ data, context }) => {
    const image = await prisma.asset.findUnique({
      where: { id: data.imageId },
    })

    if (!image) {
      throw new Error('Image not found')
    }

    if (image.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    // TODO: Delete from storage (Bunny.net) if needed

    await prisma.asset.delete({
      where: { id: data.imageId },
    })

    return { success: true }
  })

// =============================================================================
// Model Info
// =============================================================================

/**
 * Get available image models
 */
export const getImageModelsFn = createServerFn({ method: 'GET' }).handler(
  () => {
    return {
      models: getImageModels(),
    }
  },
)

/**
 * Get user's pending image generation jobs
 */
export const getPendingImageJobsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const jobs = await prisma.generationJob.findMany({
      where: {
        userId: context.user.id,
        type: 'image',
        status: { in: ['pending', 'processing'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        model: job.model,
        status: job.status,
        progress: job.progress,
        input: JSON.parse(job.input),
        createdAt: job.createdAt,
      })),
    }
  })
