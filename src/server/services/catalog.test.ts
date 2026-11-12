import { describe, expect, it } from 'vitest'
import {
  estimateCost,
  formatEstimate,
  formatRate,
  formatUsd,
} from '../../lib/pricing'
import { buildImagePayload, buildVideoPayload } from './fal.server'
import {
  AUDIO_MODELS,
  DEFAULT_MODELS,
  EDIT_MODELS,
  IMAGE_MODELS,
  IMAGE_TO_3D_MODELS,
  IMAGE_TO_WORLD_MODELS,
  MOTION_CONTROL_MODELS,
  MUSIC_MODELS,
  SFX_MODELS,
  TEXT_TO_3D_MODELS,
  UPSCALE_MODELS,
  VIDEO_MODELS,
  getVideoModelById,
  resolveModelId,
} from './types'

describe('catalog', () => {
  it('every default is a model the catalog offers', () => {
    const has = (list: Array<{ id: string }>, id: string) =>
      list.some((m) => m.id === id)
    expect(has(IMAGE_MODELS, DEFAULT_MODELS.image)).toBe(true)
    expect(has(EDIT_MODELS, DEFAULT_MODELS.edit)).toBe(true)
    expect(has(UPSCALE_MODELS, DEFAULT_MODELS.upscale)).toBe(true)
    expect(has(AUDIO_MODELS, DEFAULT_MODELS.tts)).toBe(true)
    expect(has(SFX_MODELS, DEFAULT_MODELS.sfx)).toBe(true)
    expect(has(MOTION_CONTROL_MODELS, DEFAULT_MODELS.motionControl)).toBe(true)
    expect(
      getVideoModelById(DEFAULT_MODELS.textToVideo)?.capabilities,
    ).toContain('text-to-video')
    expect(
      getVideoModelById(DEFAULT_MODELS.imageToVideo)?.capabilities,
    ).toContain('image-to-video')
    expect(getVideoModelById(DEFAULT_MODELS.keyframes)?.capabilities).toContain(
      'keyframes',
    )
  })

  it('each video mode leads with its default (the page picks the first)', () => {
    const first = (cap: string) =>
      VIDEO_MODELS.find((m) => m.capabilities.includes(cap as never))?.id
    expect(first('text-to-video')).toBe(DEFAULT_MODELS.textToVideo)
    expect(first('image-to-video')).toBe(DEFAULT_MODELS.imageToVideo)
    expect(first('keyframes')).toBe(DEFAULT_MODELS.keyframes)
  })

  it('video models price and default to a resolution they offer', () => {
    for (const m of VIDEO_MODELS) {
      if (!m.resolutions?.length) continue
      expect(m.defaultResolution, m.id).toBeDefined()
      expect(m.resolutions, m.id).toContain(m.defaultResolution)
      // pricing.usd is quoted at the default resolution
      const table =
        m.pricing?.kind === 'perSecond' ? m.pricing.byResolution : undefined
      const atDefault = table?.[m.defaultResolution!]
      if (atDefault !== undefined && m.pricing?.kind === 'perSecond') {
        expect(atDefault, m.id).toBe(m.pricing.usd)
      }
    }
  })

  it('every 3D and motion model has a price (Generate shows a cost)', () => {
    for (const m of [
      ...TEXT_TO_3D_MODELS,
      ...IMAGE_TO_3D_MODELS,
      ...IMAGE_TO_WORLD_MODELS,
      ...MOTION_CONTROL_MODELS,
    ]) {
      expect(m.pricing, m.id).toBeDefined()
    }
  })

  it('flat rules price modes and add-ons', () => {
    const hunyuan = TEXT_TO_3D_MODELS.find((m) => m.id === 'hunyuan3d-v3-text')!
    expect(estimateCost(hunyuan.pricing)!.min).toBeCloseTo(0.375)
    // fal: "a Normal generation with PBR materials costs $0.525"
    expect(
      estimateCost(hunyuan.pricing, { quality: 'Normal', addOns: ['pbr'] })!
        .min,
    ).toBeCloseTo(0.525)
    expect(
      estimateCost(hunyuan.pricing, { quality: 'Geometry' })!.min,
    ).toBeCloseTo(0.225)
    const meshy = TEXT_TO_3D_MODELS.find((m) => m.id === 'meshy-v7-text')!
    expect(estimateCost(meshy.pricing)!.min).toBeCloseTo(1.2)
    expect(
      estimateCost(meshy.pricing, { quality: 'untextured' })!.min,
    ).toBeCloseTo(0.8)
    expect(formatRate(meshy.pricing)).toBe('$0.80–1.20/run')
  })

  it('has no duplicate ids', () => {
    for (const list of [
      IMAGE_MODELS,
      EDIT_MODELS,
      VIDEO_MODELS,
      AUDIO_MODELS,
      MUSIC_MODELS,
      SFX_MODELS,
    ]) {
      const ids = list.map((m) => m.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('every priced model yields a sane estimate', () => {
    for (const m of [
      ...IMAGE_MODELS,
      ...EDIT_MODELS,
      ...VIDEO_MODELS,
      ...AUDIO_MODELS,
      ...MUSIC_MODELS,
      ...SFX_MODELS,
      ...TEXT_TO_3D_MODELS,
      ...IMAGE_TO_3D_MODELS,
      ...IMAGE_TO_WORLD_MODELS,
      ...MOTION_CONTROL_MODELS,
    ]) {
      if (!m.pricing) continue
      const e = estimateCost(m.pricing, {
        durationSec: 5,
        chars: 500,
        width: 1024,
        height: 1024,
      })
      expect(e, m.id).not.toBeNull()
      expect(e!.min, m.id).toBeGreaterThan(0)
      expect(e!.max, m.id).toBeLessThan(20)
      expect(formatRate(m.pricing), m.id).toMatch(/\$/)
    }
  })

  it('falls back when a stored preference names a retired model', () => {
    expect(
      resolveModelId(
        'fal-ai/flux-pro/v1.1',
        IMAGE_MODELS,
        DEFAULT_MODELS.image,
      ),
    ).toBe(DEFAULT_MODELS.image)
    expect(
      resolveModelId(
        'krea/v3/text-to-image',
        IMAGE_MODELS,
        DEFAULT_MODELS.image,
      ),
    ).toBe('krea/v3/text-to-image')
    expect(resolveModelId(null, IMAGE_MODELS, DEFAULT_MODELS.image)).toBe(
      DEFAULT_MODELS.image,
    )
  })
})

describe('payload builders send only declared fields', () => {
  it('drops seed and negative prompt for image models that lack them', () => {
    const p = buildImagePayload(
      { prompt: 'x', seed: 1, negativePrompt: 'y' },
      'bytedance/seedream/v5/flash/text-to-image',
    )
    expect(p).not.toHaveProperty('seed')
    expect(p).not.toHaveProperty('negative_prompt')
    const krea = buildImagePayload(
      { prompt: 'x', seed: 1, negativePrompt: 'y' },
      'krea/v3/text-to-image',
    )
    expect(krea).toMatchObject({ seed: 1, negative_prompt: 'y' })
  })

  it('sends a transparent background only to models that support it', () => {
    const seedream = buildImagePayload(
      { prompt: 'x', background: 'transparent', outputFormat: 'jpeg' },
      'bytedance/seedream/v5.5/text-to-image',
    )
    expect(seedream).toMatchObject({
      background: 'transparent',
      output_format: 'png',
    })
    const flash = buildImagePayload(
      { prompt: 'x', background: 'transparent' },
      'bytedance/seedream/v5/flash/text-to-image',
    )
    expect(flash).not.toHaveProperty('background')
  })

  it('throws on an unknown image model instead of sending it to fal', () => {
    expect(() =>
      buildImagePayload({ prompt: 'x' }, 'fal-ai/flux-pro/v1.1'),
    ).toThrow(/Unknown image model/)
  })

  it('spells video durations the way each model wants', () => {
    const build = (id: string) =>
      buildVideoPayload(
        { generationType: 'text-to-video', prompt: 'x', duration: 8 },
        id,
        getVideoModelById(id)!,
      ).duration
    expect(build('fal-ai/veo3.1')).toBe('8s')
    expect(build('bytedance/seedance-2.5/us/text-to-video')).toBe('8')
    expect(build('kling/v4/text-to-video')).toBe(8)
  })

  it('maps keyframes onto each model’s own field names', () => {
    const p = buildVideoPayload(
      {
        generationType: 'keyframes',
        prompt: 'x',
        firstFrameUrl: 'a',
        lastFrameUrl: 'b',
      },
      'kling/v4/image-to-video',
      getVideoModelById('kling/v4/image-to-video')!,
    )
    expect(p).toMatchObject({ start_image_url: 'a', end_image_url: 'b' })
  })
})

describe('pricing', () => {
  it('estimates per-second video at the requested resolution and audio', () => {
    const veo = getVideoModelById('fal-ai/veo3.1')!.pricing
    expect(estimateCost(veo, { durationSec: 8 })).toEqual({
      min: 3.2,
      max: 3.2,
    })
    expect(
      estimateCost(veo, { durationSec: 8, audio: false })!.min,
    ).toBeCloseTo(1.6)
    expect(
      estimateCost(veo, { durationSec: 8, resolution: '4k' })!.min,
    ).toBeCloseTo(4.8)
  })

  it('rounds megapixels up and multiplies by batch size', () => {
    expect(
      estimateCost(
        { kind: 'perMegapixel', usd: 0.025 },
        { width: 2048, height: 1152, numImages: 2 },
      )!.min,
    ).toBeCloseTo(0.025 * 3 * 2)
  })

  it('formats', () => {
    expect(formatUsd(0.027)).toBe('$0.027')
    expect(formatUsd(0.05)).toBe('$0.05')
    expect(formatUsd(0.1)).toBe('$0.10')
    expect(formatUsd(2.365)).toBe('$2.37')
    expect(formatUsd(0.004)).toBe('<$0.01')
    expect(formatEstimate({ min: 0.47, max: 0.47 })).toBe('≈ $0.47')
    expect(formatEstimate({ min: 0.01, max: 0.25 })).toBe('≈ $0.01–0.25')
    expect(formatEstimate(null)).toBeNull()
  })
})
