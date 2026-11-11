/**
 * Sound-effect Service
 *
 * Text-to-SFX through fal's ElevenLabs Sound Effects endpoint. Like speech,
 * a sound effect renders in seconds, so the call submits to fal's queue and
 * waits for the result instead of handing the client a job to poll.
 *
 * BYOK: pass the user's fal key (`getUserFalApiKey`); FAL_KEY is the
 * admin/testing fallback.
 */

import { uploadFromUrl } from './bunny.server'
import type { BunnyConfig } from './bunny.server'
import { DEFAULT_MODELS, getSfxModelById } from './types'

const MOCK_SFX = process.env.MOCK_GENERATION === 'true'
const FAL_API_URL = 'https://queue.fal.run'

export interface SoundEffectInput {
  /** what it should sound like ("a heavy door slams in a stone hall") */
  prompt: string
  model?: string
  /** seconds; omitted = the engine picks a length from the prompt */
  durationSec?: number
  /** a seamless loop (ambiences, room tone) */
  loop?: boolean
  /** 0–1: how literally to follow the prompt */
  promptInfluence?: number
}

export interface SoundEffectResult {
  audioUrl: string
  /** the requested length, when one was requested */
  durationSec: number | null
}

interface FalQueueResponse {
  request_id: string
  status_url: string
  response_url: string
}

/** The body for the SFX endpoint — only fields its schema declares. */
export function buildSoundEffectPayload(
  input: SoundEffectInput,
  modelId: string,
): Record<string, unknown> {
  const config = getSfxModelById(modelId)
  if (!config) throw new Error(`Unknown sound-effect model: ${modelId}`)
  const payload: Record<string, unknown> = {
    text: input.prompt.slice(0, config.maxPromptChars),
  }
  if (input.durationSec !== undefined) {
    payload.duration_seconds = Math.min(
      config.maxDurationSec,
      Math.max(config.minDurationSec, input.durationSec),
    )
  }
  if (config.supportsLoop && input.loop) payload.loop = true
  if (input.promptInfluence !== undefined) {
    payload.prompt_influence = Math.min(1, Math.max(0, input.promptInfluence))
  }
  return payload
}

export async function generateSoundEffect(
  input: SoundEffectInput,
  userApiKey?: string,
  storageConfig?: BunnyConfig | null,
): Promise<SoundEffectResult> {
  const modelId = input.model || DEFAULT_MODELS.sfx
  const payload = buildSoundEffectPayload(input, modelId)
  const durationSec =
    typeof payload.duration_seconds === 'number'
      ? payload.duration_seconds
      : null

  if (MOCK_SFX) {
    await new Promise((r) => setTimeout(r, 500))
    return {
      audioUrl:
        'https://storage.googleapis.com/falserverless/model_tests/musicgen/pop.mp3',
      durationSec,
    }
  }

  const apiKey = userApiKey || process.env.FAL_KEY
  if (!apiKey) {
    throw new Error(
      'No fal.ai API key available. Please add your API key in settings.',
    )
  }

  const submit = await fetch(`${FAL_API_URL}/${modelId}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!submit.ok) {
    throw new Error(
      `fal sound-effect error: ${submit.status} - ${await submit.text()}`,
    )
  }
  const queue: FalQueueResponse = await submit.json()

  // Poll the URLs fal hands back (never rebuild them from the model id)
  const result = await waitForResult(
    queue.status_url,
    queue.response_url,
    apiKey,
  )

  const upload = await uploadFromUrl(
    result.audio.url,
    { folder: 'audio', filename: `sfx-${Date.now()}.mp3` },
    storageConfig ?? undefined,
  )
  return { audioUrl: upload.url, durationSec }
}

async function waitForResult(
  statusUrl: string,
  responseUrl: string,
  apiKey: string,
  maxAttempts = 180, // 180 × 500ms = 90s
  intervalMs = 500,
): Promise<{ audio: { url: string } }> {
  const headers = { Authorization: `Key ${apiKey}` }
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(statusUrl, { headers })
    if (!res.ok) throw new Error(`Failed to get SFX status: ${res.status}`)
    const { status } = (await res.json()) as { status: string }
    if (status === 'COMPLETED') {
      const out = await fetch(responseUrl, { headers })
      if (!out.ok) {
        throw new Error(
          `Sound effect failed: ${out.status} - ${await out.text()}`,
        )
      }
      return out.json()
    }
    if (status === 'FAILED') throw new Error('Sound-effect generation failed')
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('Sound-effect generation timed out')
}
