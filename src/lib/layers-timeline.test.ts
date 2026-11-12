import { describe, expect, it } from 'vitest'
import {
  addLayerSetToManifest,
  liveTextFromLayer,
  parallaxCamera,
  pictureEndFrame,
  replaceTextPrompt,
} from './layers'
import type { LayerSet } from './layers'
import {
  createEmptyManifest,
  migrateManifest,
  tracksOfKind,
} from '../remotion/types'
import {
  fitFontSize,
  fontStack,
  layerTextSvg,
  safeColor,
} from '../remotion/layer-text'

const set = (): LayerSet => ({
  width: 2000,
  height: 1000,
  layers: [
    { url: 'https://cdn/base.png', z: 0 },
    {
      url: 'https://cdn/person.png',
      z: 1,
      box: [100, 200, 600, 900],
      name: 'Person',
    },
    {
      url: 'https://cdn/title.png',
      z: 2,
      box: [1200, 100, 1900, 300],
      name: 'Headline',
      text: {
        text: 'MORNING ROAST',
        lines: [
          {
            runs: [
              {
                text: 'MORNING ROAST',
                style: {
                  similar_font_family: 'Playfair Display',
                  foreground_color: '#F5E6C8',
                  bold: true,
                },
              },
            ],
          },
        ],
      },
    },
  ],
})

describe('parallax camera', () => {
  it('moves nearer layers more than the base', () => {
    const base = parallaxCamera('push-in', 0)
    const front = parallaxCamera('push-in', 1)
    expect(front.to.scale - front.from.scale).toBeGreaterThan(
      base.to.scale - base.from.scale,
    )
    const panBase = parallaxCamera('pan-left', 0)
    const panFront = parallaxCamera('pan-left', 1)
    expect(Math.abs(panFront.to.x - panFront.from.x)).toBeGreaterThan(
      Math.abs(panBase.to.x - panBase.from.x),
    )
  })

  it('keeps the base covering the frame while it pans', () => {
    for (const move of ['pan-left', 'pan-right'] as const) {
      const { from, to } = parallaxCamera(move, 0)
      // a zoom of s leaves (s - 1) / 2 of slack on each side
      for (const key of [from, to]) {
        expect(Math.abs(key.x)).toBeLessThanOrEqual((key.scale - 1) / 2)
      }
    }
  })

  it('still is still', () => {
    expect(parallaxCamera('still', 1)).toEqual({
      from: { x: 0, y: 0, scale: 1 },
      to: { x: 0, y: 0, scale: 1 },
    })
  })
})

