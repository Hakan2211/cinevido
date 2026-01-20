/**
 * Image Edit Service
 *
 * Handles AI image editing operations via Fal.ai API:
 * - Prompt-based editing (describe what to change - no masks!)
 * - Upscaling (enhance resolution with AI)
 *
 * Environment variables required:
 * - FAL_KEY: Fal.ai API key
 */

import {
  EDIT_MODELS,
  UPSCALE_MODELS,
  getEditModelById,
  getModelById,
} from './types'

const MOCK_EDIT = process.env.MOCK_GENERATION === 'true'
const FAL_API_URL = 'https://queue.fal.run'

// =============================================================================
// Types
// =============================================================================

// New prompt-based edit input (no mask required!)
export interface EditInput {
  imageUrls: Array<string> // Array of image URLs (1 to maxImages depending on model)
  prompt: string
  model?: string
  seed?: number
}

export interface UpscaleInput {
  imageUrl: string
  model?: string
  scale?: number // Scale factor (1-10 for SeedVR, 1-4 for Topaz)
  seed?: number
  outputFormat?: 'png' | 'jpg' | 'jpeg' | 'webp'

  // Legacy fields for old models (kept for compatibility during transition)
  creativity?: number // 0-1, how much to enhance vs preserve
  prompt?: string // Optional guidance for upscaling

  // SeedVR specific options
  upscaleMode?: 'factor' | 'target' // Whether to use factor or target resolution
  targetResolution?: '720p' | '1080p' | '1440p' | '2160p' // Target resolution when mode is 'target'
  noiseScale?: number // 0-1, noise injection for generation process

  // Topaz specific options
  topazModel?: string // Enhancement model type (Standard V2, High Fidelity V2, etc.)
  subjectDetection?: 'All' | 'Foreground' | 'Background' // Which parts to enhance
  faceEnhancement?: boolean // Enable face enhancement
  faceEnhancementStrength?: number // 0-1, strength of face enhancement
  faceEnhancementCreativity?: number // 0-1, creativity for face generation
}

export interface EditJob {
  requestId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  model: string
  provider: 'fal'
  editType: 'edit' | 'upscale'
  // URLs returned by fal.ai for polling - use these instead of constructing from modelId!
  statusUrl?: string
  responseUrl?: string
}

export interface FalEditResult {
  images?: Array<{
    url: string
    width: number
    height: number
    content_type: string
  }>
  image?: {
    url: string
    width: number
    height: number
    content_type: string
  }
  seed?: number
}

// =============================================================================
// Main Service Functions
// =============================================================================

/**
 * Edit an image using prompt-based AI models (no mask required!)
 * Supports single or multiple reference images depending on model.
 */
