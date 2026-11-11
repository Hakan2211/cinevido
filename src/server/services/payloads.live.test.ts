/**
 * Live schema check — builds the exact payload we would send for every model
 * in the catalog and validates it against that endpoint's OpenAPI schema on
 * fal. Reading schemas is free (nothing is generated), but it needs the
 * network, so it only runs when you opt in:
 *
 *   LIVE_FAL_SCHEMA=1 npx vitest run src/server/services/payloads.live.test.ts
 *
 * Optional: FAL_KEY raises fal's rate limit for the schema reads.
 *
 * What it pins: field names, enum values, integer/number types and ranges.
 * fal rejects an unknown or out-of-range field with a 422 only after the job
 * is queued, so without this a typo would surface as a failed generation.
 */

import { describe, expect, it } from 'vitest'
import {
  build3DModelPayload,
  buildMotionControlPayload,
  buildImagePayload,
  buildVideoPayload,
} from './fal.server'
import { buildEditPayload } from './edit.server'
import { buildMusicPayload } from './music.server'
import { buildSpeechPayload } from './tts.server'
import { buildSoundEffectPayload } from './sfx.server'
import {
  AUDIO_MODELS,
  EDIT_MODELS,
  IMAGE_MODELS,
  IMAGE_TO_3D_MODELS,
  MOTION_CONTROL_MODELS,
  MUSIC_MODELS,
  SFX_MODELS,
  TEXT_TO_3D_MODELS,
  TTS_VOICES,
  VIDEO_MODELS,
  aspectRatioToGptImageSize,
  isGptImageModel,
} from './types'
import type { VideoCapability } from './types'

const live = it.skipIf(!process.env.LIVE_FAL_SCHEMA)

// =============================================================================
// Schema fetch + a small JSON-schema validator (just what fal's specs use)
// =============================================================================

type Schema = Record<string, any>

const cache = new Map<string, { input: Schema; refs: Record<string, Schema> }>()

async function fetchInputSchema(endpointId: string) {
  const hit = cache.get(endpointId)
  if (hit) return hit
  const headers: Record<string, string> = {}
  if (process.env.FAL_KEY) headers.Authorization = `Key ${process.env.FAL_KEY}`
  const url = `https://api.fal.ai/v1/models?expand=openapi-3.0&endpoint_id=${encodeURIComponent(endpointId)}`
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers })
    if (res.status === 429 && attempt < 8) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
      continue
    }
    if (!res.ok) throw new Error(`${endpointId}: schema fetch ${res.status}`)
    const body = await res.json()
    const spec = body.models?.[0]?.openapi
    if (!spec) throw new Error(`${endpointId}: no OpenAPI schema published`)
    const refs: Record<string, Schema> = spec.components?.schemas ?? {}
    for (const path of Object.values<any>(spec.paths ?? {})) {
      const body = path.post?.requestBody?.content?.['application/json']?.schema
      if (body) {
        const entry = { input: deref(body, refs), refs }
        cache.set(endpointId, entry)
        return entry
      }
    }
    throw new Error(`${endpointId}: no request body in schema`)
  }
}

function deref(s: Schema, refs: Record<string, Schema>): Schema {
  return s?.$ref ? refs[s.$ref.split('/').pop()!] : s
}

