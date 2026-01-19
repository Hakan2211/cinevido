/**
 * Fal.ai Service
 *
 * Handles AI image and video generation via Fal.ai API.
 * Supports multiple models for both image and video generation.
 *
 * Environment variables required:
 * - FAL_KEY: Fal.ai API key
 */

import { IMAGE_MODELS, VIDEO_MODELS, getModelById } from './types'

const MOCK_FAL = process.env.MOCK_GENERATION === 'true'
const FAL_API_URL = 'https://queue.fal.run'

// =============================================================================
// Types
// =============================================================================

export interface ImageGenerationInput {
  prompt: string
  model?: string
  width?: number
  height?: number
  numImages?: number
  negativePrompt?: string
  seed?: number
  quality?: 'low' | 'medium' | 'high' // For GPT Image 1.5
  style?: string // For Recraft V3
}

export interface VideoGenerationInput {
  imageUrl: string
  prompt: string
  model?: string // defaults to kling-1.5
  duration?: number // seconds (5 or 10)
  seed?: number
}

export interface FalQueueResponse {
  request_id: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  response_url: string
  status_url: string
  cancel_url: string
}

export interface FalStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  logs?: Array<{ message: string; timestamp: string }>
  response_url?: string
}

export interface FalImageResult {
  // Most models return an array of images
  images?: Array<{
    url: string
    width: number
    height: number
    content_type: string
  }>
  // Some models (e.g., Bria) return a single image object
  image?: {
    url: string
    width: number
    height: number
    content_type: string
    file_name?: string
    file_size?: number
  }
  seed?: number
  prompt?: string
}

export interface FalVideoResult {
  video: {
    url: string
    content_type: string
    file_name: string
    file_size: number
  }
}

export interface GenerationJob {
  requestId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  model: string
  provider: 'fal'
  // Fal.ai Queue URLs - use these directly for status polling instead of constructing URLs
  statusUrl: string
  responseUrl: string
  cancelUrl: string
}

// =============================================================================
// Main Service Functions
// =============================================================================

/**
 * Start an image generation job (queued)
 * Returns a request ID for polling status
 */
