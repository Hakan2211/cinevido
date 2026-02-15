/**
 * Generation Job Server Functions
 *
 * Handles AI generation jobs for images, videos, and audio.
 * Jobs are queued and processed asynchronously with status polling.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db.server'
import { authMiddleware } from './middleware.server'
import {
  AUDIO_MODELS,
  IMAGE_MODELS,
  VIDEO_MODELS,
  generateImage,
  generateSpeech,
  generateVideo,
  getFalJobStatus,
  uploadFromUrl,
} from './services/index.server'
import { getUserStorageConfig } from './storage-config.server'

// =============================================================================
// Schemas
// =============================================================================

const createImageJobSchema = z.object({
  prompt: z.string().min(1).max(2000),
  model: z.string().optional(),
  width: z.number().min(256).max(2048).optional(),
  height: z.number().min(256).max(2048).optional(),
  projectId: z.string().optional(),
})

const createVideoJobSchema = z.object({
  imageUrl: z.string().url(),
  prompt: z.string().min(1).max(1000),
  model: z.string().optional(),
  duration: z.number().min(5).max(10).optional(),
  projectId: z.string().optional(),
})

const createAudioJobSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().optional(), // Voice name like "Rachel", "Adam" (defaults to "Rachel")
  model: z.string().optional(), // TTS model (defaults to multilingual-v2)
  projectId: z.string().optional(),
})

const jobIdSchema = z.object({
  jobId: z.string(),
})

const listJobsSchema = z.object({
  projectId: z.string().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  type: z.enum(['image', 'video', 'audio', 'render']).optional(),
  limit: z.number().min(1).max(100).optional(),
})

// =============================================================================
// Image Generation
// =============================================================================

/**
 * Create an image generation job
 */
export const createImageJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createImageJobSchema)
  .handler(async ({ data, context }) => {
    const modelId = data.model || 'fal-ai/flux-pro/v1.1'

    // Create job in database
    const job = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId,
        type: 'image',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          prompt: data.prompt,
          width: data.width || 1024,
          height: data.height || 1024,
        }),
      },
    })

    // Start the generation (async)
    try {
      const falJob = await generateImage({
        prompt: data.prompt,
        model: modelId,
        width: data.width,
        height: data.height,
      })

      // Update job with external ID
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          externalId: falJob.requestId,
          status: 'processing',
        },
      })

      return { jobId: job.id, status: 'processing' }
    } catch (error) {
      // Mark job as failed
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      throw error
    }
  })

// =============================================================================
// Video Generation
// =============================================================================

/**
 * Create a video generation job (image-to-video)
 */
export const createVideoJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createVideoJobSchema)
  .handler(async ({ data, context }) => {
    const modelId = data.model || 'fal-ai/kling-video/v1.5/pro/image-to-video'

    // Create job in database
    const job = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId,
        type: 'video',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          imageUrl: data.imageUrl,
          prompt: data.prompt,
          duration: data.duration || 5,
        }),
      },
    })

    // Start the generation (async)
    try {
      const falJob = await generateVideo({
        generationType: 'image-to-video',
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        model: modelId,
        duration: data.duration,
      })

      // Update job with external ID
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          externalId: falJob.requestId,
          status: 'processing',
        },
      })

      return { jobId: job.id, status: 'processing' }
    } catch (error) {
      // Mark job as failed
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      throw error
    }
  })

// =============================================================================
// Audio Generation
// =============================================================================

/**
 * Create an audio generation job (voiceover with timestamps)
 */
export const createAudioJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createAudioJobSchema)
  .handler(async ({ data, context }) => {
    const modelId = data.model || 'fal-ai/elevenlabs/tts/multilingual-v2'

    const voice = data.voice || 'Rachel'

    // Create job in database
    const job = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId,
        type: 'audio',
        status: 'processing', // Audio is synchronous
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          text: data.text,
          voice,
        }),
      },
    })

    try {
      // Generate audio via Fal.ai (synchronous - TTS is fast)
      // The service handles re-uploading to Bunny.net for permanent storage
      const storageConfig = await getUserStorageConfig(context.user.id)
      const result = await generateSpeech(
        {
          text: data.text,
          voice,
          model: modelId,
        },
        undefined, // userApiKey (uses service default)
        storageConfig,
      )

      // Create asset record
      const asset = await prisma.asset.create({
        data: {
          userId: context.user.id,
          projectId: data.projectId,
          type: 'audio',
          storageUrl: result.audioUrl,
          filename: `tts-${Date.now()}.mp3`,
          prompt: data.text,
          provider: 'fal',
          model: modelId,
          metadata: JSON.stringify({
            wordTimestamps: result.wordTimestamps,
            voice,
          }),
          durationSeconds: result.duration,
        },
      })

      // Update job as completed
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          output: JSON.stringify({
            url: result.audioUrl,
            assetId: asset.id,
            duration: result.duration,
            wordTimestamps: result.wordTimestamps,
          }),
        },
      })

      return {
        jobId: job.id,
        status: 'completed',
        assetId: asset.id,
        url: result.audioUrl,
        duration: result.duration,
        wordTimestamps: result.wordTimestamps,
      }
    } catch (error) {
      // Mark job as failed
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      throw error
    }
  })