function check(
  value: unknown,
  raw: Schema,
  refs: Record<string, Schema>,
  path: string,
): Array<string> {
  const s = deref(raw, refs)
  if (!s) return []
  const variants = s.anyOf ?? s.oneOf
  if (variants) {
    const results = variants.map((v: Schema) => check(value, v, refs, path))
    return results.some((r: Array<string>) => r.length === 0)
      ? []
      : [`${path}: ${JSON.stringify(value)} matches no allowed form`]
  }
  if (s.enum && !s.enum.includes(value)) {
    return [
      `${path}: ${JSON.stringify(value)} not in ${JSON.stringify(s.enum)}`,
    ]
  }
  const errors: Array<string> = []
  switch (s.type) {
    case 'null':
      if (value !== null) errors.push(`${path}: expected null`)
      break
    case 'string':
      if (typeof value !== 'string') errors.push(`${path}: expected string`)
      break
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`${path}: expected boolean`)
      break
    case 'integer':
    case 'number':
      if (typeof value !== 'number') errors.push(`${path}: expected number`)
      else if (s.type === 'integer' && !Number.isInteger(value))
        errors.push(`${path}: expected integer, got ${value}`)
      else if (s.minimum !== undefined && value < s.minimum)
        errors.push(`${path}: ${value} < minimum ${s.minimum}`)
      else if (s.maximum !== undefined && value > s.maximum)
        errors.push(`${path}: ${value} > maximum ${s.maximum}`)
      break
    case 'array':
      if (!Array.isArray(value)) errors.push(`${path}: expected array`)
      else {
        if (s.maxItems !== undefined && value.length > s.maxItems)
          errors.push(`${path}: ${value.length} items > maxItems ${s.maxItems}`)
        value.forEach((v, i) =>
          errors.push(...check(v, s.items ?? {}, refs, `${path}[${i}]`)),
        )
      }
      break
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value))
        errors.push(`${path}: expected object`)
      else
        errors.push(
          ...checkObject(value as Record<string, unknown>, s, refs, path),
        )
      break
  }
  return errors
}

function checkObject(
  value: Record<string, unknown>,
  s: Schema,
  refs: Record<string, Schema>,
  path: string,
): Array<string> {
  const errors: Array<string> = []
  const props: Record<string, Schema> = s.properties ?? {}
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) continue
    if (!(key in props))
      errors.push(`${path}.${key}: not a field of this endpoint`)
    else errors.push(...check(v, props[key], refs, `${path}.${key}`))
  }
  for (const req of s.required ?? []) {
    if (value[req] === undefined)
      errors.push(`${path}.${req}: required but missing`)
  }
  return errors
}

async function validate(endpointId: string, payload: Record<string, unknown>) {
  const { input, refs } = await fetchInputSchema(endpointId)
  return checkObject(payload, input, refs, endpointId)
}

const IMG = 'https://v3.fal.media/files/example/input.png'
const TIMEOUT = 600_000

// =============================================================================
// Cases
// =============================================================================

