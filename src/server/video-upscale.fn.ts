/**
 * Video Upscale Server Functions
 *
 * Server functions for AI video upscaling operations:
 * - Topaz: Professional-grade with frame interpolation
 * - SeedVR2: Temporal consistency, flexible output formats
 * - Bytedance: Simple resolution targeting
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import {
  getVideoUpscaleJobStatus,
  getVideoUpscaleModels,
  upscaleVideo,
} from './services/video-upscale.service'
import { getVideoUpscaleModelById } from './services/types'
import { uploadFromUrl } from './services/bunny.service'

// =============================================================================
// Schemas
// =============================================================================

const upscaleVideoSchema = z.object({
  videoUrl: z.string().url(),
  model: z.string().optional(),
  sourceAssetId: z.string().optional(),
  projectId: z.string().optional(),

  // Common
  upscaleFactor: z.number().min(1).max(10).optional(),

  // Topaz specific
  targetFps: z.number().min(24).max(120).optional(),
  h264Output: z.boolean().optional(),

  // SeedVR specific
  upscaleMode: z.enum(['factor', 'target']).optional(),
  seedvrTargetResolution: z
    .enum(['720p', '1080p', '1440p', '2160p'])
    .optional(),
  noiseScale: z.number().min(0).max(1).optional(),
  outputFormat: z
    .enum(['X264 (.mp4)', 'VP9 (.webm)', 'PRORES4444 (.mov)', 'GIF (.gif)'])
    .optional(),
  outputQuality: z.enum(['low', 'medium', 'high', 'maximum']).optional(),
  seed: z.number().optional(),

  // Bytedance specific
  bytedanceTargetResolution: z.enum(['1080p', '2k', '4k']).optional(),
  bytedanceTargetFps: z.enum(['30fps', '60fps']).optional(),
})

const jobIdSchema = z.object({
  jobId: z.string(),
})

// =============================================================================
// Video Upscaling
// =============================================================================

/**
 * Start a video upscale job - enhance video resolution with AI
 */
export const upscaleVideoFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(upscaleVideoSchema)
  .handler(async ({ data, context }) => {
    console.log('[VIDEO_UPSCALE_FN] upscaleVideoFn called:', {
      userId: context.user.id,
      model: data.model,
      videoUrl: data.videoUrl.slice(0, 50) + '...',
    })

    const modelId = data.model || 'fal-ai/seedvr/upscale/video'
    const modelConfig = getVideoUpscaleModelById(modelId)

    if (!modelConfig) {
      console.error('[VIDEO_UPSCALE_FN] Unknown model:', modelId)
      throw new Error(`Unknown video upscale model: ${modelId}`)
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
    console.log('[VIDEO_UPSCALE_FN] Starting video upscale job...')
    const job = await upscaleVideo({
      videoUrl: data.videoUrl,
      model: modelId,
      upscaleFactor: data.upscaleFactor,
      // Topaz
      targetFps: data.targetFps,
      h264Output: data.h264Output,
      // SeedVR
      upscaleMode: data.upscaleMode,
      seedvrTargetResolution: data.seedvrTargetResolution,
      noiseScale: data.noiseScale,
      outputFormat: data.outputFormat,
      outputQuality: data.outputQuality,
      seed: data.seed,
      // Bytedance
      bytedanceTargetResolution: data.bytedanceTargetResolution,
      bytedanceTargetFps: data.bytedanceTargetFps,
    })

    console.log('[VIDEO_UPSCALE_FN] Video upscale job started:', {
      requestId: job.requestId,
      statusUrl: job.statusUrl,
      responseUrl: job.responseUrl,
      model: modelId,
    })

    // Create job record in database
    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId || null,
        type: 'video-upscale',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          videoUrl: data.videoUrl,
          sourceAssetId: data.sourceAssetId,
          upscaleFactor: data.upscaleFactor,
          // Model-specific params
          upscaleMode: data.upscaleMode,
          seedvrTargetResolution: data.seedvrTargetResolution,
          noiseScale: data.noiseScale,
          outputFormat: data.outputFormat,
          outputQuality: data.outputQuality,
          targetFps: data.targetFps,
          h264Output: data.h264Output,
          bytedanceTargetResolution: data.bytedanceTargetResolution,
          bytedanceTargetFps: data.bytedanceTargetFps,
          // Save fal.ai queue URLs for status polling
          statusUrl: job.statusUrl,
          responseUrl: job.responseUrl,
        }),
        externalId: job.requestId,
        creditsUsed: modelConfig.credits,
      },
    })

    console.log('[VIDEO_UPSCALE_FN] DB job created:', {
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
      credits: modelConfig.credits,
      status: 'pending',
    }
  })

// =============================================================================
// Job Status
// =============================================================================

/**
 * Check the status of a video upscale job
 */
