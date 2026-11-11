/**
 * Audio lab server functions — voiceover and sound effects.
 *
 * Voice clips are assets of type "audio" (created by `createAudioJobFn` in
 * generation.server.ts) and land on the Voice lane; sound effects are type
 * "sfx" and land on the SFX lane. Music has its own module (music.server.ts).
 */

import { sfxJobCost } from '../lib/job-cost'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db.server'
import { authMiddleware } from './middleware.server'
import { getUserFalApiKey } from './byok.server'
import { getUserStorageConfig } from './storage-config.server'
import { generateSoundEffect } from './services/sfx.server'
import {
  AUDIO_MODELS,
  DEFAULT_MODELS,
  SFX_MODELS,
  TTS_VOICES,
  resolveModelId,
} from './services/types'

const createSfxSchema = z.object({
  prompt: z.string().min(1).max(450),
  model: z.string().optional(),
  durationSec: z.number().min(0.5).max(30).optional(),
  loop: z.boolean().optional(),
  promptInfluence: z.number().min(0).max(1).optional(),
  projectId: z.string().optional(),
})

const listAudioSchema = z.object({
  kind: z.enum(['voice', 'sfx']),
  limit: z.number().min(1).max(100).optional(),
})

const assetIdSchema = z.object({ assetId: z.string() })

const ASSET_TYPE = { voice: 'audio', sfx: 'sfx' } as const

/** Models and voices for the Voice and SFX tabs. */
export const getAudioLabConfigFn = createServerFn({ method: 'GET' }).handler(
  async () => ({
    ttsModels: AUDIO_MODELS,
    voices: TTS_VOICES,
    sfxModels: SFX_MODELS,
  }),
)

/** Generate a sound effect. Synchronous: SFX render in a few seconds. */
export const createSfxFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createSfxSchema)
  .handler(async ({ data, context }) => {
    const modelId = resolveModelId(data.model, SFX_MODELS, DEFAULT_MODELS.sfx)

    const job = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId,
        type: 'sfx',
        status: 'processing',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify(data),
        estimatedCostUsd: sfxJobCost(modelId, data.durationSec),
      },
    })

    try {
      const result = await generateSoundEffect(
        { ...data, model: modelId },
        await getUserFalApiKey(context.user.id),
        await getUserStorageConfig(context.user.id),
      )

      const asset = await prisma.asset.create({
        data: {
          userId: context.user.id,
          projectId: data.projectId,
          type: 'sfx',
          storageUrl: result.audioUrl,
          filename: `sfx-${Date.now()}.mp3`,
          prompt: data.prompt,
          provider: 'fal',
          model: modelId,
          metadata: JSON.stringify({
            loop: data.loop ?? false,
            requestedDurationSec: result.durationSec,
          }),
          durationSeconds: result.durationSec,
        },
      })

      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          output: JSON.stringify({ url: result.audioUrl, assetId: asset.id }),
          // auto length was priced at the ceiling; now we know the real one
          estimatedCostUsd: sfxJobCost(
            modelId,
            result.durationSec ?? data.durationSec,
          ),
        },
      })
      return { assetId: asset.id, url: result.audioUrl }
    } catch (error) {
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

/** The user's voice clips or sound effects, newest first, as track rows. */
export const listUserAudioFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listAudioSchema)
  .handler(async ({ data, context }) => {
    const assets = await prisma.asset.findMany({
      where: { userId: context.user.id, type: ASSET_TYPE[data.kind] },
      orderBy: { createdAt: 'desc' },
      take: data.limit || 50,
    })
    return assets.map((a) => {
      const metadata = a.metadata
        ? (JSON.parse(a.metadata) as Record<string, unknown>)
        : {}
      const text = a.prompt ?? ''
      return {
        id: a.id,
        url: a.storageUrl,
        filename: a.filename,
        title: text.length > 60 ? `${text.slice(0, 57)}…` : text || a.filename,
        prompt: a.prompt,
        model: a.model,
        lyrics: null,
        instrumental: false,
        seed: null,
        voice: (metadata.voice as string | undefined) ?? null,
        loop: metadata.loop === true,
        durationSeconds: a.durationSeconds,
        projectId: a.projectId,
        createdAt: a.createdAt,
      }
    })
  })

/** Delete a voice clip or sound effect from the library. */
export const deleteAudioAssetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(assetIdSchema)
  .handler(async ({ data, context }) => {
    const asset = await prisma.asset.findUnique({ where: { id: data.assetId } })
    if (!asset) throw new Error('Clip not found')
    if (asset.userId !== context.user.id) throw new Error('Unauthorized')
    if (asset.type !== 'audio' && asset.type !== 'sfx') {
      throw new Error('Not a voice clip or sound effect')
    }
    await prisma.asset.delete({ where: { id: data.assetId } })
    return { success: true }
  })
