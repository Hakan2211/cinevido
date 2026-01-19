/**
 * Video Server Functions
 *
 * Server functions for AI video generation (image-to-video) using Fal.ai.
 * Handles generation jobs, asset creation, and user video library.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import {
  generateVideo,
  getJobStatus,
  getVideoModels,
} from './services/fal.service'
import { VIDEO_MODELS, getModelById } from './services/types'
import type { FalVideoResult } from './services/fal.service'

// =============================================================================
// Schemas
// =============================================================================

const generateVideoSchema = z.object({
  imageUrl: z.string().url(),
  prompt: z.string().min(1).max(2000),
  model: z.string().optional(), // defaults to kling-1.5
  duration: z.number().min(5).max(10).optional(), // 5 or 10 seconds
  projectId: z.string().optional(), // optional project association
  sourceImageId: z.string().optional(), // track which image was used
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
 * Start a video generation job (image-to-video)
 * Returns job ID for polling status
 */
export const generateVideoFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(generateVideoSchema)
  .handler(async ({ data, context }) => {
    const modelId = data.model || 'fal-ai/kling-video/v1.5/pro/image-to-video'
    const modelConfig = getModelById(modelId, VIDEO_MODELS)

    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelId}`)
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

    // Start generation job via Fal.ai
    const job = await generateVideo({
      imageUrl: data.imageUrl,
      prompt: data.prompt,
      model: modelId,
      duration: data.duration || 5,
    })

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
          imageUrl: data.imageUrl,
          prompt: data.prompt,
          duration: data.duration || 5,
          sourceImageId: data.sourceImageId,
        }),
        externalId: job.requestId,
        // Store Fal.ai URLs for reliable status polling
        statusUrl: job.statusUrl,
        responseUrl: job.responseUrl,
        cancelUrl: job.cancelUrl,
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
      credits: modelConfig.credits,
      status: 'pending',
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

    const falStatus = await getJobStatus(job.statusUrl, job.responseUrl)

    // Update job status in database
    if (falStatus.status === 'completed' && falStatus.result) {
      const result = falStatus.result as FalVideoResult
      const videoUrl = result.video.url

      if (videoUrl) {
        const inputData = JSON.parse(job.input)

        // Create asset for the generated video
        const asset = await prisma.asset.create({
          data: {
            userId: context.user.id,
            projectId: job.projectId,
            type: 'video',
            storageUrl: videoUrl,
            filename: `generated-${Date.now()}.mp4`,
            prompt: inputData.prompt,
            provider: 'fal',
            model: job.model,
            durationSeconds: inputData.duration || 5,
            metadata: JSON.stringify({
              sourceImageUrl: inputData.imageUrl,
              sourceImageId: inputData.sourceImageId,
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
              url: videoUrl,
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
            url: videoUrl,
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
 * Get available video models
 */
export const getVideoModelsFn = createServerFn({ method: 'GET' }).handler(
  () => {
    return {
      models: getVideoModels(),
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
