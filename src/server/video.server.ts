/**
 * Video Server Functions
 *
 * Server functions for AI video generation using Fal.ai.
 * Supports text-to-video, image-to-video, and keyframes generation.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db.server'
import { authMiddleware } from './middleware.server'
import { getUserFalApiKey } from './byok.server'
import {
  generateVideo,
  getJobStatus,
  getVideoModels,
} from './services/fal.server'
import { uploadBuffer, uploadFromUrl } from './services/bunny.server'
import { getVideoModelById } from './services/types'
import type { FalVideoResult } from './services/fal.server'

// =============================================================================
// Schemas
// =============================================================================

const generationTypeSchema = z.enum([
  'text-to-video',
  'image-to-video',
  'keyframes',
])

const keyframeTransitionSchema = z.object({
  duration: z.number().optional(),
  prompt: z.string().optional(),
})

const generateVideoSchema = z.object({
  // Required
  prompt: z.string().min(1).max(2000),
  generationType: generationTypeSchema,

  // Model selection
  model: z.string().optional(),

  // For image-to-video
  imageUrl: z.string().url().optional(),
  sourceImageId: z.string().optional(),

  // For keyframes (first + last frame)
  firstFrameUrl: z.string().url().optional(),
  lastFrameUrl: z.string().url().optional(),

  // For Pika multi-keyframe (2-5 images)
  keyframeUrls: z.array(z.string().url()).min(2).max(5).optional(),
  keyframeTransitions: z.array(keyframeTransitionSchema).optional(),

  // Generation settings
  duration: z.number().min(4).max(15).optional(),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
  generateAudio: z.boolean().optional(),
  negativePrompt: z.string().optional(),

  // Project association
  projectId: z.string().optional(),
})

const listVideosSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  projectId: z.string().optional(), // filter by project
})

const videoIdSchema = z.object({
  videoId: z.string(),
})

const jobIdSchema = z.object({
  jobId: z.string(),
})

// =============================================================================
// Video Generation
// =============================================================================

/**
 * Start a video generation job
 * Supports text-to-video, image-to-video, and keyframes generation
 * Returns job ID for polling status
 */
export const generateVideoFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(generateVideoSchema)
  .handler(async ({ data, context }) => {
    // Determine default model based on generation type
    let defaultModelId: string
    switch (data.generationType) {
      case 'text-to-video':
        defaultModelId = 'fal-ai/kling-video/v2.6/pro/text-to-video'
        break
      case 'image-to-video':
        defaultModelId = 'fal-ai/kling-video/v2.6/pro/image-to-video'
        break
      case 'keyframes':
        defaultModelId = 'fal-ai/veo3.1/first-last-frame-to-video'
        break
    }

    const modelId = data.model || defaultModelId
    const modelConfig = getVideoModelById(modelId)

    if (!modelConfig) {
      throw new Error(`Unknown video model: ${modelId}`)
    }

    // Validate model supports the requested generation type
    if (!modelConfig.capabilities.includes(data.generationType)) {
      throw new Error(
        `Model ${modelConfig.name} does not support ${data.generationType}`,
      )
    }

    // Validate required inputs based on generation type
    if (data.generationType === 'image-to-video' && !data.imageUrl) {
      throw new Error('imageUrl is required for image-to-video generation')
    }
    if (
      data.generationType === 'keyframes' &&
      !data.keyframeUrls &&
      (!data.firstFrameUrl || !data.lastFrameUrl)
    ) {
      throw new Error(
        'Either keyframeUrls or both firstFrameUrl and lastFrameUrl are required for keyframes generation',
      )
    }

    // Get user's fal.ai API key (BYOK)
    const userApiKey = await getUserFalApiKey(context.user.id)

    // Start generation job via Fal.ai
    const job = await generateVideo(
      {
        generationType: data.generationType,
        prompt: data.prompt,
        model: modelId,
        duration: data.duration,
        // Image-to-video
        imageUrl: data.imageUrl,
        // Keyframes
        firstFrameUrl: data.firstFrameUrl,
        lastFrameUrl: data.lastFrameUrl,
        keyframeUrls: data.keyframeUrls,
        keyframeTransitions: data.keyframeTransitions,
        // Settings
        aspectRatio: data.aspectRatio,
        resolution: data.resolution,
        generateAudio: data.generateAudio,
        negativePrompt: data.negativePrompt,
      },
      userApiKey,
    )

    // Create job record in database with Fal.ai URLs for status polling
    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId || null,
        type: 'video',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          generationType: data.generationType,
          prompt: data.prompt,
          duration: data.duration,
          // Image-to-video
          imageUrl: data.imageUrl,
          sourceImageId: data.sourceImageId,
          // Keyframes
          firstFrameUrl: data.firstFrameUrl,
          lastFrameUrl: data.lastFrameUrl,
          keyframeUrls: data.keyframeUrls,
          keyframeTransitions: data.keyframeTransitions,
          // Settings
          aspectRatio: data.aspectRatio,
          resolution: data.resolution,
          generateAudio: data.generateAudio,
        }),
        externalId: job.requestId,
        // Store Fal.ai URLs for reliable status polling
        statusUrl: job.statusUrl,
        responseUrl: job.responseUrl,
        cancelUrl: job.cancelUrl,
      },
    })

    return {
      jobId: dbJob.id,
      externalId: job.requestId,
      model: modelId,
      status: 'pending',
      generationType: data.generationType,
    }
  })

