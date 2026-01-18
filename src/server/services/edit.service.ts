/**
 * Image Edit Service
 *
 * Handles AI image editing operations via Fal.ai API:
 * - Inpainting (edit masked regions)
 * - Outpainting (expand image beyond borders)
 * - Upscaling (enhance resolution with AI)
 * - Variations (create variations from reference)
 *
 * Environment variables required:
 * - FAL_KEY: Fal.ai API key
 */

import {
  EDIT_MODELS,
  UPSCALE_MODELS,
  VARIATION_MODELS,
  getModelById,
} from './types'

const MOCK_EDIT = process.env.MOCK_GENERATION === 'true'
const FAL_API_URL = 'https://queue.fal.run'

// =============================================================================
// Types
// =============================================================================

export interface InpaintInput {
  imageUrl: string
  maskUrl: string // Black = keep, White = replace
  prompt: string
  model?: string
  seed?: number
}

export interface OutpaintInput {
  imageUrl: string
  prompt: string
  model?: string
  // Direction to expand (pixels to add)
  top?: number
  bottom?: number
  left?: number
  right?: number
  seed?: number
}

export interface UpscaleInput {
  imageUrl: string
  model?: string
  scale?: number // 2 or 4
  creativity?: number // 0-1, how much to enhance vs preserve
  prompt?: string // Optional guidance for upscaling
  seed?: number
}

export interface VariationInput {
  imageUrl: string
  prompt?: string // Optional prompt to guide variation
  model?: string
  strength?: number // 0-1, how different from original
  seed?: number
}

