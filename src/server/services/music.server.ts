/**
 * Music Generation Service
 *
 * Text-to-music through fal.ai's queue, the same submit → poll → store shape
 * the video service uses. Four engines, each with its own payload — every field
 * below is taken from that model's own fal `/api` schema, not inferred:
 *
 *   ACE-Step          tags + lyrics, duration honoured      (the drafting engine)
 *   MiniMax Music 3   prompt + REQUIRED lyrics, duration is a CAP, ≤5min
 *   ElevenLabs Music  prose prompt, 3s–10min, instrumental  (the delivery engine)
 *   Lyria 3 Pro       prose prompt only — no duration, no seed, ≤3min
 *
 * BYOK (Bring Your Own Key) Support:
 * - Functions accept an optional `apiKey` parameter for user-provided keys
 * - Falls back to the FAL_KEY environment variable for admin/testing
 */

import { MUSIC_MODELS, getMusicModelById } from './types'
import type { GenerationJob } from './fal.server'

const MOCK_MUSIC = process.env.MOCK_GENERATION === 'true'
const FAL_API_URL = 'https://queue.fal.run'

/** a silent-but-valid mp3 to hand back in mock mode */
const MOCK_AUDIO_URL =
  'https://storage.googleapis.com/falserverless/model_tests/musicgen/pop.mp3'

function getApiKey(userApiKey?: string): string {
  if (userApiKey) return userApiKey
  const envKey = process.env.FAL_KEY
  if (envKey) return envKey
  throw new Error(
    'No fal.ai API key available. Please add your API key in settings.',
  )
}

// =============================================================================
// Types
// =============================================================================

export interface MusicGenerationInput {
  /** what the track should be: genre tags for ACE-Step, prose for the others */
  prompt: string
  model?: string
  /** the words to sing; ignored by engines that cannot sing */
  lyrics?: string
  /** force an instrumental take (no vocals) */
  instrumental?: boolean
  /** requested length in seconds; clamped to the engine's range */
  durationSec?: number
  seed?: number
  negativePrompt?: string
}

export interface FalMusicResult {
  audio: {
    url: string
    content_type?: string
    file_name?: string
    file_size?: number
  }
  seed?: number
  tags?: string
  lyrics?: string
  /** MiniMax reports what it actually produced; it can be under the request */
  duration?: number
}

// =============================================================================
// Payloads — one per engine, built from the model's own schema
// =============================================================================

export function buildMusicPayload(
  input: MusicGenerationInput,
  modelId: string,
): Record<string, unknown> {
  const config = getMusicModelById(modelId)
  if (!config) throw new Error(`Unknown music model: ${modelId}`)

  const duration = clampDuration(input.durationSec, modelId)

  if (modelId === 'fal-ai/ace-step') {
    // ACE-Step sings whatever is in `lyrics`; "[inst]" is its instrumental flag
    const lyrics = input.instrumental
      ? '[inst]'
      : (input.lyrics?.trim() ?? '') || '[inst]'
    return {
      tags: input.prompt,
      lyrics,
      duration,
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    }
  }

  if (modelId === 'minimax/music-3') {
    // `lyrics` is a required field on this endpoint — fail here with a sentence
    // the user can act on rather than letting fal answer with a 422.
    const lyrics = input.lyrics?.trim()
    if (!lyrics) {
      throw new Error(
        'MiniMax Music 3 needs lyrics — write the words (or pick ACE-Step for an instrumental).',
      )
    }
    return {
      prompt: input.prompt,
      lyrics,
      duration,
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    }
  }

  if (modelId === 'fal-ai/elevenlabs/music') {
    return {
      prompt: input.prompt,
      music_length_ms: Math.round(duration * 1000),
      ...(input.instrumental ? { force_instrumental: true } : {}),
    }
  }

  // fal-ai/lyria3/pro — prompt is the whole API surface. No duration, no seed,
  // no negative prompt: sending them is a schema error, not a no-op.
  return { prompt: input.prompt }
}

/**
 * Does this engine let us choose the length?
 *
 * Matters past the UI: for a 'model' engine we must not record the length we
 * *wanted* on the asset, or the timeline will lay out a clip against a duration
 * the audio does not have.
 */
export function controlsDuration(modelId: string): boolean {
  return getMusicModelById(modelId)?.durationMode !== 'model'
}

/** the length this engine will actually produce, in seconds */
export function clampDuration(
  requested: number | undefined,
  modelId: string,
): number {
  const config = getMusicModelById(modelId) ?? MUSIC_MODELS[0]
  const wanted = requested ?? config.defaultDurationSec
  return Math.min(
    config.maxDurationSec ?? wanted,
    Math.max(config.minDurationSec ?? 1, wanted),
  )
}

// =============================================================================
// Generation
// =============================================================================

/**
 * Start a music generation job (queued).
 * Returns the fal request id plus the URLs to poll it with.
 */
export async function generateMusic(
  input: MusicGenerationInput,
  userApiKey?: string,
): Promise<GenerationJob> {
  const modelId = input.model || MUSIC_MODELS[0].id
  if (!getMusicModelById(modelId)) {
    throw new Error(`Unknown music model: ${modelId}`)
  }

  if (MOCK_MUSIC) {
    const requestId = `mock-music-${Date.now()}`
    return {
      requestId,
      status: 'pending',
      model: modelId,
      provider: 'fal',
      statusUrl: `mock://requests/${requestId}/status`,
      responseUrl: `mock://requests/${requestId}`,
      cancelUrl: `mock://requests/${requestId}/cancel`,
    }
  }

  const apiKey = getApiKey(userApiKey)
  const payload = buildMusicPayload(input, modelId)
  const submitUrl = `${FAL_API_URL}/${modelId}`

  const response = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Fal.ai error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  return {
    requestId: data.request_id,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    statusUrl: data.status_url,
    responseUrl: data.response_url,
    cancelUrl: data.cancel_url,
  }
}

/**
 * Mock status for a mock job — completes immediately with a stock track, so
 * the lab, the library and the timeline can be exercised without spending.
 */
export function mockMusicStatus(): {
  status: 'completed'
  result: FalMusicResult
} {
  return {
    status: 'completed',
    result: { audio: { url: MOCK_AUDIO_URL, content_type: 'audio/mpeg' } },
  }
}

export function isMockMusic(): boolean {
  return MOCK_MUSIC
}

export function getMusicModels(): Array<(typeof MUSIC_MODELS)[number]> {
  return MUSIC_MODELS
}
