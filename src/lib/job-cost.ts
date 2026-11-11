/**
 * What a submitted job will cost — the number stored on the job
 * (`GenerationJob.estimatedCostUsd`, `Model3DAsset.estimatedCostUsd`) and
 * summed into Settings → Usage.
 *
 * These mirror what each lab's Generate button shows, so the stored cost is
 * the one the user saw before the click. fal's per-request billing API is
 * enterprise-only, so this stays an estimate; a range (token-billed models,
 * SeedVR's unknown frame rate) is stored as its midpoint.
 *
 * Shared by client and server — no server-only imports.
 */

import { estimateCost } from './pricing'
import { estimateVideoUpscale } from './video-upscale-cost'
import type { CostEstimate } from './pricing'
import type { Model3DConfig } from '@/server/services/types'
import {
  AUDIO_MODELS,
  EDIT_MODELS,
  HUNYUAN_DEFAULT_FACE_COUNT,
  IMAGE_MODELS,
  MOTION_CONTROL_MODELS,
  MUSIC_MODELS,
  SFX_MODELS,
  UPSCALE_MODELS,
  VIDEO_MODELS,
  VIDEO_UPSCALE_MODELS,
} from '@/server/services/types'

/** One number for a stored estimate: the midpoint, to a hundredth of a cent */
export function toUsd(estimate: CostEstimate | null): number | null {
  if (!estimate) return null
  return Math.round(((estimate.min + estimate.max) / 2) * 10_000) / 10_000
}

function find<T extends { id: string }>(
  list: ReadonlyArray<T>,
  id: string,
): T | undefined {
  return list.find((m) => m.id === id)
}

// ---- images ---------------------------------------------------------------

export function imageJobCost(
  modelId: string,
  input: {
    width?: number
    height?: number
    quality?: string
    numImages?: number
  },
): number | null {
  const model = find(IMAGE_MODELS, modelId)
  return toUsd(
    estimateCost(model?.pricing, {
      numImages: model?.supportsNumImages ? input.numImages : 1,
      width: input.width ?? 1024,
      height: input.height ?? 1024,
      quality: input.quality,
      resolution: '1K',
    }),
  )
}

/** Edits are priced per output image; megapixel models assume ~1MP output */
export function editJobCost(
  modelId: string,
  input: { quality?: string; numImages?: number },
): number | null {
  const model = find(EDIT_MODELS, modelId)
  return toUsd(
    estimateCost(model?.pricing, {
      numImages: input.numImages,
      quality: input.quality,
      resolution: '1K',
    }),
  )
}

const SEEDVR_TARGET_HEIGHT: Record<string, number> = {
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '2160p': 2160,
}

/** Image upscalers bill output megapixels */
export function imageUpscaleOutput(input: {
  modelId: string
  sourceWidth?: number
  sourceHeight?: number
  scale?: number
  upscaleMode?: 'factor' | 'target'
  targetResolution?: string
}): { width: number; height: number } {
  const w = input.sourceWidth ?? 1024
  const h = input.sourceHeight ?? 1024
  const target =
    input.modelId.includes('seedvr') && input.upscaleMode === 'target'
      ? SEEDVR_TARGET_HEIGHT[input.targetResolution ?? '']
      : undefined
  if (target) return { width: Math.round((target * w) / h), height: target }
  const scale = input.scale ?? 2
  return { width: w * scale, height: h * scale }
}

export function imageUpscaleJobCost(
  modelId: string,
  input: Omit<Parameters<typeof imageUpscaleOutput>[0], 'modelId'>,
): number | null {
  const model = find(UPSCALE_MODELS, modelId)
  return toUsd(
    estimateCost(model?.pricing, imageUpscaleOutput({ ...input, modelId })),
  )
}

// ---- video ----------------------------------------------------------------

/** Defaults match buildVideoPayload: first listed length, model's resolution, audio on */
export function videoJobCost(
  modelId: string,
  input: { duration?: number; resolution?: string; generateAudio?: boolean },
): number | null {
  const model = find(VIDEO_MODELS, modelId)
  if (!model) return null
  return toUsd(
    estimateCost(model.pricing, {
      durationSec: input.duration || model.durations[0] || 5,
      resolution: input.resolution ?? model.defaultResolution,
      audio: model.supportsAudio ? (input.generateAudio ?? true) : undefined,
    }),
  )
}

