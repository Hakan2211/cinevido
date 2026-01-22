/**
 * Video Upscale Service
 *
 * Handles AI video upscaling operations via Fal.ai API:
 * - Topaz: Professional-grade with frame interpolation
 * - SeedVR2: Temporal consistency, flexible output formats
 * - Bytedance: Simple resolution targeting
 *
 * Environment variables required:
 * - FAL_KEY: Fal.ai API key
 */

import { VIDEO_UPSCALE_MODELS, getVideoUpscaleModelById } from './types'
import type { VideoUpscaleInput } from './types'

const MOCK_UPSCALE = process.env.MOCK_GENERATION === 'true'
const FAL_API_URL = 'https://queue.fal.run'

// =============================================================================
// Types
// =============================================================================

export interface VideoUpscaleJob {
  requestId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  model: string
  provider: 'fal'
  // URLs returned by fal.ai for polling
  statusUrl?: string
  responseUrl?: string
}

export interface FalVideoUpscaleResult {
  video?: {
    url: string
    content_type?: string
    file_name?: string
    file_size?: number
  }
  seed?: number
  duration?: number // Bytedance returns duration for billing
}

// =============================================================================
// Main Service Functions
// =============================================================================

/**
 * Upscale a video using AI enhancement models
 * Supports Topaz (frame interpolation), SeedVR2 (temporal consistency), Bytedance (simple)
 */
