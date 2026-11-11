import { describe, expect, it } from 'vitest'
import { VIDEO_UPSCALE_MODELS } from '../server/services/types'
import { estimateVideoUpscale } from './video-upscale-cost'
import { formatRate } from './pricing'

const rule = (id: string) =>
  VIDEO_UPSCALE_MODELS.find((m) => m.id.includes(id))!.pricing

describe('video upscale cost', () => {
  it('SeedVR matches fal’s worked example (1920×1080 × 121 frames ≈ $0.25)', () => {
    // 121 frames ≈ 4.03s at 30fps; a 960×540 source at 2× outputs 1920×1080
    const e = estimateVideoUpscale(
      rule('seedvr'),
      { width: 960, height: 540, durationSec: 121 / 30 },
      { modelId: 'fal-ai/seedvr/upscale/video', factor: 2 },
    )!
    expect(e.max).toBeCloseTo(0.251, 2)
    expect(e.min).toBeLessThan(e.max) // 24fps lower bound
  })

  it('Topaz tiers by output size and doubles at 60fps', () => {
    const src = { width: 640, height: 360, durationSec: 10 }
    const id = 'fal-ai/topaz/upscale/video'
    // 2× → 720p tier: $0.01/s
    expect(
      estimateVideoUpscale(rule('topaz'), src, { modelId: id, factor: 2 })!.min,
    ).toBeCloseTo(0.1)
    // 4× → 1440p: above 1080p, $0.08/s
    expect(
      estimateVideoUpscale(rule('topaz'), src, { modelId: id, factor: 4 })!.min,
    ).toBeCloseTo(0.8)
    expect(
      estimateVideoUpscale(rule('topaz'), src, {
        modelId: id,
        factor: 2,
        fps: 60,
      })!.min,
    ).toBeCloseTo(0.2)
  })

  it('Bytedance prices by target resolution', () => {
    const src = { width: 1280, height: 720, durationSec: 5 }
    const id = 'fal-ai/bytedance-upscaler/upscale/video'
    expect(
      estimateVideoUpscale(rule('bytedance'), src, {
        modelId: id,
        bytedanceResolution: '4k',
      })!.min,
    ).toBeCloseTo(0.144)
  })

  it('needs a measured source', () => {
    expect(
      estimateVideoUpscale(rule('topaz'), null, {
        modelId: 'fal-ai/topaz/upscale/video',
      }),
    ).toBeNull()
  })

  it('shows sub-cent rates instead of "<$0.01"', () => {
    expect(formatRate(rule('bytedance'))).toBe('$0.0072/s')
    expect(formatRate(rule('seedvr'))).toBe('$0.001/MP')
  })
})