/**
 * Check the status of a video generation job
 */
export const getVideoJobStatusFn = createServerFn({ method: 'GET' })
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

    // Poll Fal.ai for status using stored URLs
    if (!job.statusUrl || !job.responseUrl) {
      throw new Error('Job is missing Fal.ai URLs for status polling')
    }

    // Get user's API key for polling (supports admin fallback to FAL_KEY)
    const userApiKey = await getUserFalApiKey(job.userId)
    const falStatus = await getJobStatus(
      job.statusUrl,
      job.responseUrl,
      userApiKey,
    )

    // Update job status in database
    if (falStatus.status === 'completed' && falStatus.result) {
      const result = falStatus.result as FalVideoResult
      const videoUrl = result.video.url

      if (videoUrl) {
        const inputData = JSON.parse(job.input)
        const uploadResult = await uploadFromUrl(videoUrl, {
          folder: `videos/${context.user.id}`,
          filename: `generated-${Date.now()}`,
        })

        // Create asset for the generated video
        const asset = await prisma.asset.create({
          data: {
            userId: context.user.id,
            projectId: job.projectId,
            type: 'video',
            storageUrl: uploadResult.url,
            filename: uploadResult.filename,
            prompt: inputData.prompt,
            provider: 'fal',
            model: job.model,
            durationSeconds: inputData.duration || 5,
            metadata: JSON.stringify({
              generationType: inputData.generationType,
              sourceImageUrl: inputData.imageUrl,
              sourceImageId: inputData.sourceImageId,
              firstFrameUrl: inputData.firstFrameUrl,
              lastFrameUrl: inputData.lastFrameUrl,
              aspectRatio: inputData.aspectRatio,
              duration: inputData.duration || 5,
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
              url: uploadResult.url,
              assetId: asset.id,
              duration: inputData.duration || 5,
            }),
          },
        })

        return {
          jobId: job.id,
          status: 'completed' as const,
          progress: 100,
          output: {
            url: uploadResult.url,
            assetId: asset.id,
            duration: inputData.duration || 5,
          },
        }
      }
    }

    if (falStatus.status === 'failed') {
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
// Video Library
// =============================================================================

/**
 * List user's videos
 */
export const listUserVideosFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listVideosSchema)
  .handler(async ({ data, context }) => {
    const videos = await prisma.asset.findMany({
      where: {
        userId: context.user.id,
        type: 'video',
        ...(data.projectId && { projectId: data.projectId }),
      },
      orderBy: { createdAt: 'desc' },
      take: data.limit || 20,
      skip: data.offset || 0,
    })

    const total = await prisma.asset.count({
      where: {
        userId: context.user.id,
        type: 'video',
        ...(data.projectId && { projectId: data.projectId }),
      },
    })

    return {
      videos: videos.map((vid) => ({
        id: vid.id,
        url: vid.storageUrl,
        filename: vid.filename,
        prompt: vid.prompt,
        model: vid.model,
        durationSeconds: vid.durationSeconds,
        metadata: vid.metadata ? JSON.parse(vid.metadata) : null,
        projectId: vid.projectId,
        createdAt: vid.createdAt,
      })),
      total,
    }
  })

/**
 * Get a single video by ID
 */