// =============================================================================
// Job Status & Polling
// =============================================================================

/**
 * Get job status and poll provider if needed
 */
export const getJobStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(jobIdSchema)
  .handler(async ({ data, context }) => {
    const job = await prisma.generationJob.findUnique({
      where: { id: data.jobId },
    })

    if (!job) {
      throw new Error('Job not found')
    }

    // Verify ownership
    if (job.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    // If job is already completed or failed, return cached result
    if (job.status === 'completed' || job.status === 'failed') {
      return {
        jobId: job.id,
        status: job.status,
        type: job.type,
        output: job.output ? JSON.parse(job.output) : null,
        error: job.error,
        progress: 100,
      }
    }

    // Poll the provider for status update
    if (job.provider === 'fal' && job.externalId) {
      try {
        const falStatus = await getFalJobStatus(job.externalId, job.model)

        // Update job progress
        await prisma.generationJob.update({
          where: { id: job.id },
          data: { progress: falStatus.progress || 50 },
        })

        // If completed, process the result
        if (falStatus.status === 'completed' && falStatus.result) {
          await processCompletedFalJob(
            job.id,
            context.user.id,
            job.type,
            falStatus.result,
          )

          // Re-fetch the updated job
          const updatedJob = await prisma.generationJob.findUnique({
            where: { id: job.id },
          })

          return {
            jobId: job.id,
            status: 'completed',
            type: job.type,
            output: updatedJob?.output ? JSON.parse(updatedJob.output) : null,
            progress: 100,
          }
        }

        if (falStatus.status === 'failed') {
          await prisma.generationJob.update({
            where: { id: job.id },
            data: { status: 'failed', error: 'Generation failed' },
          })

          return {
            jobId: job.id,
            status: 'failed',
            type: job.type,
            error: 'Generation failed',
            progress: 0,
          }
        }

        // Still processing
        return {
          jobId: job.id,
          status: falStatus.status,
          type: job.type,
          progress: falStatus.progress || 50,
        }
      } catch (error) {
        // Don't fail the whole request if polling fails
        return {
          jobId: job.id,
          status: job.status,
          type: job.type,
          progress: job.progress,
        }
      }
    }

    return {
      jobId: job.id,
      status: job.status,
      type: job.type,
      progress: job.progress,
    }
  })

/**
 * List generation jobs
 */
export const listJobsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listJobsSchema)
  .handler(async ({ data, context }) => {
    const jobs = await prisma.generationJob.findMany({
      where: {
        userId: context.user.id,
        ...(data.projectId && { projectId: data.projectId }),
        ...(data.status && { status: data.status }),
        ...(data.type && { type: data.type }),
      },
      orderBy: { createdAt: 'desc' },
      take: data.limit || 20,
    })

    return jobs.map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      model: job.model,
      progress: job.progress,
      output: job.output ? JSON.parse(job.output) : null,
      error: job.error,
      createdAt: job.createdAt,
    }))
  })

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Process a completed Fal.ai job - download result and create asset
 */
async function processCompletedFalJob(
  jobId: string,
  userId: string,
  type: string,
  result: unknown,
): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
  })

  if (!job) return

  try {
    let assetUrl: string
    let metadata: Record<string, unknown> = {}

    if (type === 'image') {
      // Handle image result
      const imageResult = result as {
        images: Array<{ url: string; width: number; height: number }>
      }
      const image = imageResult.images[0]

      // Upload to Bunny
      const upload = await uploadFromUrl(image.url, {
        folder: `images/${userId}`,
      })

      assetUrl = upload.url
      metadata = { width: image.width, height: image.height }
    } else if (type === 'video') {
      // Handle video result
      const videoResult = result as {
        video: { url: string; file_size: number }
      }

      // Upload to Bunny
      const upload = await uploadFromUrl(videoResult.video.url, {
        folder: `videos/${userId}`,
      })

      assetUrl = upload.url
      metadata = { fileSize: videoResult.video.file_size }
    } else {
      throw new Error(`Unknown job type: ${type}`)
    }

    // Create asset record
    const input = JSON.parse(job.input)
    const asset = await prisma.asset.create({
      data: {
        userId,
        projectId: job.projectId,
        type,
        storageUrl: assetUrl,
        filename: assetUrl.split('/').pop() || 'unknown',
        prompt: input.prompt,
        provider: job.provider,
        model: job.model,
        metadata: JSON.stringify(metadata),
      },
    })

    // Update job as completed
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        output: JSON.stringify({
          url: assetUrl,
          assetId: asset.id,
          metadata,
        }),
      },
    })
  } catch (error) {
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error:
          error instanceof Error ? error.message : 'Failed to process result',
      },
    })
  }
}

// =============================================================================
// Model Information
// =============================================================================

/**
 * Get available models and their costs
 */
export const getAvailableModelsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return {
      imageModels: IMAGE_MODELS,
      videoModels: VIDEO_MODELS,
      audioModels: AUDIO_MODELS,
    }
  },
)