describe('catalog payloads match fal schemas', () => {
  live(
    'the validator rejects the mistakes it exists to catch',
    async () => {
      const errors = await validate('kling/v4/text-to-video', {
        prompt: 'x',
        duration: '5', // Kling 4 wants an integer
        aspect_ratio: '4:5', // not offered
        generate_audio: true, // not a Kling 4 field
      })
      expect(errors).toHaveLength(3)
      const missing = await validate('fal-ai/veo3.1/image-to-video', {
        prompt: 'x',
      })
      expect(missing.join()).toContain('image_url: required but missing')
    },
    TIMEOUT,
  )

  live(
    'image models',
    async () => {
      const errors: Array<string> = []
      for (const m of IMAGE_MODELS) {
        for (const [w, h] of [
          [1024, 1024],
          [1024, 576],
          [576, 1024],
        ]) {
          const aspect = w === h ? '1:1' : w > h ? '16:9' : '9:16'
          const payload = buildImagePayload(
            {
              prompt: 'a lighthouse at dusk',
              model: m.id,
              width: w,
              height: h,
              numImages: 2,
              negativePrompt: 'blurry',
              seed: 42,
              quality: 'high',
              outputFormat: 'png',
              imageSizePreset: isGptImageModel(m.id)
                ? aspectRatioToGptImageSize(aspect)
                : undefined,
            },
            m.id,
          )
          errors.push(...(await validate(m.id, payload)))
        }
      }
      expect(errors).toEqual([])
    },
    TIMEOUT,
  )

  live(
    'edit models',
    async () => {
      const errors: Array<string> = []
      for (const m of EDIT_MODELS) {
        const payload = buildEditPayload(
          {
            prompt: 'make it night',
            imageUrls: [IMG, IMG],
            model: m.id,
            seed: 42,
            quality: 'high',
            outputFormat: 'png',
            numImages: 1,
          },
          m.id,
        )
        errors.push(...(await validate(m.id, payload)))
        for (const aspectRatio of m.aspectRatios ?? []) {
          const sized = buildEditPayload(
            { prompt: 'make it night', imageUrls: [IMG], model: m.id, aspectRatio },
            m.id,
          )
          errors.push(...(await validate(m.id, sized)))
        }
      }
      expect(errors).toEqual([])
    },
    TIMEOUT,
  )

  live(
    'video models — every mode, duration, aspect ratio and resolution',
    async () => {
      const errors: Array<string> = []
      for (const m of VIDEO_MODELS) {
        for (const generationType of m.capabilities as Array<VideoCapability>) {
          const variants = [
            ...m.durations.map((duration) => ({ duration })),
            ...(m.aspectRatios ?? []).map((aspectRatio) => ({ aspectRatio })),
            ...(m.resolutions ?? []).map((resolution) => ({ resolution })),
          ]
          for (const v of variants) {
            const payload = buildVideoPayload(
              {
                generationType,
                prompt: 'slow push-in on a misty valley',
                model: m.id,
                imageUrl: IMG,
                firstFrameUrl: IMG,
                lastFrameUrl: IMG,
                generateAudio: false,
                negativePrompt: 'shaky',
                seed: 42,
                ...v,
              },
              m.id,
              m,
            )
            errors.push(...(await validate(m.id, payload)))
          }
        }
      }
      expect(errors).toEqual([])
    },
    TIMEOUT,
  )

  live(
    'music models',
    async () => {
      const errors: Array<string> = []
      for (const m of MUSIC_MODELS) {
        const payload = buildMusicPayload(
          {
            prompt: 'warm lo-fi piano, rain',
            model: m.id,
            lyrics: 'la la la',
            instrumental: false,
            durationSec: 30,
            seed: 7,
          },
          m.id,
        )
        errors.push(...(await validate(m.id, payload)))
      }
      expect(errors).toEqual([])
    },
    TIMEOUT,
  )

  live(
    'speech models',
    async () => {
      const errors: Array<string> = []
      for (const m of AUDIO_MODELS) {
        for (const voice of [TTS_VOICES[0].name, 'Brian']) {
          const payload = buildSpeechPayload({
            text: '[calm] Hello there.',
            voice,
            model: m.id,
            stability: 0.4,
            seed: 3,
          })
          errors.push(...(await validate(m.id, payload)))
        }
      }
      expect(errors).toEqual([])
    },
    TIMEOUT,
  )

  live(
    'motion-control models',
    async () => {
      const errors: Array<string> = []
      for (const m of MOTION_CONTROL_MODELS) {
        for (const characterOrientation of ['video', 'image'] as const) {
          const payload = buildMotionControlPayload({
            imageUrl: IMG,
            videoUrl: 'https://example.com/dance.mp4',
            prompt: 'a man dancing',
            model: m.id,
            characterOrientation,
            keepOriginalSound: false,
          })
          errors.push(...(await validate(m.id, payload)))
        }
      }
      expect(errors).toEqual([])
    },
    TIMEOUT,
  )

  live(
    'sound-effect models',
    async () => {
      const errors: Array<string> = []
      for (const m of SFX_MODELS) {
        for (const durationSec of [undefined, 0.5, 4, 30]) {
          const payload = buildSoundEffectPayload(
            {
              prompt: 'a heavy door slams in a stone hall',
              durationSec,
              loop: durationSec === 4,
              promptInfluence: 0.5,
            },
            m.id,
          )
          errors.push(...(await validate(m.id, payload)))
        }
      }
      expect(errors).toEqual([])
    },
    TIMEOUT,
  )

  live(
    '3D models we changed (Meshy 7.1, Hunyuan3D V3)',
    async () => {
      const errors: Array<string> = []
      const meshy = [...TEXT_TO_3D_MODELS, ...IMAGE_TO_3D_MODELS].filter(
        (m) => m.id.startsWith('meshy-') || m.id.startsWith('hunyuan3d'),
      )
      for (const m of meshy) {
        const payload = build3DModelPayload(
          {
            modelId: m.id,
            prompt: 'a ceramic teapot',
            imageUrl: IMG,
            imageUrls: [IMG, IMG],
            seed: 1,
            topology: 'quad',
            targetPolycount: 30000,
            shouldRemesh: true,
            symmetryMode: 'auto',
            enablePbr: true,
            faceCount: 200000,
            generateType: 'LowPoly',
          },
          m,
        )
        errors.push(...(await validate(m.endpoint, payload)))
      }
      expect(errors).toEqual([])
    },
    TIMEOUT,
  )
})
