/**
 * Music Server Functions
 *
 * Server functions for AI music generation using fal.ai. Tracks are stored as
 * assets of type "music" so they land on the Music lane of the timeline rather
 * than sharing the Voice lane with narration.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db.server'
import { authMiddleware } from './middleware.server'
import { getUserFalApiKey } from './byok.server'
import { getJobStatus } from './services/fal.server'
import {
  clampDuration,
  controlsDuration,
  generateMusic,
  isMockMusic,
  mockMusicStatus,
} from './services/music.server'
import { uploadFromUrl } from './services/bunny.server'
import { getUserStorageConfig } from './storage-config.server'
import { MUSIC_MODELS, getMusicModelById } from './services/types'
import type { FalMusicResult } from './services/music.server'

// =============================================================================
// Schemas
// =============================================================================

const generateMusicSchema = z.object({
  /** genre tags (ACE-Step) or a prose description (ElevenLabs, Lyria) */
  prompt: z.string().min(1).max(2000),
  model: z.string().optional(),
  lyrics: z.string().max(5000).optional(),
  instrumental: z.boolean().optional(),
  durationSec: z.number().min(3).max(600).optional(),
  seed: z.number().int().optional(),
  negativePrompt: z.string().max(500).optional(),
  title: z.string().max(120).optional(),
  projectId: z.string().optional(),
})

const jobIdSchema = z.object({ jobId: z.string() })

const listMusicSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  projectId: z.string().optional(),
})

const trackIdSchema = z.object({ trackId: z.string() })

// =============================================================================
// Generation
// =============================================================================

/**
 * Start a music generation job. Returns a job id to poll.
 */
export const generateMusicFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(generateMusicSchema)
  .handler(async ({ data, context }) => {
    const modelId = data.model || MUSIC_MODELS[0].id
    const config = getMusicModelById(modelId)

    if (!config) {
      throw new Error(`Unknown music model: ${modelId}`)
    }
    if (data.lyrics && !config.supportsLyrics) {
      throw new Error(
        `${config.name} writes its own words — clear the lyrics box or pick an engine that takes them`,
      )
    }
    if (config.requiresLyrics && !data.lyrics?.trim()) {
      throw new Error(`${config.name} needs lyrics — it will not run without`)
    }

    // Engines that take no duration are recorded as unknown-length, not as the
    // length we would have asked for (see controlsDuration).
    const durationSec = clampDuration(data.durationSec, modelId)
    const requestedSec = controlsDuration(modelId) ? durationSec : null
    const userApiKey = await getUserFalApiKey(context.user.id)

    const job = await generateMusic(
      {
        prompt: data.prompt,
        model: modelId,
        lyrics: data.lyrics,
        instrumental: data.instrumental,
        durationSec,
        seed: data.seed,
        negativePrompt: data.negativePrompt,
      },
      userApiKey,
    )

    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId || null,
        type: 'music',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          prompt: data.prompt,
          lyrics: data.lyrics,
          instrumental: data.instrumental ?? false,
          durationSec: requestedSec,
          seed: data.seed,
          negativePrompt: data.negativePrompt,
          title: data.title,
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
      durationSec: requestedSec,
      status: 'pending' as const,
    }
  })

/**
 * Poll a music job. On completion the track is copied to storage and becomes
 * an asset, the same way a rendered video does.
 */
