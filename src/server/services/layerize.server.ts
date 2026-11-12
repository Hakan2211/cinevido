/**
 * Seedream 5.5 Layerize via fal's queue: one image in, a base image plus
 * cut-out PNG layers out (each with z order, bounding box, name, description
 * and, optionally, recognised text).
 *
 * Runs on the user's own fal key (BYOK). MOCK_GENERATION=true returns
 * placeholder layers without calling fal.
 */

import { DEFAULT_MODELS, LAYERIZE_MODELS } from './types'

const MOCK = process.env.MOCK_GENERATION === 'true'
const FAL_QUEUE_URL = 'https://queue.fal.run'

export interface LayerizeInput {
  imageUrl: string
  /** names the elements to separate; empty → the model picks */
  prompt?: string
  /** layers to return, not counting the base */
  maxLayers: number
  textRecognition?: boolean
}

export interface FalLayerImage {
  url: string
  width?: number
  height?: number
  content_type?: string
}

export interface FalLayer {
  image: FalLayerImage
  z_index: number
  bounding_box?: {
    absolute?: [number, number, number, number]
    normalized?: [number, number, number, number]
  }
  name?: string
  description?: string
  text_recognition?: { text: string; lines?: Array<unknown> }
}

export interface FalLayerizeResult {
  images?: Array<FalLayerImage>
  layers?: Array<FalLayer>
}

export interface LayerizeJob {
  requestId: string
  statusUrl: string
  responseUrl: string
  cancelUrl?: string
}

// Exported for the schema check in services/payloads.live.test.ts
export function buildLayerizePayload(input: LayerizeInput) {
  const model = LAYERIZE_MODELS[0]
  const payload: Record<string, unknown> = {
    image_url: input.imageUrl,
    // `auto` keeps each element's aspect ratio and the base at source size
    image_size: 'auto',
    // fal counts the base image in max_images
    max_images: Math.min(model.maxOutputs, Math.max(2, input.maxLayers + 1)),
    output_format: 'png',
  }
  if (input.prompt?.trim()) payload.prompt = input.prompt.trim()
  if (input.textRecognition) payload.enable_text_recognition = true
  return payload
}

export async function submitLayerize(
  input: LayerizeInput,
  apiKey: string,
): Promise<LayerizeJob> {
  if (MOCK) {
    const id = `mock-layerize-${Date.now()}`
    mockJobs.set(id, { started: Date.now(), input })
    return {
      requestId: id,
      statusUrl: `mock://layerize/requests/${id}/status`,
      responseUrl: `mock://layerize/requests/${id}`,
    }
  }

  const res = await fetch(`${FAL_QUEUE_URL}/${DEFAULT_MODELS.layerize}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildLayerizePayload(input)),
  })
  if (!res.ok) {
    throw new Error(`fal error ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  if (!data.request_id || !data.status_url || !data.response_url) {
    throw new Error('fal did not return queue URLs for the layerize job')
  }
  return {
    requestId: data.request_id,
    statusUrl: data.status_url,
    responseUrl: data.response_url,
    cancelUrl: data.cancel_url,
  }
}

export async function getLayerizeStatus(
  statusUrl: string,
  responseUrl: string,
  apiKey: string,
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  queuePosition?: number
  result?: FalLayerizeResult
  error?: string
}> {
  if (statusUrl.startsWith('mock://')) return mockStatus(statusUrl)

  const headers = { Authorization: `Key ${apiKey}` }
  const statusRes = await fetch(statusUrl, { headers })
  if (!statusRes.ok) {
    return {
      status: 'failed',
      error: `Status check failed (${statusRes.status})`,
    }
  }
  const status = await statusRes.json()
  if (status.status === 'IN_QUEUE') {
    return { status: 'pending', queuePosition: status.queue_position }
  }
  if (status.status === 'IN_PROGRESS') return { status: 'processing' }
  if (status.status !== 'COMPLETED') {
    return { status: 'failed', error: status.error || 'Layerize failed' }
  }

  const resultRes = await fetch(responseUrl, { headers })
  if (!resultRes.ok) {
    const text = await resultRes.text()
    // fal answers a failed job's result with its validation error
    return { status: 'failed', error: text.slice(0, 500) }
  }
  return { status: 'completed', result: await resultRes.json() }
}

// ---- mock ------------------------------------------------------------------

const mockJobs = new Map<string, { started: number; input: LayerizeInput }>()

function mockStatus(statusUrl: string) {
  const id = statusUrl.split('/requests/')[1]?.split('/')[0] ?? ''
  const job = mockJobs.get(id)
  if (!job) {
    return { status: 'failed' as const, error: 'Mock job not found' }
  }
  if (Date.now() - job.started < 3000) {
    return { status: 'processing' as const }
  }
  mockJobs.delete(id)
  const W = 1536
  const H = 1024
  const boxes: Array<[number, number, number, number, string]> = [
    [180, 260, 700, 900, 'Person'],
    [820, 420, 1300, 880, 'Table with cups'],
    [960, 90, 1420, 330, 'Window light'],
    [60, 40, 520, 190, 'Headline text'],
  ]
  const n = Math.min(boxes.length, job.input.maxLayers)
  const layers: Array<FalLayer> = [
    {
      image: {
        url: `https://placehold.co/${W}x${H}/1a1a1d/6b6b70/png?text=Base`,
        width: W,
        height: H,
      },
      z_index: 0,
    },
    ...boxes.slice(0, n).map(([l, t, r, b, name], i) => ({
      image: {
        url: `https://placehold.co/${r - l}x${b - t}/3a3a40/e5e5e5/png?text=${encodeURIComponent(name)}`,
        width: r - l,
        height: b - t,
      },
      z_index: i + 1,
      bounding_box: {
        absolute: [l, t, r, b] as [number, number, number, number],
      },
      name,
      description: `Mock layer: ${name.toLowerCase()}`,
      ...(name === 'Headline text' && job.input.textRecognition
        ? { text_recognition: { text: 'MORNING ROAST', lines: [] } }
        : {}),
    })),
  ]
  return {
    status: 'completed' as const,
    result: { images: layers.map((l) => l.image), layers },
  }
}
