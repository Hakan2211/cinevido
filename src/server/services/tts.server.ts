/**
 * TTS (Text-to-Speech) Service
 *
 * Handles AI voice generation via Fal.ai's ElevenLabs TTS endpoint.
 * Provides word-level timestamps for karaoke sync.
 *
 * BYOK (Bring Your Own Key) Support:
 * - Functions accept an optional `apiKey` parameter for user-provided keys
 * - Falls back to FAL_KEY environment variable for admin/testing
 */

import { uploadFromUrl } from './bunny.server'
import type { BunnyConfig } from './bunny.server'
import { AUDIO_MODELS, getModelById } from './types'

const MOCK_TTS = process.env.MOCK_GENERATION === 'true'
const FAL_API_URL = 'https://queue.fal.run'

/**
 * Get the fal.ai API key to use for requests
 */
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

export interface Voice {
  name: string
  description?: string
}

export interface SpeechGenerationInput {
  text: string
  voice?: string // Voice name like "Rachel", "Adam" (default: "Rachel")
  model?: string // Fal model ID (default: multilingual-v2)
  stability?: number // 0-1 (default: 0.5)
  similarityBoost?: number // 0-1 (default: 0.75)
  speed?: number // 0.7-1.2 (default: 1)
}

export interface WordTimestamp {
  word: string
  start: number // seconds
  end: number // seconds
}

export interface SpeechResult {
  audioUrl: string // Bunny CDN URL after re-upload
  wordTimestamps: Array<WordTimestamp>
  duration: number // total duration in seconds
}

// Fal.ai response types
interface FalTtsResponse {
  audio: {
    url: string
    content_type?: string
    file_name?: string
    file_size?: number
  }
  timestamps?: Array<{
    text: string
    start: number
    end: number
  }>
}

interface FalQueueResponse {
  request_id: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
}

interface FalStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  logs?: Array<{ message: string; timestamp: string }>
}

// =============================================================================
// Default Voices (ElevenLabs voices available through Fal.ai)
// =============================================================================

export const DEFAULT_VOICES: Array<Voice> = [
  { name: 'Rachel', description: 'Calm, young female voice' },
  { name: 'Sarah', description: 'Soft, young female voice' },
  { name: 'Antoni', description: 'Well-rounded male voice' },
  { name: 'Arnold', description: 'Crisp, middle-aged male voice' },
  { name: 'Adam', description: 'Deep, middle-aged male voice' },
  { name: 'Aria', description: 'Expressive female voice' },
  { name: 'Domi', description: 'Strong female voice' },
  { name: 'Elli', description: 'Emotional female voice' },
  { name: 'Josh', description: 'Deep male voice' },
  { name: 'Sam', description: 'Raspy male voice' },
]

// =============================================================================
// Main Service Functions
// =============================================================================

/**
 * Generate speech with word-level timestamps
 * Uses Fal.ai's ElevenLabs TTS endpoint
 *
 * @param input - Speech generation parameters
 * @param userApiKey - Optional user's fal.ai API key (for BYOK)
 * @param storageConfig - Optional user Bunny.net config (for BYOK storage)
 */