export const getVideoFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(videoIdSchema)
  .handler(async ({ data, context }) => {
    const video = await prisma.asset.findUnique({
      where: { id: data.videoId },
    })

    if (!video) {
      throw new Error('Video not found')
    }

    if (video.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    return {
      id: video.id,
      url: video.storageUrl,
      filename: video.filename,
      prompt: video.prompt,
      model: video.model,
      provider: video.provider,
      durationSeconds: video.durationSeconds,
      metadata: video.metadata ? JSON.parse(video.metadata) : null,
      projectId: video.projectId,
      createdAt: video.createdAt,
    }
  })

/**
 * Delete a video
 */
export const deleteVideoFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(videoIdSchema)
  .handler(async ({ data, context }) => {
    const video = await prisma.asset.findUnique({
      where: { id: data.videoId },
    })

    if (!video) {
      throw new Error('Video not found')
    }

    if (video.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    // TODO: Delete from storage (Bunny.net) if needed

    await prisma.asset.delete({
      where: { id: data.videoId },
    })

    return { success: true }
  })

// =============================================================================
// Model Info
// =============================================================================

/**
 * Get available video models with capabilities
 */
export const getVideoModelsFn = createServerFn({ method: 'GET' }).handler(
  () => {
    const models = getVideoModels()
    return {
      models,
      // Group by capability for easy UI filtering
      byCapability: {
        textToVideo: models.filter((m) =>
          m.capabilities.includes('text-to-video'),
        ),
        imageToVideo: models.filter((m) =>
          m.capabilities.includes('image-to-video'),
        ),
        keyframes: models.filter((m) => m.capabilities.includes('keyframes')),
      },
    }
  },
)

/**
 * Get user's pending video generation jobs
 */
export const getPendingVideoJobsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const jobs = await prisma.generationJob.findMany({
      where: {
        userId: context.user.id,
        type: 'video',
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

// =============================================================================
// Video Upload
// =============================================================================

const uploadVideoSchema = z.object({
  videoData: z.string(), // Base64 encoded video data (without data URL prefix)
  filename: z.string().optional(),
  contentType: z.enum([
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
  ]),
})

/**
 * Upload a user's own video to their library
 * Accepts base64-encoded video data, stores in Bunny CDN, creates Asset record
 */
export const uploadUserVideoFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(uploadVideoSchema)
  .handler(async ({ data, context }) => {
    console.log('[VIDEO] uploadUserVideoFn called:', {
      userId: context.user.id,
      contentType: data.contentType,
      dataLength: data.videoData.length,
    })

    // Decode base64 to buffer
    const buffer = Buffer.from(data.videoData, 'base64')

    // Validate file size (max 100MB for videos)
    const MAX_SIZE = 100 * 1024 * 1024 // 100MB
    if (buffer.length > MAX_SIZE) {
      throw new Error('Video too large. Maximum size is 100MB.')
    }

    // Generate filename with extension based on content type
    const extensionMap: Record<string, string> = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
    }
    const extension = extensionMap[data.contentType] || 'mp4'
    // Sanitize filename: remove extension, replace spaces with dashes, remove special chars, add timestamp
    const rawName = (
      data.filename?.replace(/\.[^/.]+$/, '') || 'upload' // Remove any existing extension
    )
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/[^a-zA-Z0-9._-]/g, '') // Remove special characters
    const filename = `${rawName}-${Date.now()}`
    const fullFilename = `${filename}.${extension}`

    // Upload to Bunny CDN
    console.log('[VIDEO] Uploading to Bunny CDN...')
    const uploadResult = await uploadBuffer(buffer, data.contentType, {
      folder: `videos/${context.user.id}`,
      filename: fullFilename,
    })
    console.log('[VIDEO] Upload success:', uploadResult.url)

    // Create metadata
    const metadata = {
      uploadedAt: new Date().toISOString(),
      originalFilename: data.filename,
      size: buffer.length,
      generationType: 'upload',
    }

    // Create asset record
    const asset = await prisma.asset.create({
      data: {
        userId: context.user.id,
        type: 'video',
        storageUrl: uploadResult.url,
        filename: fullFilename,
        prompt: null, // User uploads don't have prompts
        provider: 'upload', // Mark as user upload
        model: null,
        metadata: JSON.stringify(metadata),
      },
    })
    console.log('[VIDEO] Asset created:', asset.id)

    return {
      success: true,
      video: {
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
