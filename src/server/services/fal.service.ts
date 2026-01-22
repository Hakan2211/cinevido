/**
 * Fal.ai Service
 *
 * Handles AI image and video generation via Fal.ai API.
 * Supports multiple models for both image and video generation.
 *
 * Environment variables required:
 * - FAL_KEY: Fal.ai API key
 */

import {
  IMAGE_MODELS,
  VIDEO_MODELS,
  getModelById,
  getVideoModelById,
  get3DModelById,
} from './types'
import type { VideoModelConfig, Model3DConfig } from './types'

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

export type VideoGenerationType =
  | 'text-to-video'
  | 'image-to-video'
  | 'keyframes'

export interface VideoGenerationInput {
  prompt: string
  model?: string
  duration?: number // seconds
  seed?: number
  // Generation type
  generationType: VideoGenerationType
  // For image-to-video
  imageUrl?: string
  // For keyframes (first + last frame)
  firstFrameUrl?: string
  lastFrameUrl?: string
  // For Pika multi-keyframe (2-5 images)
  keyframeUrls?: Array<string>
  keyframeTransitions?: Array<{
    duration?: number
    prompt?: string
  }>
  // Optional params
  aspectRatio?: string // e.g., '16:9', '9:16', '1:1'
  resolution?: string // e.g., '720p', '1080p', '4k'
  generateAudio?: boolean
  negativePrompt?: string
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
 * Supports text-to-video, image-to-video, and keyframes generation
 */
export async function generateVideo(
  input: VideoGenerationInput,
): Promise<GenerationJob> {
  // Determine default model based on generation type
  let defaultModelId: string
  switch (input.generationType) {
    case 'text-to-video':
      defaultModelId = 'fal-ai/kling-video/v2.6/pro/text-to-video'
      break
    case 'image-to-video':
      defaultModelId = 'fal-ai/kling-video/v2.6/pro/image-to-video'
      break
    case 'keyframes':
      defaultModelId = 'fal-ai/veo3.1/first-last-frame-to-video'
      break
    default:
      defaultModelId = 'fal-ai/kling-video/v2.6/pro/text-to-video'
  }

  const modelId = input.model || defaultModelId
  const modelConfig = getVideoModelById(modelId)

  if (!modelConfig) {
    throw new Error(`Unknown video model: ${modelId}`)
  }

  // Validate generation type matches model capabilities
  if (!modelConfig.capabilities.includes(input.generationType)) {
    throw new Error(
      `Model ${modelConfig.name} does not support ${input.generationType}`,
    )
  }

  console.log('[FAL] generateVideo called:', {
    modelId,
    generationType: input.generationType,
    prompt: input.prompt.slice(0, 50) + '...',
  })

  if (MOCK_FAL) {
    console.log('[FAL] Using MOCK mode')
    return mockGenerateJob(modelId)
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    throw new Error('FAL_KEY not configured')
  }

  // Build the request payload based on model and generation type
  const payload = buildVideoPayload(input, modelId, modelConfig)

  console.log('[FAL] Video payload:', JSON.stringify(payload, null, 2))

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
    console.error('[FAL] Video submit error:', error)
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
    FalStatusResponse['status'],
    'pending' | 'processing' | 'completed' | 'failed'
  > = {
    IN_QUEUE: 'pending',
    IN_PROGRESS: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
  }

  const status = statusMap[statusData.status]
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

      // Try to parse error for user-friendly message
      try {
        const errorData = JSON.parse(errorText)
        const detail = errorData.detail?.[0]
        if (detail?.type === 'content_policy_violation') {
          return {
            status: 'failed' as const,
            error:
              'Content policy violation: Your prompt was flagged by the content checker. Please modify your prompt and try again.',
          }
        }
        if (detail?.type === 'downstream_service_error') {
          return {
            status: 'failed' as const,
            error:
              'The AI service encountered an error. Please try again later.',
          }
        }
        // Handle other error types
        return {
          status: 'failed' as const,
          error: detail?.msg || `Request failed: ${resultResponse.status}`,
        }
      } catch {
        return {
          status: 'failed' as const,
          error: `Failed to get result: ${resultResponse.status}`,
        }
      }
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
export function getVideoModels(): Array<VideoModelConfig> {
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
    if (input.numImages) payload.num_images = input.numImages
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
    if (input.numImages) payload.num_images = input.numImages
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
  // === Wan - uses image_size object and max_images ===
  else if (modelId.includes('wan')) {
    payload.image_size = { width, height }
    if (input.numImages) payload.max_images = input.numImages
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

function buildVideoPayload(
  input: VideoGenerationInput,
  modelId: string,
  modelConfig: VideoModelConfig,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  // Always include prompt
  payload.prompt = input.prompt

  // Handle different generation types
  switch (input.generationType) {
    case 'text-to-video':
      // Text-to-video: just prompt + settings
      // No image required
      break

    case 'image-to-video': {
      // Image-to-video: need first frame image
      const imageField = modelConfig.fieldMappings?.imageUrl || 'image_url'
      if (!input.imageUrl) {
        throw new Error('imageUrl is required for image-to-video generation')
      }
      payload[imageField] = input.imageUrl
      break
    }

    case 'keyframes': {
      // Keyframes: handle Pika multi-frame vs standard first+last frame
      if (modelId.includes('pika') && modelId.includes('pikaframes')) {
        // Pika Pikaframes: uses image_urls array
        if (input.keyframeUrls && input.keyframeUrls.length >= 2) {
          payload.image_urls = input.keyframeUrls
          if (input.keyframeTransitions) {
            payload.transitions = input.keyframeTransitions
          }
        } else if (input.firstFrameUrl && input.lastFrameUrl) {
          // Fallback to first+last as 2-frame array
          payload.image_urls = [input.firstFrameUrl, input.lastFrameUrl]
        } else {
          throw new Error('Pika keyframes requires at least 2 images')
        }
      } else {
        // Standard first+last frame (Veo 3.1, Seedance)
        const firstFrameField =
          modelConfig.fieldMappings?.imageUrl || 'first_frame_url'
        const lastFrameField =
          modelConfig.fieldMappings?.endImageUrl || 'last_frame_url'

        if (!input.firstFrameUrl || !input.lastFrameUrl) {
          throw new Error(
            'firstFrameUrl and lastFrameUrl are required for keyframes generation',
          )
        }
        payload[firstFrameField] = input.firstFrameUrl
        payload[lastFrameField] = input.lastFrameUrl
      }
      break
    }
  }

  // =============================================================================
  // Model-specific payload building
  // =============================================================================

  // --- Kling 2.6 ---
  // Kling API expects duration as a NUMBER (5, 10)
  if (modelId.includes('kling-video/v2.6')) {
    payload.duration = input.duration || 5
    // Aspect ratio (for text-to-video)
    if (input.aspectRatio) {
      payload.aspect_ratio = input.aspectRatio
    }
    // Audio generation
    if (input.generateAudio !== undefined) {
      payload.generate_audio = input.generateAudio
    } else {
      payload.generate_audio = true // default on
    }
    // Negative prompt
    if (input.negativePrompt) {
      payload.negative_prompt = input.negativePrompt
    }
  }

  // --- Sora 2 ---
  // Sora API expects duration as a NUMBER (4, 8, 12)
  else if (modelId.includes('sora-2')) {
    payload.duration = input.duration || 4
    if (input.aspectRatio) {
      payload.aspect_ratio = input.aspectRatio
    }
    if (input.resolution) {
      payload.resolution = input.resolution
    }
  }

  // --- Veo 3.1 ---
  // Veo API expects duration with 's' suffix: '4s', '6s', '8s'
  else if (modelId.includes('veo3.1')) {
    const dur = input.duration || 8
    payload.duration = `${dur}s`
    if (input.aspectRatio) {
      payload.aspect_ratio = input.aspectRatio
    }
    if (input.resolution) {
      payload.resolution = input.resolution
    }
    if (input.generateAudio !== undefined) {
      payload.generate_audio = input.generateAudio
    } else {
      payload.generate_audio = true
    }
    if (input.negativePrompt) {
      payload.negative_prompt = input.negativePrompt
    }
  }

  // --- Wan 2.6 ---
  // Wan API expects duration as a NUMBER (5)
  else if (modelId.includes('wan/v2.6')) {
    payload.duration = input.duration || 5
    if (input.aspectRatio) {
      payload.aspect_ratio = input.aspectRatio
    }
    if (input.resolution) {
      payload.resolution = input.resolution
    }
    if (input.negativePrompt) {
      payload.negative_prompt = input.negativePrompt
    }
  }

  // --- Seedance 1.5 ---
  // Seedance API expects duration as a NUMBER (5, 10)
  else if (modelId.includes('seedance')) {
    payload.duration = input.duration || 5
    if (input.aspectRatio) {
      payload.aspect_ratio = input.aspectRatio
    }
    if (input.resolution) {
      payload.resolution = input.resolution
    }
    if (input.generateAudio !== undefined) {
      payload.generate_audio = input.generateAudio
    } else {
      payload.generate_audio = true
    }
  }

  // --- MiniMax Hailuo ---
  // Hailuo has fixed duration, uses prompt_optimizer
  else if (modelId.includes('minimax/hailuo')) {
    payload.prompt_optimizer = true
  }

  // --- Pika ---
  // Pika uses transition-based timing, no duration param
  else if (modelId.includes('pika')) {
    if (input.resolution) {
      payload.resolution = input.resolution
    }
    if (input.negativePrompt) {
      payload.negative_prompt = input.negativePrompt
    }
  }

  // Common: seed
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

// =============================================================================
// 3D Model Generation
// =============================================================================

export interface Model3DGenerationInput {
  modelId: string

  // Common
  prompt?: string
  seed?: number

  // Image inputs (varies by model)
  imageUrl?: string // Single image
  imageUrls?: string[] // Multi-image models
  backImageUrl?: string // Hunyuan3D multi-view
  leftImageUrl?: string
  rightImageUrl?: string

  // Mesh controls
  enablePbr?: boolean
  faceCount?: number // Hunyuan: 40000-1500000
  generateType?: 'Normal' | 'LowPoly' | 'Geometry'
  polygonType?: 'triangle' | 'quadrilateral'
  topology?: 'quad' | 'triangle'
  targetPolycount?: number
  shouldRemesh?: boolean
  symmetryMode?: 'off' | 'auto' | 'on'

  // Meshy-specific
  mode?: 'preview' | 'full'
  artStyle?: 'realistic' | 'sculpture'
  shouldTexture?: boolean
  enablePromptExpansion?: boolean
  texturePrompt?: string
  textureImageUrl?: string
  isATpose?: boolean

  // Rodin-specific
  geometryFileFormat?: 'glb' | 'usdz' | 'fbx' | 'obj' | 'stl'
  material?: 'PBR' | 'Shaded' | 'All'
  qualityMeshOption?: string
  useOriginalAlpha?: boolean
  addons?: 'HighPack'
  previewRender?: boolean

  // SAM-specific
  maskUrls?: string[]
  samPrompt?: string // For SAM object segmentation
  pointPrompts?: Array<{
    x: number
    y: number
    label: 0 | 1
    objectId?: number
  }>
  boxPrompts?: Array<{
    xMin: number
    yMin: number
    xMax: number
    yMax: number
    objectId?: number
  }>
  exportMeshes?: boolean
  include3dKeypoints?: boolean
  exportTexturedGlb?: boolean

  // Hunyuan World
  labelsFg1?: string
  labelsFg2?: string
  classes?: string
  exportDrc?: boolean
}

export interface Fal3DModelResult {
  // Common outputs
  model_glb?: {
    url: string
    file_size?: number
    file_name?: string
    content_type?: string
  }
  thumbnail?: {
    url: string
    file_size?: number
    file_name?: string
    content_type?: string
  }
  model_urls?: {
    glb?: { url: string }
    obj?: { url: string }
    fbx?: { url: string }
    usdz?: { url: string }
    stl?: { url: string }
    blend?: { url: string }
  }
  texture_urls?: Array<{
    base_color?: { url: string }
    metallic?: { url: string }
    normal?: { url: string }
    roughness?: { url: string }
  }>
  seed?: number

  // SAM 3D Objects specific
  gaussian_splat?: { url: string }
  individual_splats?: Array<{ url: string }>
  individual_glbs?: Array<{ url: string }>
  metadata?: unknown

  // SAM 3D Body specific
  visualization?: { url: string }
  meshes?: Array<{ url: string }>

  // Rodin specific
  model_mesh?: { url: string }
  textures?: Array<{ url: string }>

  // Bytedance Seed3D specific
  model?: { url: string }

  // Hunyuan World specific
  world_file?: { url: string }
}

/**
 * Start a 3D model generation job (queued)
 * Supports text-to-3d, image-to-3d, and image-to-world generation
 */
export async function generate3DModel(
  input: Model3DGenerationInput,
): Promise<GenerationJob> {
  const modelConfig = get3DModelById(input.modelId)

  if (!modelConfig) {
    throw new Error(`Unknown 3D model: ${input.modelId}`)
  }

  console.log('[FAL] generate3DModel called:', {
    modelId: input.modelId,
    endpoint: modelConfig.endpoint,
    prompt: input.prompt?.slice(0, 50),
  })

  if (MOCK_FAL) {
    console.log('[FAL] Using MOCK mode')
    return mockGenerate3DJob(modelConfig.endpoint)
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    throw new Error('FAL_KEY not configured')
  }

  // Build the request payload based on model
  const payload = build3DModelPayload(input, modelConfig)

  console.log('[FAL] 3D Model payload:', JSON.stringify(payload, null, 2))

  const response = await fetch(`${FAL_API_URL}/${modelConfig.endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[FAL] 3D Model submit error:', error)
    throw new Error(`Fal.ai error: ${response.status} - ${error}`)
  }

  const data: FalQueueResponse = await response.json()
  console.log('[FAL] 3D Model submit success:', {
    request_id: data.request_id,
    status_url: data.status_url,
    response_url: data.response_url,
  })

  return {
    requestId: data.request_id,
    status: 'pending',
    model: modelConfig.endpoint,
    provider: 'fal',
    statusUrl: data.status_url,
    responseUrl: data.response_url,
    cancelUrl: data.cancel_url,
  }
}

/**
 * Build payload for 3D model generation based on model type
 */
function build3DModelPayload(
  input: Model3DGenerationInput,
  modelConfig: Model3DConfig,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  // =============================================================================
  // Hunyuan3D V3 Text-to-3D
  // =============================================================================
  if (modelConfig.id === 'hunyuan3d-v3-text') {
    payload.prompt = input.prompt
    if (input.enablePbr !== undefined) payload.enable_pbr = input.enablePbr
    if (input.faceCount) payload.face_count = input.faceCount
    if (input.generateType) payload.generate_type = input.generateType
    if (input.polygonType) payload.polygon_type = input.polygonType
  }

  // =============================================================================
  // Meshy 6 Preview Text-to-3D
  // =============================================================================
  else if (modelConfig.id === 'meshy-v6-text') {
    payload.prompt = input.prompt
    payload.mode = input.mode || 'full'
    if (input.artStyle) payload.art_style = input.artStyle
    if (input.seed !== undefined) payload.seed = input.seed
    if (input.topology) payload.topology = input.topology
    if (input.targetPolycount) payload.target_polycount = input.targetPolycount
    if (input.shouldRemesh !== undefined)
      payload.should_remesh = input.shouldRemesh
    if (input.symmetryMode) payload.symmetry_mode = input.symmetryMode
    if (input.isATpose !== undefined) payload.is_a_t_pose = input.isATpose
    if (input.enablePbr !== undefined) payload.enable_pbr = input.enablePbr
    if (input.enablePromptExpansion !== undefined)
      payload.enable_prompt_expansion = input.enablePromptExpansion
    if (input.texturePrompt) payload.texture_prompt = input.texturePrompt
    if (input.textureImageUrl) payload.texture_image_url = input.textureImageUrl
  }

  // =============================================================================
  // Hunyuan3D V3 Sketch-to-3D
  // =============================================================================
  else if (modelConfig.id === 'hunyuan3d-v3-sketch') {
    payload.input_image_url = input.imageUrl
    payload.prompt = input.prompt
    if (input.enablePbr !== undefined) payload.enable_pbr = input.enablePbr
    if (input.faceCount) payload.face_count = input.faceCount
  }

  // =============================================================================
  // Hunyuan3D V3 Image-to-3D
  // =============================================================================
  else if (modelConfig.id === 'hunyuan3d-v3-image') {
    payload.input_image_url = input.imageUrl || input.imageUrls?.[0]
    if (input.backImageUrl) payload.back_image_url = input.backImageUrl
    if (input.leftImageUrl) payload.left_image_url = input.leftImageUrl
    if (input.rightImageUrl) payload.right_image_url = input.rightImageUrl
    if (input.enablePbr !== undefined) payload.enable_pbr = input.enablePbr
    if (input.faceCount) payload.face_count = input.faceCount
    if (input.generateType) payload.generate_type = input.generateType
    if (input.polygonType) payload.polygon_type = input.polygonType
  }

  // =============================================================================
  // Meshy 6 Image-to-3D
  // =============================================================================
  else if (modelConfig.id === 'meshy-v6-image') {
    payload.image_url = input.imageUrl || input.imageUrls?.[0]
    if (input.topology) payload.topology = input.topology
    if (input.targetPolycount) payload.target_polycount = input.targetPolycount
    if (input.symmetryMode) payload.symmetry_mode = input.symmetryMode
    if (input.shouldRemesh !== undefined)
      payload.should_remesh = input.shouldRemesh
    if (input.shouldTexture !== undefined)
      payload.should_texture = input.shouldTexture
    if (input.enablePbr !== undefined) payload.enable_pbr = input.enablePbr
    if (input.isATpose !== undefined) payload.is_a_t_pose = input.isATpose
    if (input.texturePrompt) payload.texture_prompt = input.texturePrompt
    if (input.textureImageUrl) payload.texture_image_url = input.textureImageUrl
  }

  // =============================================================================
  // Meshy 5 Multi-Image-to-3D
  // =============================================================================
  else if (modelConfig.id === 'meshy-v5-multi') {
    payload.image_urls = input.imageUrls || [input.imageUrl]
    if (input.topology) payload.topology = input.topology
    if (input.targetPolycount) payload.target_polycount = input.targetPolycount
    if (input.symmetryMode) payload.symmetry_mode = input.symmetryMode
    if (input.shouldRemesh !== undefined)
      payload.should_remesh = input.shouldRemesh
    if (input.shouldTexture !== undefined)
      payload.should_texture = input.shouldTexture
    if (input.enablePbr !== undefined) payload.enable_pbr = input.enablePbr
    if (input.isATpose !== undefined) payload.is_a_t_pose = input.isATpose
    if (input.texturePrompt) payload.texture_prompt = input.texturePrompt
    if (input.textureImageUrl) payload.texture_image_url = input.textureImageUrl
  }

  // =============================================================================
  // Hyper3D Rodin V2
  // =============================================================================
  else if (modelConfig.id === 'rodin-v2') {
    if (input.prompt) payload.prompt = input.prompt
    payload.input_image_urls =
      input.imageUrls || (input.imageUrl ? [input.imageUrl] : [])
    if (input.useOriginalAlpha !== undefined)
      payload.use_original_alpha = input.useOriginalAlpha
    if (input.seed !== undefined) payload.seed = input.seed
    payload.geometry_file_format = input.geometryFileFormat || 'glb'
    payload.material = input.material || 'All'
    payload.quality_mesh_option = input.qualityMeshOption || '500K Triangle'
    if (input.isATpose !== undefined) payload.TAPose = input.isATpose
    if (input.addons) payload.addons = input.addons
    if (input.previewRender !== undefined)
      payload.preview_render = input.previewRender
  }

  // =============================================================================
  // Bytedance Seed3D
  // =============================================================================
  else if (modelConfig.id === 'seed3d') {
    payload.image_url = input.imageUrl || input.imageUrls?.[0]
  }

  // =============================================================================
  // SAM 3D Objects
  // =============================================================================
  else if (modelConfig.id === 'sam3d-objects') {
    payload.image_url = input.imageUrl || input.imageUrls?.[0]
    if (input.maskUrls && input.maskUrls.length > 0)
      payload.mask_urls = input.maskUrls
    if (input.samPrompt) payload.prompt = input.samPrompt
    if (input.pointPrompts && input.pointPrompts.length > 0) {
      payload.point_prompts = input.pointPrompts.map((p) => ({
        x: p.x,
        y: p.y,
        label: p.label,
        object_id: p.objectId,
      }))
    }
    if (input.boxPrompts && input.boxPrompts.length > 0) {
      payload.box_prompts = input.boxPrompts.map((b) => ({
        x_min: b.xMin,
        y_min: b.yMin,
        x_max: b.xMax,
        y_max: b.yMax,
        object_id: b.objectId,
      }))
    }
    if (input.seed !== undefined) payload.seed = input.seed
    if (input.exportTexturedGlb !== undefined)
      payload.export_textured_glb = input.exportTexturedGlb
  }

  // =============================================================================
  // SAM 3D Body
  // =============================================================================
  else if (modelConfig.id === 'sam3d-body') {
    payload.image_url = input.imageUrl || input.imageUrls?.[0]
    if (input.maskUrls && input.maskUrls.length > 0)
      payload.mask_url = input.maskUrls[0]
    payload.export_meshes = input.exportMeshes !== false // default true
    payload.include_3d_keypoints = input.include3dKeypoints !== false // default true
  }

  // =============================================================================
  // Hunyuan World
  // =============================================================================
  else if (modelConfig.id === 'hunyuan-world') {
    payload.image_url = input.imageUrl || input.imageUrls?.[0]
    payload.labels_fg1 = input.labelsFg1 || ''
    payload.labels_fg2 = input.labelsFg2 || ''
    payload.classes = input.classes || ''
    if (input.exportDrc !== undefined) payload.export_drc = input.exportDrc
  }

  return payload
}

/**
 * Mock 3D model generation for development
 */
function mockGenerate3DJob(endpoint: string): GenerationJob {
  const requestId = `mock-3d-${Date.now()}-${Math.random().toString(36).slice(2)}`

  mockJobs.set(requestId, { startTime: Date.now(), type: 'video' }) // Use video timing (longer)

  const mockBaseUrl = `https://queue.fal.run/${endpoint}/requests/${requestId}`

  return {
    requestId,
    status: 'pending',
    model: endpoint,
    provider: 'fal',
    statusUrl: `${mockBaseUrl}/status`,
    responseUrl: mockBaseUrl,
    cancelUrl: `${mockBaseUrl}/cancel`,
  }
}