export async function generateSpeech(
  input: SpeechGenerationInput,
  userApiKey?: string,
  storageConfig?: BunnyConfig | null,
): Promise<SpeechResult> {
  if (MOCK_TTS) {
    return mockGenerateSpeech(input)
  }

  const apiKey = getApiKey(userApiKey)

  const modelId = input.model || 'fal-ai/elevenlabs/tts/multilingual-v2'
  // Validate model exists
  getModelById(modelId, AUDIO_MODELS)

  const voice = input.voice || 'Rachel'

  // Submit to Fal.ai queue
  const submitResponse = await fetch(`${FAL_API_URL}/${modelId}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: input.text,
      voice,
      stability: input.stability ?? 0.5,
      similarity_boost: input.similarityBoost ?? 0.75,
      speed: input.speed ?? 1,
      timestamps: true, // Always request timestamps for karaoke sync
    }),
  })

  if (!submitResponse.ok) {
    const error = await submitResponse.text()
    throw new Error(`Fal.ai TTS error: ${submitResponse.status} - ${error}`)
  }

  const queueData: FalQueueResponse = await submitResponse.json()
  const requestId = queueData.request_id

  // Poll for completion (TTS is usually fast, 2-10 seconds)
  const result = await pollForCompletion(requestId, modelId, apiKey)

  // Convert Fal.ai timestamps to our format
  const wordTimestamps: Array<WordTimestamp> = (result.timestamps || []).map(
    (t) => ({
      word: t.text,
      start: t.start,
      end: t.end,
    }),
  )

  // Calculate duration from timestamps or estimate
  const duration =
    wordTimestamps.length > 0
      ? wordTimestamps[wordTimestamps.length - 1].end
      : estimateDuration(input.text)

  // Re-upload to Bunny.net for permanent storage (user's storage or platform default)
  const upload = await uploadFromUrl(
    result.audio.url,
    {
      folder: 'audio',
      filename: `tts-${Date.now()}.mp3`,
    },
    storageConfig ?? undefined,
  )

  return {
    audioUrl: upload.url,
    wordTimestamps,
    duration,
  }
}

/**
 * Generate speech without timestamps (simpler, for non-karaoke use)
 */
export async function generateSpeechSimple(
  input: SpeechGenerationInput,
): Promise<{ audioUrl: string; duration: number }> {
  const result = await generateSpeech(input)
  return {
    audioUrl: result.audioUrl,
    duration: result.duration,
  }
}

/**
 * Check if TTS service is configured (platform-level)
 * Note: In BYOK mode, users provide their own keys, so this is mainly for admin/testing
 */
export function isTtsConfigured(): boolean {
  if (MOCK_TTS) return true
  return !!process.env.FAL_KEY
}

/**
 * Get available voices
 */
export function getDefaultVoices(): Array<Voice> {
  return DEFAULT_VOICES
}

/**
 * Get available TTS models
 */
export function getAudioModels() {
  return AUDIO_MODELS
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Poll Fal.ai for job completion
 */
async function pollForCompletion(
  requestId: string,
  modelId: string,
  apiKey: string,
  maxAttempts = 60, // 60 attempts * 500ms = 30 seconds max
  intervalMs = 500,
): Promise<FalTtsResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check status
    const statusResponse = await fetch(
      `${FAL_API_URL}/${modelId}/requests/${requestId}/status`,
      {
        headers: { Authorization: `Key ${apiKey}` },
      },
    )

    if (!statusResponse.ok) {
      throw new Error(`Failed to get TTS status: ${statusResponse.status}`)
    }

    const statusData: FalStatusResponse = await statusResponse.json()

    if (statusData.status === 'COMPLETED') {
      // Fetch the result
      const resultResponse = await fetch(
        `${FAL_API_URL}/${modelId}/requests/${requestId}`,
        {
          headers: { Authorization: `Key ${apiKey}` },
        },
      )

      if (!resultResponse.ok) {
        throw new Error(`Failed to get TTS result: ${resultResponse.status}`)
      }

      return resultResponse.json()
    }

    if (statusData.status === 'FAILED') {
      throw new Error('TTS generation failed')
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error('TTS generation timed out')
}

/**
 * Estimate duration based on text length (for fallback)
 */
function estimateDuration(text: string): number {
  // Average speaking rate: ~150 words per minute = 2.5 words per second
  const words = text.split(/\s+/).length
  return words / 2.5
}

// =============================================================================
// Mock Implementation
// =============================================================================

async function mockGenerateSpeech(
  input: SpeechGenerationInput,
): Promise<SpeechResult> {
  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Generate mock timestamps based on text
  const words = input.text.split(/\s+/)
  const avgWordDuration = 0.3 // seconds per word
  let currentTime = 0

  const wordTimestamps: Array<WordTimestamp> = words.map((word) => {
    const start = currentTime
    const duration = avgWordDuration + word.length * 0.02
    currentTime += duration + 0.1 // gap between words
    return {
      word,
      start,
      end: start + duration,
    }
  })

  const duration = currentTime

  return {
    audioUrl: 'https://mock-cdn.example.com/audio/mock-tts.mp3',
    wordTimestamps,
    duration,
  }
}