export async function generateImage(
  input: ImageGenerationInput,
): Promise<GenerationJob> {
  const modelId =
    input.model || 'imagineart/imagineart-1.5-preview/text-to-image'
  // Validate model exists (throws if not found)
  getModelById(modelId, IMAGE_MODELS)

  console.log('[FAL] generateImage called:', {
    modelId,
    prompt: input.prompt.slice(0, 50) + '...',
    width: input.width,
    height: input.height,
  })

  if (MOCK_FAL) {
    console.log('[FAL] Using MOCK mode')
    return mockGenerateJob(modelId)
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    console.error('[FAL] FAL_KEY not configured!')
    throw new Error('FAL_KEY not configured')
  }

  // Build the request payload based on the model
  const payload = buildImagePayload(input, modelId)
  const submitUrl = `${FAL_API_URL}/${modelId}`

  console.log('[FAL] Submitting to:', submitUrl)
  console.log('[FAL] Payload:', JSON.stringify(payload, null, 2))

  const response = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  console.log('[FAL] Submit response status:', response.status)

  if (!response.ok) {
    const error = await response.text()
    console.error('[FAL] Submit error:', error)
    throw new Error(`Fal.ai error: ${response.status} - ${error}`)
  }

  const data: FalQueueResponse = await response.json()
  console.log('[FAL] Submit success:', {
    request_id: data.request_id,
    status_url: data.status_url,
    response_url: data.response_url,
  })

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
 * Start a video generation job (queued)
 * Converts an image to video using specified model
 */
export async function generateVideo(
  input: VideoGenerationInput,
): Promise<GenerationJob> {
  const modelId = input.model || 'fal-ai/kling-video/v1.5/pro/image-to-video'
  // Validate model exists (throws if not found)
  getModelById(modelId, VIDEO_MODELS)

  if (MOCK_FAL) {
    return mockGenerateJob(modelId)
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    throw new Error('FAL_KEY not configured')
  }

  // Build the request payload
  const payload = buildVideoPayload(input, modelId)

  const response = await fetch(`${FAL_API_URL}/${modelId}`, {
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

  const data: FalQueueResponse = await response.json()
  console.log('[FAL] Video submit success:', {
    request_id: data.request_id,
    status_url: data.status_url,
    response_url: data.response_url,
  })

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
 * Check the status of a generation job using the URLs provided by Fal.ai
 * This is the robust approach that works for all models regardless of their URL structure
 *
 * @param statusUrl - The status URL returned by Fal.ai when the job was submitted
 * @param responseUrl - The response URL returned by Fal.ai when the job was submitted
 */
export async function getJobStatus(
  statusUrl: string,
  responseUrl: string,
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  result?: FalImageResult | FalVideoResult
  error?: string
}> {
  console.log('[FAL] getJobStatus called:', { statusUrl, responseUrl })

  if (MOCK_FAL) {
    console.log('[FAL] Using MOCK mode for status')
    // Extract mock request ID from URL for mock mode
    const mockRequestId =
      statusUrl.split('/requests/')[1]?.split('/')[0] || 'mock'
    return mockGetStatus(mockRequestId)
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    console.error('[FAL] FAL_KEY not configured!')
    throw new Error('FAL_KEY not configured')
  }

  // Use the status URL directly as provided by Fal.ai
  console.log('[FAL] Fetching status from:', statusUrl)

  const statusResponse = await fetch(statusUrl, {
    headers: {
      Authorization: `Key ${apiKey}`,
    },
  })

  console.log('[FAL] Status response code:', statusResponse.status)

  if (!statusResponse.ok) {
    const errorText = await statusResponse.text()
    console.error(
      '[FAL] Status fetch failed:',
      statusResponse.status,
      errorText,
    )

    // 404 might mean the request expired or was never created
    if (statusResponse.status === 404) {
      console.error('[FAL] 404 Error - request not found, may have expired')
      return {
        status: 'failed' as const,
        error: 'Request not found or expired',
      }
    }

    throw new Error(
      `Failed to get status: ${statusResponse.status} - ${errorText}`,
    )
  }

  const statusData: FalStatusResponse = await statusResponse.json()
  console.log('[FAL] Raw status data:', JSON.stringify(statusData, null, 2))

  // Map Fal status to our status
  const statusMap: Record<
    string,
    'pending' | 'processing' | 'completed' | 'failed'
  > = {
    IN_QUEUE: 'pending',
    IN_PROGRESS: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
  }

  const status = statusMap[statusData.status] || 'pending'
  console.log('[FAL] Mapped status:', statusData.status, '->', status)

  // If completed, fetch the result using the response URL provided by Fal.ai
  if (status === 'completed') {
    console.log('[FAL] Job completed! Fetching result from:', responseUrl)

    const resultResponse = await fetch(responseUrl, {
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    })

    console.log('[FAL] Result response code:', resultResponse.status)

    if (!resultResponse.ok) {
      const errorText = await resultResponse.text()
      console.error(
        '[FAL] Result fetch failed:',
        resultResponse.status,
        errorText,
      )
      throw new Error(`Failed to get result: ${resultResponse.status}`)
    }

    const result = await resultResponse.json()
    console.log('[FAL] Raw result:', JSON.stringify(result, null, 2))
    return { status, result }
  }

  console.log('[FAL] Job not completed yet, status:', status)
  return { status }
}

/**
 * Cancel a pending job using the cancel URL provided by Fal.ai
 *
 * @param cancelUrl - The cancel URL returned by Fal.ai when the job was submitted
 */
export async function cancelJob(cancelUrl: string): Promise<boolean> {
  if (MOCK_FAL) {
    return true
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    throw new Error('FAL_KEY not configured')
  }

  console.log('[FAL] Cancelling job at:', cancelUrl)

  const response = await fetch(cancelUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Key ${apiKey}`,
    },
  })

  console.log('[FAL] Cancel response:', response.status)
  return response.ok
}

/**
 * Check if Fal.ai is configured
 */
export function isFalConfigured(): boolean {
  if (MOCK_FAL) return true
  return !!process.env.FAL_KEY
}

/**
 * Get available image models
 */
export function getImageModels() {
  return IMAGE_MODELS
}

/**
 * Get available video models
 */
export function getVideoModels() {
  return VIDEO_MODELS
}

// =============================================================================
// Payload Builders
// =============================================================================

function buildImagePayload(input: ImageGenerationInput, modelId: string) {
  const payload: Record<string, unknown> = {
    prompt: input.prompt,
  }

  const width = input.width || 1024
  const height = input.height || 1024

  // === GPT Image 1.5 - uses different size format ===
  if (modelId === 'fal-ai/gpt-image-1.5') {
    payload.quality = input.quality || 'medium'
    payload.size = `${width}x${height}`
    if (input.numImages) payload.n = input.numImages
  }
  // === Recraft V3 - has style parameter and preset sizes ===
  else if (modelId.includes('recraft')) {
    payload.style = input.style || 'realistic_image'
    // Recraft uses preset size strings
    const aspectMap: Record<string, string> = {
      '1024x1024': 'square',
      '1024x576': 'landscape_16_9',
      '576x1024': 'portrait_16_9',
      '1024x768': 'landscape_4_3',
      '768x1024': 'portrait_4_3',
    }
    payload.size = aspectMap[`${width}x${height}`] || 'square'
  }
  // === Nano Banana models - use aspect_ratio string ===
  else if (modelId.includes('nano-banana')) {
    const aspectMap: Record<string, string> = {
      '1024x1024': '1:1',
      '1024x576': '16:9',
      '576x1024': '9:16',
      '1024x768': '4:3',
      '768x1024': '3:4',
    }
    payload.aspect_ratio = aspectMap[`${width}x${height}`] || '1:1'
  }
  // === ImagineArt - uses aspect_ratio string ===
  else if (modelId.includes('imagineart')) {
    const aspectMap: Record<string, string> = {
      '1024x1024': '1:1',
      '1024x576': '16:9',
      '576x1024': '9:16',
      '1024x768': '4:3',
      '768x1024': '3:4',
      '2048x2048': '1:1',
    }
    payload.aspect_ratio = aspectMap[`${width}x${height}`] || '1:1'
  }
  // === Seedream - uses image_size object ===
  else if (modelId.includes('seedream')) {
    payload.image_size = { width, height }
    if (input.numImages) payload.num_images = input.numImages
  }
  // === Bria - uses aspect_ratio string ===
  else if (modelId.includes('bria')) {
    const aspectMap: Record<string, string> = {
      '1024x1024': '1:1',
      '1024x576': '16:9',
      '576x1024': '9:16',
      '1024x768': '4:3',
      '768x1024': '3:4',
    }
    payload.aspect_ratio = aspectMap[`${width}x${height}`] || '1:1'
    if (input.negativePrompt) {
      payload.negative_prompt = input.negativePrompt
    }
  }
  // === Wan - uses image_size object ===
  else if (modelId.includes('wan')) {
    payload.image_size = { width, height }
    if (input.numImages) payload.num_images = input.numImages
  }
  // === Flux 2 models - use image_size object ===
  else if (modelId.includes('flux-2')) {
    payload.image_size = { width, height }
    if (input.numImages) payload.num_images = input.numImages
  }
  // === Default / Standard models ===
  else {
    payload.image_size = { width, height }
    payload.num_images = input.numImages || 1
  }

  // Common optional fields (for models that support them)
  if (input.negativePrompt && !modelId.includes('bria')) {
    payload.negative_prompt = input.negativePrompt
  }

  if (input.seed !== undefined) {
    payload.seed = input.seed
  }

  return payload
}

function buildVideoPayload(input: VideoGenerationInput, modelId: string) {
  const payload: Record<string, unknown> = {
    image_url: input.imageUrl,
    prompt: input.prompt,
  }

  // Kling-specific settings
  if (modelId.includes('kling')) {
    payload.duration = input.duration === 10 ? '10' : '5'
  }

  // Luma-specific settings
  if (modelId.includes('luma')) {
    payload.aspect_ratio = '9:16' // vertical by default
  }

  if (input.seed !== undefined) {
    payload.seed = input.seed
  }

  return payload
}

// =============================================================================
// Mock Implementation
// =============================================================================

// Store for tracking mock job progress
const mockJobs = new Map<
  string,
  { startTime: number; type: 'image' | 'video' }
>()

function mockGenerateJob(modelId: string): GenerationJob {
  const requestId = `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const type =
    modelId.includes('video') ||
    modelId.includes('kling') ||
    modelId.includes('luma')
      ? 'video'
      : 'image'

  mockJobs.set(requestId, { startTime: Date.now(), type })

  // Generate mock URLs that match the real Fal.ai format
  const mockBaseUrl = `https://queue.fal.run/${modelId}/requests/${requestId}`

  return {
    requestId,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    statusUrl: `${mockBaseUrl}/status`,
    responseUrl: mockBaseUrl,
    cancelUrl: `${mockBaseUrl}/cancel`,
  }
}

function mockGetStatus(requestId: string): {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  result?: FalImageResult | FalVideoResult
} {
  const job = mockJobs.get(requestId)
  if (!job) {
    return { status: 'failed' }
  }

  const elapsed = Date.now() - job.startTime
  const processingTime = job.type === 'video' ? 5000 : 2000 // 5s for video, 2s for image

  if (elapsed < processingTime * 0.3) {
    return { status: 'pending', progress: 10 }
  }

  if (elapsed < processingTime) {
    const progress = Math.min(90, Math.floor((elapsed / processingTime) * 100))
    return { status: 'processing', progress }
  }

  // Completed
  mockJobs.delete(requestId)

  if (job.type === 'image') {
    return {
      status: 'completed',
      result: {
        images: [
          {
            url: 'https://placehold.co/1024x1024/1a1a2e/ffffff?text=Generated+Image',
            width: 1024,
            height: 1024,
            content_type: 'image/png',
          },
        ],
        seed: 12345,
        prompt: 'mock prompt',
      } as FalImageResult,
    }
  }

  return {
    status: 'completed',
    result: {
      video: {
        url: 'https://placehold.co/1080x1920.mp4',
        content_type: 'video/mp4',
        file_name: 'mock-video.mp4',
        file_size: 1024000,
      },
    } as FalVideoResult,
  }
}
