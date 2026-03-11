/**
 * Motion Control Server Functions
 *
 * Server functions for AI motion control video generation using Fal.ai's Kling API.
 * Transfers motion from a reference video to a character image.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db.server'
import { authMiddleware } from './middleware.server'
import { getUserFalApiKey } from './byok.server'
import { generateMotionControl, getJobStatus } from './services/fal.server'
import {
  MOTION_CONTROL_MODELS,
  getMotionControlModelById,
} from './services/types'
import type { FalVideoResult } from './services/fal.server'

// =============================================================================
// Schemas
// =============================================================================

const characterOrientationSchema = z.enum(['video', 'image'])

const generateMotionControlSchema = z.object({
  // Required
  imageUrl: z.string().url(), // Character image URL
  videoUrl: z.string().url(), // Reference motion video URL

  // Optional from library
  imageAssetId: z.string().optional(), // If selected from image library
  videoAssetId: z.string().optional(), // If selected from video library

  // Optional settings
  prompt: z.string().max(500).optional(),
  model: z.string().optional(),
  characterOrientation: characterOrientationSchema.optional(),
  duration: z.number().min(5).max(30).optional(), // Output duration in seconds

  // Audio parameters (optional)
  audioUrl: z.string().url().optional(),
  soundStartTime: z.number().min(0).optional(), // ms
  soundEndTime: z.number().min(0).optional(), // ms
  soundInsertTime: z.number().min(0).optional(), // ms

  // Project association
  projectId: z.string().optional(),
})

const listMotionControlVideosSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  projectId: z.string().optional(),
})

const jobIdSchema = z.object({
  jobId: z.string(),
})

// =============================================================================
// Motion Control Generation
// =============================================================================

/**
 * Start a motion control video generation job
 * Transfers motion from a reference video to a character image
 * Returns job ID for polling status
 */
export const generateMotionControlFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(generateMotionControlSchema)
  .handler(async ({ data, context }) => {
    const modelId = data.model || 'fal-ai/kling-video/v3/pro/motion-control'
    const modelConfig = getMotionControlModelById(modelId)

    if (!modelConfig) {
      throw new Error(`Unknown motion control model: ${modelId}`)
    }

    // Get user's fal.ai API key (BYOK)
    const userApiKey = await getUserFalApiKey(context.user.id)

    // Start generation job via Fal.ai
    const job = await generateMotionControl(
      {
        imageUrl: data.imageUrl,
        videoUrl: data.videoUrl,
        prompt: data.prompt,
        model: modelId,
        characterOrientation: data.characterOrientation,
        duration: data.duration,
        audioUrl: data.audioUrl,
        soundStartTime: data.soundStartTime,
        soundEndTime: data.soundEndTime,
        soundInsertTime: data.soundInsertTime,
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
          generationType: 'motion-control',
          imageUrl: data.imageUrl,
          imageAssetId: data.imageAssetId,
          videoUrl: data.videoUrl,
          videoAssetId: data.videoAssetId,
          prompt: data.prompt,
          characterOrientation: data.characterOrientation,
          duration: data.duration,
          audioUrl: data.audioUrl,
        }),
        externalId: job.requestId,
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
    }
  })

/**
 * Check the status of a motion control generation job
 */
export const getMotionControlJobStatusFn = createServerFn({ method: 'GET' })
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

    // Get user's API key for polling
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

        // Create asset for the generated video
        const asset = await prisma.asset.create({
          data: {
            userId: context.user.id,
            projectId: job.projectId,
            type: 'video',
            storageUrl: videoUrl,
            filename: `motion-control-${Date.now()}.mp4`,
            prompt: inputData.prompt || null,
            provider: 'fal',
            model: job.model,
            metadata: JSON.stringify({
              generationType: 'motion-control',
              sourceImageUrl: inputData.imageUrl,
              sourceImageId: inputData.imageAssetId,
              sourceVideoUrl: inputData.videoUrl,
              sourceVideoId: inputData.videoAssetId,
              characterOrientation: inputData.characterOrientation,
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
          },
        }
      }
    }

    if (falStatus.status === 'failed') {
      const errorMessage = falStatus.error || 'Motion control generation failed'
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
// Motion Control Video Library
// =============================================================================

/**
 * List user's motion control videos
 */
export const listMotionControlVideosFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listMotionControlVideosSchema)
  .handler(async ({ data, context }) => {
    // Get all videos, then filter by metadata.generationType = 'motion-control'
    const allVideos = await prisma.asset.findMany({
      where: {
        userId: context.user.id,
        type: 'video',
        ...(data.projectId && { projectId: data.projectId }),
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filter to motion-control videos
    const motionControlVideos = allVideos.filter((vid) => {
      if (!vid.metadata) return false
      try {
        const meta = JSON.parse(vid.metadata)
        return meta.generationType === 'motion-control'
      } catch {
        return false
      }
    })

    // Apply pagination after filtering
    const paginatedVideos = motionControlVideos.slice(
      data.offset || 0,
      (data.offset || 0) + (data.limit || 20),
    )

    return {
      videos: paginatedVideos.map((vid) => ({
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
      total: motionControlVideos.length,
    }
  })

// =============================================================================
// Model Info
// =============================================================================

/**
 * Get available motion control models
 */
export const getMotionControlModelsFn = createServerFn({
  method: 'GET',
}).handler(() => {
  return {
    models: MOTION_CONTROL_MODELS,
  }
})
