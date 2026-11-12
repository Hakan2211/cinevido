import { describe, expect, it } from 'vitest'
import {
  layerRect,
  layerSetOf,
  layerizeCeiling,
  layerizeCost,
  placeOnCanvas,
  sortedLayers,
} from './layers'
import type { LayerSet } from './layers'

describe('layerize pricing', () => {
  it("matches fal's example: base + 2 layers = $0.102 at 1.5K, $0.1335 at 2K", () => {
    // 1.5K ≈ 1536² = 2.36MP (≤ 2.61MP); 2K ≈ 2048² = 4.19MP
    expect(
      layerizeCost({ outputs: 3, width: 1536, height: 1536 })?.min,
    ).toBeCloseTo(0.102)
    expect(
      layerizeCost({ outputs: 3, width: 2048, height: 2048 })?.min,
    ).toBeCloseTo(0.1335)
  })

  it('quotes the 2K rate when the source size is unknown (high, never low)', () => {
    expect(layerizeCost({ outputs: 3 })?.min).toBeCloseTo(0.1335)
  })

  it('the ceiling uses every slot: 8 layers + base at 2K = $0.3765', () => {
    const c = layerizeCeiling({ maxLayers: 8, width: 4000, height: 3000 })
    expect(c?.max).toBeCloseTo(9 * 0.0405 + 0.012)
    expect(c?.min).toBeCloseTo(2 * 0.0405 + 0.012)
  })
})

const SET: LayerSet = {
  width: 1000,
  height: 500,
  layers: [
    { url: 'b', z: 2, box: [600, 100, 900, 400] },
    { url: 'base', z: 0 },
    { url: 'a', z: 1, box: [100, 50, 300, 250] },
  ],
}

describe('layer geometry', () => {
  it('sorts bottom to top', () => {
    expect(sortedLayers(SET).map((l) => l.z)).toEqual([0, 1, 2])
  })

  it('places a layer in percent of the base, with a move', () => {
    expect(
      layerRect(SET, SET.layers[2], { visible: true, dx: 100, dy: 0 }),
    ).toEqual({
      left: 20,
      top: 10,
      width: 20,
      height: 40,
    })
    // the base fills the canvas
    expect(layerRect(SET, SET.layers[1])).toEqual({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    })
  })

  it('clips a layer moved past the edge, and drops one moved off it', () => {
    const p = placeOnCanvas(
      { width: 1000, height: 500 },
      [600, 100, 900, 400],
      250,
      -150,
    )
    expect(p).toEqual({
      width: 300,
      height: 300,
      left: 850,
      top: 0,
      crop: { left: 0, top: 50, width: 150, height: 250 },
    })
    expect(
      placeOnCanvas({ width: 1000, height: 500 }, [600, 100, 900, 400], 500, 0),
    ).toBeNull()
  })

  it('reads a layer set only off metadata that has one', () => {
    expect(layerSetOf({ layerSet: SET })).toBe(SET)
    expect(layerSetOf({ width: 10 })).toBeNull()
    expect(layerSetOf(null)).toBeNull()
  })
})