export const getVideoUpscaleJobStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(jobIdSchema)
  .handler(async ({ data, context }) => {
    console.log('[VIDEO_UPSCALE_FN] getVideoUpscaleJobStatusFn called:', {
      jobId: data.jobId,
    })

    const job = await prisma.generationJob.findUnique({
      where: { id: data.jobId },
    })

    if (!job) {
      console.error('[VIDEO_UPSCALE_FN] Job not found:', data.jobId)
      throw new Error('Job not found')
    }

    console.log('[VIDEO_UPSCALE_FN] Found job:', {
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
      console.log(
        '[VIDEO_UPSCALE_FN] Returning cached result, status:',
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

    // Poll Fal.ai for status
    if (!job.externalId) {
      console.error('[VIDEO_UPSCALE_FN] Job has no external ID!')
      throw new Error('Job has no external ID')
    }

    // Get statusUrl and responseUrl from saved input
    const inputData = JSON.parse(job.input)
    const { statusUrl, responseUrl } = inputData

    if (!statusUrl || !responseUrl) {
      console.error(
        '[VIDEO_UPSCALE_FN] Job missing statusUrl or responseUrl in input!',
      )
      throw new Error('Job is missing fal.ai queue URLs.')
    }

    console.log(
      '[VIDEO_UPSCALE_FN] Polling fal.ai for status using saved URLs...',
    )
    const falStatus = await getVideoUpscaleJobStatus(statusUrl, responseUrl)
    console.log('[VIDEO_UPSCALE_FN] fal.ai status result:', {
      status: falStatus.status,
      hasResult: !!falStatus.result,
    })

    // Update job status in database
    if (falStatus.status === 'completed' && falStatus.result) {
      console.log('[VIDEO_UPSCALE_FN] Job completed! Processing result...')
      const result = falStatus.result
      const falTempUrl = result.video?.url

      console.log('[VIDEO_UPSCALE_FN] Extracted from result:', {
        falTempUrl: falTempUrl?.slice(0, 80) + '...',
      })

      if (falTempUrl) {
        const filename = `video-upscale-${Date.now()}.mp4`

        // Upload the upscaled video from FAL's temporary URL to Bunny CDN
        let permanentUrl = falTempUrl

        console.log('[VIDEO_UPSCALE_FN] Uploading to Bunny CDN...')
        try {
          const uploadResult = await uploadFromUrl(falTempUrl, {
            folder: `videos/${context.user.id}`,
            filename,
          })
          permanentUrl = uploadResult.url
          console.log('[VIDEO_UPSCALE_FN] Bunny upload success:', permanentUrl)
        } catch (uploadError) {
          // Log error but continue - we'll fall back to FAL's URL
          console.error(
            '[VIDEO_UPSCALE_FN] Failed to upload to Bunny CDN:',
            uploadError,
          )
          console.log('[VIDEO_UPSCALE_FN] Falling back to FAL temp URL')
        }

        // Create asset for the upscaled video with permanent CDN URL
        console.log('[VIDEO_UPSCALE_FN] Creating asset in DB...')
        const asset = await prisma.asset.create({
          data: {
            userId: context.user.id,
            projectId: job.projectId,
            type: 'video',
            storageUrl: permanentUrl,
            filename,
            prompt: null,
            provider: 'fal',
            model: job.model,
            metadata: JSON.stringify({
              seed: result.seed,
              duration: result.duration,
              sourceAssetId: inputData.sourceAssetId,
              upscaleType: 'video-upscale',
              upscaleFactor: inputData.upscaleFactor,
            }),
          },
        })
        console.log('[VIDEO_UPSCALE_FN] Asset created:', asset.id)

        // Update job as completed
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            progress: 100,
            output: JSON.stringify({
              url: permanentUrl,
              assetId: asset.id,
            }),
          },
        })
        console.log('[VIDEO_UPSCALE_FN] Job marked as completed')

        return {
          jobId: job.id,
          status: 'completed' as const,
          progress: 100,
          output: {
            url: permanentUrl,
            assetId: asset.id,
          },
        }
      }
    }

    if (falStatus.status === 'failed') {
      console.error('[VIDEO_UPSCALE_FN] Job failed!', falStatus.error)
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: falStatus.error || 'Video upscale failed',
        },
      })

      return {
        jobId: job.id,
        status: 'failed' as const,
        progress: 0,
        error: falStatus.error || 'Video upscale failed',
      }
    }

    // Still processing
    const progress =
      falStatus.progress || (falStatus.status === 'processing' ? 50 : 10)

    console.log('[VIDEO_UPSCALE_FN] Job still in progress:', {
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
 * Get available video upscale models
 */
export const getVideoUpscaleModelsFn = createServerFn({
  method: 'GET',
}).handler(() => {
  return {
    models: getVideoUpscaleModels(),
  }
})