describe('layer set → timeline', () => {
  it('stacks each visible layer on its own video lane at the end of the cut', () => {
    const start = addLayerSetToManifest(createEmptyManifest(), set(), {
      durationFrames: 150,
      move: 'push-in',
    })
    // a second shot goes after the first
    const { manifest, clipIds, startFrame } = addLayerSetToManifest(
      start.manifest,
      set(),
      { durationFrames: 90, move: 'pan-left', assetId: 'a1' },
    )
    expect(startFrame).toBe(150)
    expect(clipIds).toHaveLength(3)
    const video = tracksOfKind(manifest, 'video')
    expect(video.map((t) => t.name)).toEqual(['Video', 'Video 2', 'Video 3'])
    const second = video.map((t) => t.clips[1])
    expect(second.map((c) => c.url)).toEqual([
      'https://cdn/base.png',
      'https://cdn/person.png',
      'https://cdn/title.png',
    ])
    expect(
      second.every((c) => c.startFrame === 150 && c.durationFrames === 90),
    ).toBe(true)
    expect(second[0].placement?.box).toEqual([0, 0, 2000, 1000])
    expect(second[1].placement?.canvas).toEqual({ width: 2000, height: 1000 })
    expect(pictureEndFrame(manifest)).toBe(240)
  })

  it('leaves hidden layers out, keeps moved ones where they were put', () => {
    const s = set()
    s.views = {
      '1': { visible: true, dx: 50, dy: -20 },
      '2': { visible: false, dx: 0, dy: 0 },
    }
    const { manifest, clipIds } = addLayerSetToManifest(
      createEmptyManifest(),
      s,
      {
        durationFrames: 60,
        move: 'still',
      },
    )
    expect(clipIds).toHaveLength(2)
    const person = tracksOfKind(manifest, 'video')[1].clips[0]
    expect(person.placement?.box).toEqual([150, 180, 650, 880])
  })

  it('sends live text to the overlay lane as a LayerText clip', () => {
    const s = set()
    s.layers[2].live = liveTextFromLayer(s.layers[2])!
    const { manifest } = addLayerSetToManifest(createEmptyManifest(), s, {
      durationFrames: 60,
      move: 'push-in',
    })
    const overlay = tracksOfKind(manifest, 'component')[0].clips[0]
    expect(overlay.component).toBe('LayerText')
    expect(overlay.props?.text).toBe('MORNING ROAST')
    expect(overlay.placement?.box).toEqual([1200, 100, 1900, 300])
    expect(tracksOfKind(manifest, 'video').map((t) => t.clips.length)).toEqual([
      1, 1,
    ])
  })

  it('survives a save: migrateManifest keeps placements, drops broken ones', () => {
    const { manifest } = addLayerSetToManifest(createEmptyManifest(), set(), {
      durationFrames: 60,
      move: 'pan-right',
    })
    const back = migrateManifest(JSON.stringify(manifest))
    expect(back).toEqual(manifest)

    const broken = JSON.parse(JSON.stringify(manifest))
    broken.tracks[0].clips[0].placement = { canvas: { width: 0 }, box: [1, 2] }
    broken.tracks[1].clips[0].placement.to.scale = 99
    const fixed = migrateManifest(broken)
    expect(fixed.tracks[0].clips[0].placement).toBeUndefined()
    expect(fixed.tracks[1].clips[0].placement?.to.scale).toBe(4)
  })
})

describe('text layers', () => {
  it('reads fal’s recognised text and its first styled run', () => {
    expect(liveTextFromLayer(set().layers[2])).toEqual({
      text: 'MORNING ROAST',
      color: '#F5E6C8',
      fontFamily: 'Playfair Display',
      bold: true,
      italic: undefined,
    })
    expect(liveTextFromLayer(set().layers[1])).toBeNull()
  })

  it('asks the edit model to keep the type when replacing words', () => {
    const prompt = replaceTextPrompt('MORNING  ROAST', 'EVENING\nBLEND')
    expect(prompt).toContain('"MORNING ROAST" with "EVENING BLEND"')
    expect(prompt).toContain('same typeface')
    expect(prompt).toContain('transparent')
  })

  it('draws escaped SVG sized to its box', () => {
    const svg = layerTextSvg(
      {
        text: 'A < B & "C"\nline two',
        color: 'red;}<script>',
        fontFamily: "Evil'</svg>",
      },
      700,
      200,
      { pixels: true },
    )
    expect(svg).toContain('width="700" height="200"')
    expect(svg).toContain('A &lt; B &amp; &quot;C&quot;')
    expect(svg).not.toContain('<script>')
    expect(svg).not.toContain("Evil'</svg>")
    expect(svg).toContain('fill="#ffffff"')
    expect(svg.match(/<tspan/g)).toHaveLength(2)
  })

  it('fits the font to the box: by height, shrunk for long lines', () => {
    expect(fitFontSize(['HI'], 1000, 108)).toBeCloseTo(100)
    expect(
      fitFontSize(['A very long line of text here'], 300, 108),
    ).toBeLessThan(20)
  })

  it('falls back to a generic family and plain colours', () => {
    expect(fontStack('Playfair Display')).toBe("'Playfair Display', serif")
    expect(fontStack('Open Sans')).toBe("'Open Sans', sans-serif")
    expect(fontStack(undefined)).toBe('sans-serif')
    expect(safeColor('#abc')).toBe('#abc')
    expect(safeColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)')
    expect(safeColor('url(x)')).toBe('#ffffff')
  })
})