export interface EditJob {
  requestId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  model: string
  provider: 'fal'
  editType: 'inpaint' | 'outpaint' | 'upscale' | 'variation'
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
 * Inpaint an image - replace masked regions with AI-generated content
 */
export async function inpaintImage(input: InpaintInput): Promise<EditJob> {
  const modelId = input.model || 'fal-ai/flux-pro/v1/fill'
  getModelById(modelId, EDIT_MODELS)

  if (MOCK_EDIT) {
    return mockEditJob(modelId, 'inpaint')
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    throw new Error('FAL_KEY not configured')
  }

  const payload = buildInpaintPayload(input, modelId)

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

  return {
    requestId: data.request_id,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    editType: 'inpaint',
  }
}

/**
 * Outpaint an image - expand beyond original borders
 */
export async function outpaintImage(input: OutpaintInput): Promise<EditJob> {
  const modelId = input.model || 'fal-ai/flux-pro/v1/fill'
  getModelById(modelId, EDIT_MODELS)

  if (MOCK_EDIT) {
    return mockEditJob(modelId, 'outpaint')
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    throw new Error('FAL_KEY not configured')
  }

  const payload = buildOutpaintPayload(input, modelId)

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

  return {
    requestId: data.request_id,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    editType: 'outpaint',
  }
}

/**
 * Upscale an image with AI enhancement
 */
export async function upscaleImage(input: UpscaleInput): Promise<EditJob> {
  const modelId = input.model || 'fal-ai/creative-upscaler'
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

  return {
    requestId: data.request_id,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    editType: 'upscale',
  }
}

/**
 * Create variations of an image
 */
export async function createVariation(input: VariationInput): Promise<EditJob> {
  const modelId = input.model || 'fal-ai/flux-pro/v1.1/redux'
  getModelById(modelId, VARIATION_MODELS)

  if (MOCK_EDIT) {
    return mockEditJob(modelId, 'variation')
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    throw new Error('FAL_KEY not configured')
  }

  const payload = buildVariationPayload(input, modelId)

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

  return {
    requestId: data.request_id,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    editType: 'variation',
  }
}

/**
 * Check the status of an edit job
 */
export async function getEditJobStatus(
  requestId: string,
  modelId: string,
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  result?: FalEditResult
  error?: string
}> {
  if (MOCK_EDIT) {
    return mockGetEditStatus(requestId)
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    throw new Error('FAL_KEY not configured')
  }

  const statusResponse = await fetch(
    `${FAL_API_URL}/${modelId}/requests/${requestId}/status`,
    {
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    },
  )

  if (!statusResponse.ok) {
    throw new Error(`Failed to get status: ${statusResponse.status}`)
  }

  const statusData = await statusResponse.json()

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

  if (status === 'completed') {
    const resultResponse = await fetch(
      `${FAL_API_URL}/${modelId}/requests/${requestId}`,
      {
        headers: {
          Authorization: `Key ${apiKey}`,
        },
      },
    )

    if (!resultResponse.ok) {
      throw new Error(`Failed to get result: ${resultResponse.status}`)
    }

    const result = await resultResponse.json()
    return { status, result }
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

/**
 * Get available variation models
 */
export function getVariationModels() {
  return VARIATION_MODELS
}

// =============================================================================
// Payload Builders
// =============================================================================

function buildInpaintPayload(input: InpaintInput, modelId: string) {
  const payload: Record<string, unknown> = {
    image_url: input.imageUrl,
    mask_url: input.maskUrl,
    prompt: input.prompt,
  }

  if (input.seed !== undefined) {
    payload.seed = input.seed
  }

  // Model-specific adjustments
  if (modelId.includes('flux-pro')) {
    payload.num_images = 1
    payload.output_format = 'jpeg'
  }

  if (modelId.includes('nano-banana')) {
    payload.num_images = 1
  }

  return payload
}

function buildOutpaintPayload(input: OutpaintInput, _modelId: string) {
  // For outpainting, we create a larger canvas with the original image
  // and a mask that covers the new areas
  const payload: Record<string, unknown> = {
    image_url: input.imageUrl,
    prompt: input.prompt,
    // Outpaint parameters - model will expand the image
    outpaint_top: input.top || 0,
    outpaint_bottom: input.bottom || 0,
    outpaint_left: input.left || 0,
    outpaint_right: input.right || 0,
  }

  if (input.seed !== undefined) {
    payload.seed = input.seed
  }

  return payload
}

function buildUpscalePayload(input: UpscaleInput, modelId: string) {
  const payload: Record<string, unknown> = {
    image_url: input.imageUrl,
    scale: input.scale || 2,
  }

  if (modelId.includes('creative-upscaler')) {
    payload.creativity = input.creativity ?? 0.5
    payload.detail = 1
    payload.shape_preservation = 0.25
    if (input.prompt) {
      payload.prompt = input.prompt
    }
  }

  if (modelId.includes('clarity-upscaler')) {
    // Clarity upscaler preserves more original detail
    payload.creativity = input.creativity ?? 0.2
  }

  if (input.seed !== undefined) {
    payload.seed = input.seed
  }

  return payload
}

function buildVariationPayload(input: VariationInput, modelId: string) {
  const payload: Record<string, unknown> = {
    image_url: input.imageUrl,
  }

  if (input.prompt) {
    payload.prompt = input.prompt
  }

  // Redux models use image_prompt_strength for variation amount
  if (modelId.includes('redux')) {
    // Higher strength = closer to original
    // We invert user's "strength" (how different) to "image_prompt_strength" (how similar)
    payload.image_prompt_strength = 1 - (input.strength ?? 0.3)
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
    editType: 'inpaint' | 'outpaint' | 'upscale' | 'variation'
  }
>()

function mockEditJob(
  modelId: string,
  editType: 'inpaint' | 'outpaint' | 'upscale' | 'variation',
): EditJob {
  const requestId = `mock-edit-${Date.now()}-${Math.random().toString(36).slice(2)}`
  mockEditJobs.set(requestId, { startTime: Date.now(), editType })

  return {
    requestId,
    status: 'pending',
    model: modelId,
    provider: 'fal',
    editType,
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
    inpaint: 3000,
    outpaint: 4000,
    upscale: 5000,
    variation: 3000,
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
    inpaint: { width: 1024, height: 1024 },
    outpaint: { width: 1536, height: 1024 },
    upscale: { width: 2048, height: 2048 },
    variation: { width: 1024, height: 1024 },
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