export async function upscaleVideo(
  input: VideoUpscaleInput,
): Promise<VideoUpscaleJob> {
  const modelId = input.model || 'fal-ai/seedvr/upscale/video'
  const modelConfig = getVideoUpscaleModelById(modelId)

  console.log('[VIDEO-UPSCALE] upscaleVideo called:', {
    model: modelId,
    videoUrl: input.videoUrl.slice(0, 50) + '...',
  })

  if (!modelConfig) {
    console.error('[VIDEO-UPSCALE] Unknown model:', modelId)
    throw new Error(`Unknown video upscale model: ${modelId}`)
  }

  if (MOCK_UPSCALE) {
    console.log('[VIDEO-UPSCALE] Using MOCK mode')
    return mockVideoUpscaleJob(modelId)
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    console.error('[VIDEO-UPSCALE] FAL_KEY not configured!')
    throw new Error('FAL_KEY not configured')
  }

  const payload = buildVideoUpscalePayload(input, modelId)
  const submitUrl = `${FAL_API_URL}/${modelId}`

  console.log('[VIDEO-UPSCALE] Submitting to:', submitUrl)
  console.log('[VIDEO-UPSCALE] Payload:', JSON.stringify(payload, null, 2))

  const response = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  console.log('[VIDEO-UPSCALE] Response status:', response.status)

  if (!response.ok) {
    const error = await response.text()
    console.error('[VIDEO-UPSCALE] Submit error:', error)
    throw new Error(`Fal.ai error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  console.log('[VIDEO-UPSCALE] Response data:', JSON.stringify(data, null, 2))

  if (!data.request_id) {
    console.error(
      '[VIDEO-UPSCALE] WARNING: No request_id in response! Full data:',
      data,
    )
  }

  return {
    requestId: data.request_id,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    statusUrl: data.status_url,
    responseUrl: data.response_url,
  }
}

/**
 * Check the status of a video upscale job using the URLs provided by Fal.ai
 *
 * @param statusUrl - The status URL returned by Fal.ai when the job was submitted
 * @param responseUrl - The response URL returned by Fal.ai when the job was submitted
 */
export async function getVideoUpscaleJobStatus(
  statusUrl: string,
  responseUrl: string,
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  result?: FalVideoUpscaleResult
  error?: string
}> {
  console.log('[VIDEO-UPSCALE] getVideoUpscaleJobStatus called:', {
    statusUrl,
    responseUrl,
  })

  if (MOCK_UPSCALE) {
    console.log('[VIDEO-UPSCALE] Using MOCK mode for status')
    const mockRequestId =
      statusUrl.split('/requests/')[1]?.split('/')[0] || 'mock'
    return mockGetVideoUpscaleStatus(mockRequestId)
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    console.error('[VIDEO-UPSCALE] FAL_KEY not configured!')
    throw new Error('FAL_KEY not configured')
  }

  console.log('[VIDEO-UPSCALE] Fetching status from:', statusUrl)

  const statusResponse = await fetch(statusUrl, {
    headers: {
      Authorization: `Key ${apiKey}`,
    },
  })

  console.log('[VIDEO-UPSCALE] Status response code:', statusResponse.status)

  if (!statusResponse.ok) {
    const errorText = await statusResponse.text()
    console.error(
      '[VIDEO-UPSCALE] Status fetch failed:',
      statusResponse.status,
      errorText,
    )

    if (statusResponse.status === 404) {
      console.error(
        '[VIDEO-UPSCALE] 404 Error - request not found, may have expired',
      )
      return {
        status: 'failed' as const,
        error: 'Request not found or expired',
      }
    }

    throw new Error(
      `Failed to get status: ${statusResponse.status} - ${errorText}`,
    )
  }

  const statusData = await statusResponse.json()
  console.log(
    '[VIDEO-UPSCALE] Status data from fal.ai:',
    JSON.stringify(statusData, null, 2),
  )

  const statusMap: Record<
    string,
    'pending' | 'processing' | 'completed' | 'failed'
  > = {
    IN_QUEUE: 'pending',
    IN_PROGRESS: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
  }

  const status = statusMap[statusData.status] ?? 'pending'
  console.log(
    '[VIDEO-UPSCALE] Raw status:',
    statusData.status,
    '-> Mapped status:',
    status,
  )

  // If completed, fetch the result using the response URL
  if (status === 'completed') {
    console.log(
      '[VIDEO-UPSCALE] Job completed! Fetching result from:',
      responseUrl,
    )

    const resultResponse = await fetch(responseUrl, {
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    })

    console.log('[VIDEO-UPSCALE] Result response code:', resultResponse.status)

    if (!resultResponse.ok) {
      const errorText = await resultResponse.text()
      console.error(
        '[VIDEO-UPSCALE] Result fetch failed:',
        resultResponse.status,
        errorText,
      )
      throw new Error(
        `Failed to get result: ${resultResponse.status} - ${errorText}`,
      )
    }

    const result = await resultResponse.json()
    console.log('[VIDEO-UPSCALE] Result data:', JSON.stringify(result, null, 2))

    if (result.video?.url) {
      console.log('[VIDEO-UPSCALE] Video URL:', result.video.url)
    }

    return { status, result }
  }

  if (status === 'failed') {
    console.error('[VIDEO-UPSCALE] Job FAILED! Status data:', statusData)
    return {
      status,
      error: statusData.error || 'Video upscale failed',
    }
  }

  return { status }
}

/**
 * Get available video upscale models
 */
export function getVideoUpscaleModels() {
  return VIDEO_UPSCALE_MODELS
}

// =============================================================================
// Payload Builders
// =============================================================================

/**
 * Build payload for video upscale models
 * Each model has different API parameters
 */
function buildVideoUpscalePayload(
  input: VideoUpscaleInput,
  modelId: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    video_url: input.videoUrl,
  }

  // Topaz video upscaler
  if (modelId.includes('topaz')) {
    payload.upscale_factor = input.upscaleFactor || 2

    // Frame interpolation is enabled when target_fps is set
    if (input.targetFps) {
      payload.target_fps = input.targetFps
    }

    // H.264 output option (default is H.265)
    if (input.h264Output) {
      payload.H264_output = true
    }

    return payload
  }

  // SeedVR2 video upscaler
  if (modelId.includes('seedvr')) {
    payload.upscale_mode = input.upscaleMode || 'factor'

    if (payload.upscale_mode === 'target') {
      payload.target_resolution = input.seedvrTargetResolution || '1080p'
    } else {
      payload.upscale_factor = input.upscaleFactor || 2
    }

    payload.noise_scale = input.noiseScale ?? 0.1

    if (input.outputFormat) {
      payload.output_format = input.outputFormat
    }

    if (input.outputQuality) {
      payload.output_quality = input.outputQuality
    }

    if (input.seed !== undefined) {
      payload.seed = input.seed
    }

    return payload
  }

  // Bytedance video upscaler
  if (modelId.includes('bytedance')) {
    payload.target_resolution = input.bytedanceTargetResolution || '1080p'
    payload.target_fps = input.bytedanceTargetFps || '30fps'

    return payload
  }

  // Default fallback
  if (input.upscaleFactor) {
    payload.upscale_factor = input.upscaleFactor
  }

  return payload
}

// =============================================================================
// Mock Implementation
// =============================================================================

const mockVideoUpscaleJobs = new Map<
  string,
  {
    startTime: number
    model: string
  }
>()

function mockVideoUpscaleJob(modelId: string): VideoUpscaleJob {
  const requestId = `mock-video-upscale-${Date.now()}-${Math.random().toString(36).slice(2)}`
  mockVideoUpscaleJobs.set(requestId, { startTime: Date.now(), model: modelId })

  const mockBaseUrl = `https://queue.fal.run/${modelId}/requests/${requestId}`

  return {
    requestId,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    statusUrl: `${mockBaseUrl}/status`,
    responseUrl: mockBaseUrl,
  }
}

function mockGetVideoUpscaleStatus(requestId: string): {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  result?: FalVideoUpscaleResult
} {
  const job = mockVideoUpscaleJobs.get(requestId)
  if (!job) {
    return { status: 'failed' }
  }

  const elapsed = Date.now() - job.startTime
  // Video upscaling takes longer than images
  const processingTime = 10000

  if (elapsed < processingTime * 0.2) {
    return { status: 'pending', progress: 10 }
  }

  if (elapsed < processingTime) {
    const progress = Math.min(90, Math.floor((elapsed / processingTime) * 100))
    return { status: 'processing', progress }
  }

  // Completed
  mockVideoUpscaleJobs.delete(requestId)

  return {
    status: 'completed',
    result: {
      video: {
        url: 'https://storage.googleapis.com/falserverless/example_outputs/mock-upscaled-video.mp4',
        content_type: 'video/mp4',
      },
      seed: 12345,
    },
  }
}