export const getMusicJobStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(jobIdSchema)
  .handler(async ({ data, context }) => {
    const job = await prisma.generationJob.findUnique({
      where: { id: data.jobId },
    })

    if (!job) throw new Error('Job not found')
    if (job.userId !== context.user.id) throw new Error('Unauthorized')

    if (job.status === 'completed' || job.status === 'failed') {
      return {
        jobId: job.id,
        status: job.status,
        progress: job.status === 'completed' ? 100 : 0,
        output: job.output ? JSON.parse(job.output) : null,
        error: job.error,
      }
    }

    if (!job.statusUrl || !job.responseUrl) {
      throw new Error('Job is missing Fal.ai URLs for status polling')
    }

    const userApiKey = await getUserFalApiKey(job.userId)
    const falStatus = isMockMusic()
      ? mockMusicStatus()
      : await getJobStatus(job.statusUrl, job.responseUrl, userApiKey)

    if (falStatus.status === 'completed' && falStatus.result) {
      const result = falStatus.result as unknown as FalMusicResult
      const audioUrl = result.audio?.url

      if (audioUrl) {
        const inputData = JSON.parse(job.input)
        // What the engine says it made beats what we asked for: MiniMax treats
        // `duration` as a cap and can resolve a song early, and Lyria sets no
        // duration at all. Null means "unknown" — the timeline probes the file.
        const actualSec: number | null =
          typeof result.duration === 'number' && result.duration > 0
            ? result.duration
            : (inputData.durationSec ?? null)
        const storageConfig = await getUserStorageConfig(context.user.id)
        const uploadResult = await uploadFromUrl(
          audioUrl,
          {
            folder: `music/${context.user.id}`,
            filename: `track-${Date.now()}`,
          },
          storageConfig ?? undefined,
        )

        const asset = await prisma.asset.create({
          data: {
            userId: context.user.id,
            projectId: job.projectId,
            type: 'music',
            storageUrl: uploadResult.url,
            filename: inputData.title || uploadResult.filename,
            prompt: inputData.prompt,
            provider: 'fal',
            model: job.model,
            durationSeconds: actualSec,
            metadata: JSON.stringify({
              title: inputData.title,
              lyrics: result.lyrics ?? inputData.lyrics,
              instrumental: inputData.instrumental ?? false,
              tags: result.tags ?? inputData.prompt,
              seed: result.seed ?? inputData.seed,
              durationSec: actualSec,
            }),
          },
        })

        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            progress: 100,
            output: JSON.stringify({
              url: uploadResult.url,
              assetId: asset.id,
              durationSec: actualSec,
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
            durationSec: actualSec ?? undefined,
          },
          error: null,
        }
      }
    }

    if (falStatus.status === 'failed') {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: 'failed', error: 'Music generation failed' },
      })

      return {
        jobId: job.id,
        status: 'failed' as const,
        progress: 0,
        output: null,
        error: 'Music generation failed',
      }
    }

    const status = falStatus.status === 'processing' ? 'processing' : 'pending'
    const progress = status === 'processing' ? 50 : 10

    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status, progress },
    })

    return {
      jobId: job.id,
      status,
      progress,
      output: null,
      error: null,
    }
  })

// =============================================================================
// Library
// =============================================================================

/** Every track the user has made, newest first. */
export const listUserMusicFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listMusicSchema)
  .handler(async ({ data, context }) => {
    const tracks = await prisma.asset.findMany({
      where: {
        userId: context.user.id,
        type: 'music',
        ...(data.projectId && { projectId: data.projectId }),
      },
      orderBy: { createdAt: 'desc' },
      take: data.limit || 50,
      skip: data.offset || 0,
    })

    return tracks.map((track) => {
      const metadata = track.metadata
        ? (JSON.parse(track.metadata) as Record<string, unknown>)
        : {}
      return {
        id: track.id,
        url: track.storageUrl,
        filename: track.filename,
        title: (metadata.title as string | undefined) || track.filename,
        prompt: track.prompt,
        model: track.model,
        lyrics: (metadata.lyrics as string | undefined) ?? null,
        instrumental: metadata.instrumental === true,
        seed:
          typeof metadata.seed === 'number' ? (metadata.seed as number) : null,
        durationSeconds: track.durationSeconds,
        projectId: track.projectId,
        createdAt: track.createdAt,
      }
    })
  })

/** Jobs still in flight, so the lab can show "generating…" cards on load. */
export const getPendingMusicJobsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const jobs = await prisma.generationJob.findMany({
      where: {
        userId: context.user.id,
        type: 'music',
        status: { in: ['pending', 'processing'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return jobs.map((job) => {
      const input = JSON.parse(job.input) as Record<string, unknown>
      return {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        model: job.model,
        title: (input.title as string | undefined) ?? null,
        prompt: (input.prompt as string | undefined) ?? '',
        durationSec: (input.durationSec as number | undefined) ?? null,
        createdAt: job.createdAt,
      }
    })
  })

/**
 * Attach a library track to a project, so it shows up in that project's asset
 * panel and can be cut into its timeline. A track already owned by another
 * project is left alone — the caller gets it back as it is.
 */
export const attachTrackToProjectFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ trackId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context }) => {
    const [track, project] = await Promise.all([
      prisma.asset.findUnique({ where: { id: data.trackId } }),
      prisma.project.findUnique({ where: { id: data.projectId } }),
    ])

    if (!track) throw new Error('Track not found')
    if (!project) throw new Error('Project not found')
    if (
      track.userId !== context.user.id ||
      project.userId !== context.user.id
    ) {
      throw new Error('Unauthorized')
    }

    const attached =
      track.projectId === null
        ? await prisma.asset.update({
            where: { id: track.id },
            data: { projectId: data.projectId },
          })
        : track

    return {
      id: attached.id,
      projectId: attached.projectId,
      url: attached.storageUrl,
      filename: attached.filename,
      durationSeconds: attached.durationSeconds,
    }
  })

export const deleteMusicFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(trackIdSchema)
  .handler(async ({ data, context }) => {
    const track = await prisma.asset.findUnique({ where: { id: data.trackId } })

    if (!track) throw new Error('Track not found')
    if (track.userId !== context.user.id) throw new Error('Unauthorized')

    await prisma.asset.delete({ where: { id: data.trackId } })
    return { success: true }
  })

export const getMusicModelsFn = createServerFn({ method: 'GET' }).handler(
  async () => MUSIC_MODELS,
)
