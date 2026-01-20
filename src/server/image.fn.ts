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
import { uploadBuffer, uploadFromUrl } from './services/bunny.service'
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
  prompt: z.string().min(1),
  model: z.string().optional(),
  width: z.number().min(256).max(4096).optional(),
  height: z.number().min(256).max(4096).optional(),
  negativePrompt: z.string().max(1000).optional(),
  projectId: z.string().optional(),
  quality: z.enum(['low', 'medium', 'high']).optional(), // GPT Image quality tier
  style: z.string().optional(), // Recraft V3 style
  numImages: z.number().min(1).max(4).optional(), // Number of images to generate
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

const uploadImageSchema = z.object({
  imageData: z.string(), // Base64 encoded image data (without data URL prefix)
  filename: z.string().optional(),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
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

    // Multiply credits by number of images
    const numImages = data.numImages || 1
    creditsToCharge = creditsToCharge * numImages

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
      numImages,
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
          numImages,
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
      const inputData = JSON.parse(job.input)

      // Handle both response formats:
      // - Most models: { images: [{ url, width, height }] }
      // - Some models (Bria): { image: { url, width, height } }
      const allImages = result.images || (result.image ? [result.image] : [])

      console.log('[IMAGE] Result structure:', {
        hasImages: !!result.images,
        hasImage: !!result.image,
        imagesLength: allImages.length,
      })

      if (allImages.length > 0) {
        const createdAssets: Array<{
          id: string
          url: string
          width: number
          height: number
        }> = []

        // Process each image in the result
        for (let i = 0; i < allImages.length; i++) {
          const imageData = allImages[i]
          const falTempUrl = imageData.url

          console.log(
            `[IMAGE] Processing image ${i + 1}/${allImages.length}:`,
            falTempUrl.slice(0, 80) + '...',
          )

          // Upload to Bunny CDN
          const filename = `generated-${Date.now()}-${i}`
          let permanentUrl = falTempUrl

          try {
            const uploadResult = await uploadFromUrl(falTempUrl, {
              folder: `images/${context.user.id}`,
              filename,
            })
            permanentUrl = uploadResult.url
            console.log(`[IMAGE] Bunny upload ${i + 1} success:`, permanentUrl)
          } catch (uploadError) {
            console.error(
              `[IMAGE] Failed to upload image ${i + 1} to Bunny CDN:`,
              uploadError,
            )
          }

          // Create asset record
          const asset = await prisma.asset.create({
            data: {
              userId: context.user.id,
              projectId: job.projectId,
              type: 'image',
              storageUrl: permanentUrl,
              filename,
              prompt: inputData.prompt,
              provider: 'fal',
              model: job.model,
              metadata: JSON.stringify({
                width: imageData.width,
                height: imageData.height,
                seed: result.seed,
                batchIndex: i,
                batchSize: allImages.length,
              }),
            },
          })
          console.log(`[IMAGE] Asset ${i + 1} created:`, asset.id)

          createdAssets.push({
            id: asset.id,
            url: permanentUrl,
            width: imageData.width,
            height: imageData.height,
          })
        }

        // Update job as completed with all asset info
        const primaryAsset = createdAssets[0]
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            progress: 100,
            output: JSON.stringify({
              url: primaryAsset.url,
              assetId: primaryAsset.id,
              width: primaryAsset.width,
              height: primaryAsset.height,
              // Include all assets for batch generation
              assets: createdAssets,
              totalImages: createdAssets.length,
            }),
          },
        })
        console.log(
          '[IMAGE] Job updated to completed with',
          createdAssets.length,
          'images',
        )

        return {
          jobId: job.id,
          status: 'completed' as const,
          progress: 100,
          output: {
            url: primaryAsset.url,
            assetId: primaryAsset.id,
            width: primaryAsset.width,
            height: primaryAsset.height,
            assets: createdAssets,
            totalImages: createdAssets.length,
          },
        }
      } else {
        console.error(
          '[IMAGE] FAL result has no images! Result:',
          JSON.stringify(result, null, 2),
        )
      }
    }

    if (falStatus.status === 'failed') {
      const errorMessage = falStatus.error || 'Generation failed'
      console.error('[IMAGE] FAL job failed!', errorMessage)
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: errorMessage,
        },
      })

      return {
        jobId: job.id,
        status: 'failed' as const,
        progress: 0,
        error: errorMessage,
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
// Image Upload
// =============================================================================

/**
 * Upload a user's own image to their library
 * Accepts base64-encoded image data, stores in Bunny CDN, creates Asset record
 */
export const uploadUserImageFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(uploadImageSchema)
  .handler(async ({ data, context }) => {
    console.log('[IMAGE] uploadUserImageFn called:', {
      userId: context.user.id,
      contentType: data.contentType,
      dataLength: data.imageData.length,
    })

    // Decode base64 to buffer
    const buffer = Buffer.from(data.imageData, 'base64')

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    if (buffer.length > MAX_SIZE) {
      throw new Error('Image too large. Maximum size is 10MB.')
    }

    // Generate filename with extension based on content type
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }
    const extension = extensionMap[data.contentType] || 'png'
    const filename =
      data.filename?.replace(/\.[^/.]+$/, '') || // Remove any existing extension
      `upload-${Date.now()}`
    const fullFilename = `${filename}.${extension}`

    // Upload to Bunny CDN
    console.log('[IMAGE] Uploading to Bunny CDN...')
    const uploadResult = await uploadBuffer(buffer, data.contentType, {
      folder: `images/${context.user.id}`,
      filename: fullFilename,
    })
    console.log('[IMAGE] Upload success:', uploadResult.url)

    // Get image dimensions (basic check from buffer header)
    // For proper dimensions, we'd need an image library, but we'll skip for now
    const metadata = {
      uploadedAt: new Date().toISOString(),
      originalFilename: data.filename,
      size: buffer.length,
    }

    // Create asset record
    const asset = await prisma.asset.create({
      data: {
        userId: context.user.id,
        type: 'image',
        storageUrl: uploadResult.url,
        filename: fullFilename,
        prompt: null, // User uploads don't have prompts
        provider: 'upload', // Mark as user upload
        model: null,
        metadata: JSON.stringify(metadata),
      },
    })
    console.log('[IMAGE] Asset created:', asset.id)

    return {
      success: true,
      image: {
        id: asset.id,
        url: asset.storageUrl,
        filename: asset.filename,
        prompt: asset.prompt,
        model: asset.model,
        metadata,
        createdAt: asset.createdAt,
      },
    }
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