/** Output follows the reference clip, capped by orientation; unknown length → the cap */
export function motionJobCost(
  modelId: string,
  input: {
    referenceDurationSec?: number
    characterOrientation?: 'video' | 'image'
  },
): number | null {
  const model = find(MOTION_CONTROL_MODELS, modelId)
  if (!model) return null
  const cap =
    input.characterOrientation === 'image'
      ? (model.maxDurationImage ?? 10)
      : (model.maxDurationVideo ?? 30)
  const seconds = input.referenceDurationSec
    ? Math.min(input.referenceDurationSec, cap)
    : cap
  return toUsd(estimateCost(model.pricing, { durationSec: seconds }))
}

export function videoUpscaleJobCost(
  modelId: string,
  input: {
    sourceWidth?: number
    sourceHeight?: number
    sourceDurationSec?: number
    upscaleFactor?: number
    upscaleMode?: 'factor' | 'target'
    seedvrTargetResolution?: string
    targetFps?: number
    bytedanceTargetResolution?: string
    bytedanceTargetFps?: string
  },
): number | null {
  const model = find(VIDEO_UPSCALE_MODELS, modelId)
  if (!input.sourceWidth || !input.sourceHeight || !input.sourceDurationSec) {
    return null
  }
  const isBytedance = modelId.includes('bytedance')
  return toUsd(
    estimateVideoUpscale(
      model?.pricing,
      {
        width: input.sourceWidth,
        height: input.sourceHeight,
        durationSec: input.sourceDurationSec,
      },
      {
        modelId,
        factor: input.upscaleFactor,
        targetHeight:
          input.upscaleMode === 'target' && input.seedvrTargetResolution
            ? Number.parseInt(input.seedvrTargetResolution, 10)
            : undefined,
        bytedanceResolution: input.bytedanceTargetResolution,
        fps: isBytedance
          ? Number.parseInt(input.bytedanceTargetFps ?? '30', 10)
          : input.targetFps,
      },
    ),
  )
}

// ---- audio ----------------------------------------------------------------

export function speechJobCost(modelId: string, text: string): number | null {
  const model = find(AUDIO_MODELS, modelId)
  return toUsd(estimateCost(model?.pricing, { chars: text.length }))
}

/** Auto length (no duration) is priced at the model's ceiling until the clip exists */
export function sfxJobCost(
  modelId: string,
  durationSec: number | undefined,
): number | null {
  const model = find(SFX_MODELS, modelId)
  return toUsd(
    estimateCost(model?.pricing, {
      durationSec: durationSec ?? model?.maxDurationSec,
    }),
  )
}

export function musicJobCost(
  modelId: string,
  durationSec: number,
): number | null {
  const model = find(MUSIC_MODELS, modelId)
  return toUsd(estimateCost(model?.pricing, { durationSec }))
}

// ---- 3D -------------------------------------------------------------------

/**
 * Hunyuan3D bills by generate type plus +$0.15 each for PBR, a custom face
 * count and multi-view input; Meshy bills $0.80 untextured / $1.20 textured;
 * the rest are flat.
 */
export function model3DCost(
  model: Model3DConfig | undefined,
  options: {
    enablePbr?: boolean
    faceCount?: number
    generateType?: string
    /** Meshy text-to-3D: 'preview' is untextured */
    meshyMode?: 'preview' | 'full'
    imageCount?: number
  } = {},
): CostEstimate | null {
  if (!model) return null
  const isHunyuan = model.id.startsWith('hunyuan3d')
  const isMeshy = model.id.startsWith('meshy')
  const addOns: Array<string> = []
  if (isHunyuan) {
    if (options.enablePbr) addOns.push('pbr')
    if (options.faceCount && options.faceCount !== HUNYUAN_DEFAULT_FACE_COUNT) {
      addOns.push('faceCount')
    }
    if ((options.imageCount ?? 0) > 1) addOns.push('multiView')
  }
  const quality = isHunyuan
    ? (options.generateType ?? 'Normal')
    : isMeshy
      ? options.meshyMode === 'preview'
        ? 'untextured'
        : 'textured'
      : undefined
  return estimateCost(model.pricing, { quality, addOns })
}
