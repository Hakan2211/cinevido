import { describe, expect, it } from 'vitest'
import {
  editJobCost,
  imageJobCost,
  imageUpscaleOutput,
  model3DCost,
  motionJobCost,
  sfxJobCost,
  toUsd,
  videoJobCost,
  videoUpscaleJobCost,
} from './job-cost'
import { estimateCost, formatRate } from './pricing'
import {
  MOTION_CONTROL_MODELS,
  SFX_MODELS,
  TEXT_TO_3D_MODELS,
  VIDEO_MODELS,
} from '@/server/services/types'

describe('job cost', () => {
  it('stores a range as its midpoint and nothing for no price', () => {
    expect(toUsd({ min: 0.1, max: 0.3 })).toBe(0.2)
    expect(toUsd(null)).toBeNull()
  })

  it('prices every priced video model at its defaults, like the lab does', () => {
    for (const model of VIDEO_MODELS.filter((m) => m.pricing)) {
      const expected = toUsd(
        estimateCost(model.pricing, {
          durationSec: model.durations[0],
          resolution: model.defaultResolution,
          audio: model.supportsAudio ? true : undefined,
        }),
      )
      expect(videoJobCost(model.id, {}), model.id).toBe(expected)
    }
  })

  it('charges less with audio off when the model has a no-audio rate', () => {
    const model = VIDEO_MODELS.find(
      (m) => m.pricing?.kind === 'perSecond' && m.pricing.noAudio,
    )
    if (!model) return
    const on = videoJobCost(model.id, { generateAudio: true })!
    const off = videoJobCost(model.id, { generateAudio: false })!
    expect(off).toBeLessThan(on)
  })

  it('returns null for unknown models', () => {
    expect(videoJobCost('nope', {})).toBeNull()
  })

  it('caps motion output by orientation and prices the cap when length is unknown', () => {
    const model = MOTION_CONTROL_MODELS[0]
    const capped = motionJobCost(model.id, {
      referenceDurationSec: 60,
      characterOrientation: 'image',
    })
    const atCap = motionJobCost(model.id, { characterOrientation: 'image' })
    expect(capped).toBe(atCap)
    expect(
      motionJobCost(model.id, {
        referenceDurationSec: 5,
        characterOrientation: 'video',
      })!,
    ).toBeLessThan(atCap!)
  })

  it('prices auto-length SFX at the ceiling', () => {
    const model = SFX_MODELS[0]
    expect(sfxJobCost(model.id, undefined)).toBe(
      sfxJobCost(model.id, model.maxDurationSec),
    )
  })

  it('works out image upscale output from the target height', () => {
    expect(
      imageUpscaleOutput({
        modelId: 'fal-ai/seedvr/upscale/image',
        sourceWidth: 1600,
        sourceHeight: 900,
        upscaleMode: 'target',
        targetResolution: '1080p',
      }),
    ).toEqual({ width: 1920, height: 1080 })
    expect(
      imageUpscaleOutput({
        modelId: 'x',
        sourceWidth: 500,
        sourceHeight: 400,
        scale: 4,
      }),
    ).toEqual({ width: 2000, height: 1600 })
  })

  it('needs the measured source to price a video upscale', () => {
    expect(videoUpscaleJobCost('fal-ai/seedvr/upscale/video', {})).toBeNull()
  })

  it('adds Hunyuan3D surcharges', () => {
    const hunyuan = TEXT_TO_3D_MODELS.find((m) => m.id.startsWith('hunyuan3d'))
    if (!hunyuan) return
    const base = model3DCost(hunyuan)!.min
    const pbr = model3DCost(hunyuan, { enablePbr: true })!.min
    expect(pbr).toBeGreaterThan(base)
  })
})

describe('Seedream 5.5 pricing (per output, by pixels, + refs on edit)', () => {
  const T2I = 'bytedance/seedream/v5.5/text-to-image'
  const EDIT = 'bytedance/seedream/v5.5/edit'

  it('bills the doubled render size: square is 2K, 16:9 stays under 2.61MP', () => {
    // 1024² → 2048² = 4.19MP → $0.0405; 1024×576 → 2048×1152 = 2.36MP → $0.03
    expect(imageJobCost(T2I, { width: 1024, height: 1024 })).toBe(0.0405)
    expect(imageJobCost(T2I, { width: 1024, height: 576 })).toBe(0.03)
    expect(imageJobCost(T2I, { width: 1024, height: 576, numImages: 2 })).toBe(
      0.06,
    )
  })

  it('adds $0.012 per reference image to an edit (default 2K output)', () => {
    // fal's example: 2 inputs, one output at 2K = $0.0645
    expect(editJobCost(EDIT, { imageUrls: ['a', 'b'] })).toBe(0.0645)
    expect(editJobCost(EDIT, { imageUrls: ['a'] })).toBe(0.0525)
  })

  it('prices a finished edit from its real output size', () => {
    const rule = {
      kind: 'perImage',
      usd: 0.0405,
      overPixels: { px: 2_610_000, under: 0.03 },
      perInputImage: 0.012,
    } as const
    // fal's example: 2 inputs at 1.5K = $0.054
    expect(
      estimateCost(rule, { width: 1536, height: 1536, inputImages: 2 })?.min,
    ).toBeCloseTo(0.054)
  })

  it('shows both tiers in the picker', () => {
    expect(
      formatRate({
        kind: 'perImage',
        usd: 0.0405,
        overPixels: { px: 1, under: 0.03 },
      }),
    ).toMatch(/^\$0\.03–0\.04\d?\/img$/)
  })
})
