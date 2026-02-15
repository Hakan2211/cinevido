/**
 * Image Server Functions
 *
 * Server functions for AI image generation using Fal.ai.
 * Handles generation jobs, asset creation, and user image library.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db.server'
import { authMiddleware } from './middleware.server'
import { getUserFalApiKey } from './byok.server'
import {
  generateImage,
  getImageModels,
  getJobStatus,
} from './services/fal.server'
import sharp from 'sharp'
import { uploadBuffer, uploadFromUrl } from './services/bunny.server'
import { getUserStorageConfig } from './storage-config.server'
import { IMAGE_MODELS, getModelById } from './services/types'
import type { FalImageResult } from './services/fal.server'

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

    const numImages = data.numImages || 1

    // Get user's fal.ai API key (BYOK)
    const userApiKey = await getUserFalApiKey(context.user.id)
    console.log(
      '[IMAGE] Got BYOK key for generation:',
      userApiKey ? `...${userApiKey.slice(-4)}` : 'NONE',
    )

    // Start generation job via Fal.ai
    console.log('[IMAGE] Starting FAL generation job...')
    const job = await generateImage(
      {
        prompt: data.prompt,
        model: modelId,
        width: data.width || 1024,
        height: data.height || 1024,
        negativePrompt: data.negativePrompt,
        quality: data.quality,
        style: data.style,
        numImages,
      },
      userApiKey,
    )
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
      },
    })
    console.log('[IMAGE] DB job created:', dbJob.id, {
      statusUrl: job.statusUrl,
      responseUrl: job.responseUrl,
    })

    console.log('[IMAGE] generateImageFn complete, returning jobId:', dbJob.id)
    return {
      jobId: dbJob.id,
      externalId: job.requestId,
      model: modelId,
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
    let falStatus: Awaited<ReturnType<typeof getJobStatus>>
    try {
      // Get user's API key for polling (supports admin fallback to FAL_KEY)
      const userApiKey = await getUserFalApiKey(job.userId)
      falStatus = await getJobStatus(job.statusUrl, job.responseUrl, userApiKey)
      console.log('[IMAGE] FAL status response:', {
        status: falStatus.status,
        hasResult: !!falStatus.result,
        progress: falStatus.progress,
      })
    } catch (pollError) {
      // Handle unexpected errors during status polling
      const errorMessage =
        pollError instanceof Error ? pollError.message : 'Status check failed'
      console.error('[IMAGE] Status polling error:', errorMessage)

      // Update job as failed in database
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

        // Get user's storage config (if configured, uploads go to their Bunny zone)
        const storageConfig = await getUserStorageConfig(context.user.id)

        // Process each image in the result
        for (let i = 0; i < allImages.length; i++) {
          const imageData = allImages[i]
          const falTempUrl = imageData.url

          console.log(
            `[IMAGE] Processing image ${i + 1}/${allImages.length}:`,
            falTempUrl.slice(0, 80) + '...',
          )

          // Upload to Bunny CDN (user's storage or platform default)
          const filename = `generated-${Date.now()}-${i}`
          let permanentUrl = falTempUrl

          try {
            const uploadResult = await uploadFromUrl(
              falTempUrl,
              {
                folder: `images/${context.user.id}`,
                filename,
              },
              storageConfig ?? undefined,
            )
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
      queuePosition: falStatus.queuePosition,
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

    // Auto-resize if image exceeds fal.ai's max dimensions (3850x3850)
    const MAX_DIMENSION = 3850
    const imgMeta = await sharp(buffer).metadata()
    let processedBuffer = buffer
    let wasResized = false

    if (
      imgMeta.width &&
      imgMeta.height &&
      (imgMeta.width > MAX_DIMENSION || imgMeta.height > MAX_DIMENSION)
    ) {
      console.log(
        `[IMAGE] Resizing from ${imgMeta.width}x${imgMeta.height} (exceeds ${MAX_DIMENSION}px max)`,
      )
      processedBuffer = Buffer.from(
        await sharp(buffer)
          .resize({
            width: MAX_DIMENSION,
            height: MAX_DIMENSION,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer(),
      )
      wasResized = true
    }

    // Generate filename with extension based on content type
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }
    const extension = extensionMap[data.contentType] || 'png'
    const rawName = data.filename?.replace(/\.[^/.]+$/, '') || 'upload' // Remove any existing extension
    const filename = `${rawName}-${Date.now()}`
    const fullFilename = `${filename}.${extension}`

    // Upload to Bunny CDN (user's storage or platform default)
    console.log('[IMAGE] Uploading to Bunny CDN...')
    const storageConfig = await getUserStorageConfig(context.user.id)
    const uploadResult = await uploadBuffer(
      processedBuffer,
      data.contentType,
      {
        folder: `images/${context.user.id}`,
        filename: fullFilename,
      },
      storageConfig ?? undefined,
    )
    console.log('[IMAGE] Upload success:', uploadResult.url)

    // Get final dimensions
    const finalMeta = wasResized
      ? await sharp(processedBuffer).metadata()
      : imgMeta
    const metadata = {
      uploadedAt: new Date().toISOString(),
      originalFilename: data.filename,
      size: processedBuffer.length,
      width: finalMeta.width,
      height: finalMeta.height,
      ...(wasResized && {
        resized: true,
        originalWidth: imgMeta.width,
        originalHeight: imgMeta.height,
      }),
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