export async function editImage(input: EditInput): Promise<EditJob> {
  const modelId = input.model || 'fal-ai/flux-pro/kontext'
  const modelConfig = getEditModelById(modelId)

  console.log('[EDIT] editImage called:', {
    model: modelId,
    imageUrls: input.imageUrls,
    prompt: input.prompt.slice(0, 50) + '...',
  })

  if (!modelConfig) {
    console.error('[EDIT] Unknown model:', modelId)
    throw new Error(`Unknown edit model: ${modelId}`)
  }

  // Validate image count against model's maxImages
  if (input.imageUrls.length > modelConfig.maxImages) {
    throw new Error(
      `Model ${modelConfig.name} supports max ${modelConfig.maxImages} image(s), got ${input.imageUrls.length}`,
    )
  }

  if (input.imageUrls.length === 0) {
    throw new Error('At least one image URL is required')
  }

  if (MOCK_EDIT) {
    console.log('[EDIT] Using MOCK mode')
    return mockEditJob(modelId, 'edit')
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    console.error('[EDIT] FAL_KEY not configured!')
    throw new Error('FAL_KEY not configured')
  }

  const payload = buildEditPayload(input, modelId)
  const submitUrl = `${FAL_API_URL}/${modelId}`

  console.log('[EDIT] Submitting to:', submitUrl)
  console.log('[EDIT] Payload:', JSON.stringify(payload, null, 2))

  const response = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  console.log('[EDIT] Response status:', response.status)

  if (!response.ok) {
    const error = await response.text()
    console.error('[EDIT] Submit error:', error)
    throw new Error(`Fal.ai error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  console.log('[EDIT] Response data:', JSON.stringify(data, null, 2))
  console.log('[EDIT] Got request_id:', data.request_id)

  if (!data.request_id) {
    console.error('[EDIT] WARNING: No request_id in response! Full data:', data)
  }

  return {
    requestId: data.request_id,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    editType: 'edit',
    statusUrl: data.status_url,
    responseUrl: data.response_url,
  }
}

/**
 * Upscale an image with AI enhancement
 * Supports SeedVR2 (up to 10x, target resolution mode) and Topaz (up to 4x, face enhancement)
 */
export async function upscaleImage(input: UpscaleInput): Promise<EditJob> {
  const modelId = input.model || 'fal-ai/seedvr/upscale/image'
  getModelById(modelId, UPSCALE_MODELS)

  if (MOCK_EDIT) {
    return mockEditJob(modelId, 'upscale')
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    throw new Error('FAL_KEY not configured')
  }

  const payload = buildUpscalePayload(input, modelId)

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

  const data = await response.json()
  console.log('[EDIT] Upscale response data:', JSON.stringify(data, null, 2))

  return {
    requestId: data.request_id,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    editType: 'upscale',
    statusUrl: data.status_url,
    responseUrl: data.response_url,
  }
}

/**
 * Check the status of an edit job using the URLs provided by Fal.ai
 * This is the robust approach that works for all models regardless of their URL structure
 *
 * @param statusUrl - The status URL returned by Fal.ai when the job was submitted
 * @param responseUrl - The response URL returned by Fal.ai when the job was submitted
 */
export async function getEditJobStatus(
  statusUrl: string,
  responseUrl: string,
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  result?: FalEditResult
  error?: string
}> {
  console.log('[EDIT] getEditJobStatus called:', { statusUrl, responseUrl })

  if (MOCK_EDIT) {
    console.log('[EDIT] Using MOCK mode for status')
    // Extract mock request ID from URL for mock mode
    const mockRequestId =
      statusUrl.split('/requests/')[1]?.split('/')[0] || 'mock'
    return mockGetEditStatus(mockRequestId)
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    console.error('[EDIT] FAL_KEY not configured!')
    throw new Error('FAL_KEY not configured')
  }

  // Use the status URL directly as provided by Fal.ai
  console.log('[EDIT] Fetching status from:', statusUrl)

  const statusResponse = await fetch(statusUrl, {
    headers: {
      Authorization: `Key ${apiKey}`,
    },
  })

  console.log('[EDIT] Status response code:', statusResponse.status)

  if (!statusResponse.ok) {
    const errorText = await statusResponse.text()
    console.error(
      '[EDIT] Status fetch failed:',
      statusResponse.status,
      errorText,
    )

    // 404 might mean the request expired or was never created
    if (statusResponse.status === 404) {
      console.error('[EDIT] 404 Error - request not found, may have expired')
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
    '[EDIT] Status data from fal.ai:',
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

  const status = statusMap[statusData.status] || 'pending'
  console.log(
    '[EDIT] Raw status:',
    statusData.status,
    '-> Mapped status:',
    status,
  )

  // If completed, fetch the result using the response URL provided by Fal.ai
  if (status === 'completed') {
    console.log('[EDIT] Job completed! Fetching result from:', responseUrl)

    const resultResponse = await fetch(responseUrl, {
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    })

    console.log('[EDIT] Result response code:', resultResponse.status)

    if (!resultResponse.ok) {
      const errorText = await resultResponse.text()
      console.error(
        '[EDIT] Result fetch failed:',
        resultResponse.status,
        errorText,
      )
      throw new Error(
        `Failed to get result: ${resultResponse.status} - ${errorText}`,
      )
    }

    const result = await resultResponse.json()
    console.log('[EDIT] Result data:', JSON.stringify(result, null, 2))
    console.log(
      '[EDIT] Images in result:',
      result.images?.length || 0,
      'image(s)',
    )
    if (result.images?.[0]) {
      console.log('[EDIT] First image URL:', result.images[0].url)
    }

    return { status, result }
  }

  if (status === 'failed') {
    console.error('[EDIT] Job FAILED! Status data:', statusData)
  }

  return { status }
}

/**
 * Get available edit models
 */
export function getEditModels() {
  return EDIT_MODELS
}

/**
 * Get available upscale models
 */
export function getUpscaleModels() {
  return UPSCALE_MODELS
}

// =============================================================================
// Payload Builders
// =============================================================================

/**
 * Build payload for prompt-based edit models
 * Each model has slightly different API parameters
 */
function buildEditPayload(input: EditInput, modelId: string) {
  const payload: Record<string, unknown> = {
    prompt: input.prompt,
  }

  if (input.seed !== undefined) {
    payload.seed = input.seed
  }

  // Model-specific payload structure
  if (modelId === 'fal-ai/flux-pro/kontext') {
    // Kontext Pro: single image, uses image_url
    payload.image_url = input.imageUrls[0]
  } else if (modelId.includes('nano-banana')) {
    // Nano Banana models: multi-image, uses image_urls array
    payload.image_urls = input.imageUrls
    payload.num_images = 1
  } else if (modelId === 'fal-ai/flux-2/edit') {
    // Flux 2 Edit: multi-image, uses image_urls array
    payload.image_urls = input.imageUrls
  } else if (modelId === 'fal-ai/gpt-image-1.5/edit') {
    // GPT Image 1.5: multi-image, uses image_urls array
    payload.image_urls = input.imageUrls
  } else if (modelId.includes('seedream')) {
    // Seedream 4.5: multi-image, uses image_urls array
    payload.image_urls = input.imageUrls
  } else {
    // Default: try image_urls for multi, image_url for single
    if (input.imageUrls.length === 1) {
      payload.image_url = input.imageUrls[0]
    } else {
      payload.image_urls = input.imageUrls
    }
  }

  return payload
}

function buildUpscalePayload(input: UpscaleInput, modelId: string) {
  const payload: Record<string, unknown> = {
    image_url: input.imageUrl,
  }

  // SeedVR2 upscaler
  if (modelId.includes('seedvr')) {
    payload.upscale_mode = input.upscaleMode || 'factor'

    if (payload.upscale_mode === 'target') {
      payload.target_resolution = input.targetResolution || '1080p'
    } else {
      payload.upscale_factor = input.scale || 2
    }

    payload.noise_scale = input.noiseScale ?? 0.1
    payload.output_format = input.outputFormat || 'jpg'

    if (input.seed !== undefined) {
      payload.seed = input.seed
    }

    return payload
  }

  // Topaz upscaler
  if (modelId.includes('topaz')) {
    payload.model = input.topazModel || 'Standard V2'
    payload.upscale_factor = Math.min(input.scale || 2, 4) // Topaz max is 4x
    payload.output_format =
      input.outputFormat === 'jpg' ? 'jpeg' : input.outputFormat || 'jpeg'
    payload.subject_detection = input.subjectDetection || 'All'
    payload.face_enhancement = input.faceEnhancement ?? true
    payload.face_enhancement_strength = input.faceEnhancementStrength ?? 0.8
    payload.face_enhancement_creativity = input.faceEnhancementCreativity ?? 0

    return payload
  }

  // Legacy: Creative upscaler (fallback, shouldn't be reached with new models)
  if (modelId.includes('creative-upscaler')) {
    payload.scale = input.scale || 2
    payload.creativity = input.creativity ?? 0.5
    payload.detail = 1
    payload.shape_preservation = 0.25
    if (input.prompt) {
      payload.prompt = input.prompt
    }
  }

  // Legacy: Clarity upscaler
  if (modelId.includes('clarity-upscaler')) {
    payload.scale = input.scale || 2
    payload.creativity = input.creativity ?? 0.2
  }

  if (input.seed !== undefined) {
    payload.seed = input.seed
  }

  return payload
}

// =============================================================================
// Mock Implementation
// =============================================================================

const mockEditJobs = new Map<
  string,
  {
    startTime: number
    editType: 'edit' | 'upscale'
  }
>()

function mockEditJob(modelId: string, editType: 'edit' | 'upscale'): EditJob {
  const requestId = `mock-edit-${Date.now()}-${Math.random().toString(36).slice(2)}`
  mockEditJobs.set(requestId, { startTime: Date.now(), editType })

  // Generate mock URLs that match the real Fal.ai format
  const mockBaseUrl = `https://queue.fal.run/${modelId}/requests/${requestId}`

  return {
    requestId,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    editType,
    statusUrl: `${mockBaseUrl}/status`,
    responseUrl: mockBaseUrl,
  }
}

function mockGetEditStatus(requestId: string): {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  result?: FalEditResult
} {
  const job = mockEditJobs.get(requestId)
  if (!job) {
    return { status: 'failed' }
  }

  const elapsed = Date.now() - job.startTime
  // Different processing times for different edit types
  const processingTimes: Record<string, number> = {
    edit: 3000,
    upscale: 5000,
  }
  const processingTime = processingTimes[job.editType] || 3000

  if (elapsed < processingTime * 0.3) {
    return { status: 'pending', progress: 10 }
  }

  if (elapsed < processingTime) {
    const progress = Math.min(90, Math.floor((elapsed / processingTime) * 100))
    return { status: 'processing', progress }
  }

  // Completed
  mockEditJobs.delete(requestId)

  const mockDimensions: Record<string, { width: number; height: number }> = {
    edit: { width: 1024, height: 1024 },
    upscale: { width: 2048, height: 2048 },
  }
  const dims = mockDimensions[job.editType] || { width: 1024, height: 1024 }

  return {
    status: 'completed',
    result: {
      images: [
        {
          url: `https://placehold.co/${dims.width}x${dims.height}/2a2a4e/ffffff?text=${job.editType}+Result`,
          width: dims.width,
          height: dims.height,
          content_type: 'image/jpeg',
        },
      ],
      seed: 12345,
    },
  }
}
