/**
 * The music payloads are the one place where a wrong field name costs a real
 * fal call, so each engine's body is pinned against the schema on its /api page.
 */

import { describe, expect, it } from 'vitest'
import {
  buildMusicPayload,
  clampDuration,
  controlsDuration,
} from './music.server'
import { MUSIC_MODELS, getMusicModelById } from './types'

const base = { prompt: 'a warm cinematic theme' }

describe('the registry', () => {
  it('holds the four engines we verified, ACE-Step as the default', () => {
    expect(MUSIC_MODELS.map((m) => m.id)).toEqual([
      'fal-ai/ace-step',
      'minimax/music-3',
      'fal-ai/elevenlabs/music',
      'fal-ai/lyria3/pro',
    ])
  })

  it('marks lyrics required only where the endpoint requires them', () => {
    expect(getMusicModelById('minimax/music-3')?.requiresLyrics).toBe(true)
    expect(getMusicModelById('fal-ai/ace-step')?.requiresLyrics).toBeUndefined()
  })
})

describe('ACE-Step', () => {
  const id = 'fal-ai/ace-step'

  it('sends tags, lyrics and a duration it honours', () => {
    expect(
      buildMusicPayload(
        { ...base, lyrics: '[verse]\nhi', durationSec: 90 },
        id,
      ),
    ).toEqual({ tags: base.prompt, lyrics: '[verse]\nhi', duration: 90 })
  })

  it('uses [inst] as the instrumental flag', () => {
    const p = buildMusicPayload({ ...base, instrumental: true }, id)
    expect(p.lyrics).toBe('[inst]')
  })

  it('passes a seed through only when given', () => {
    expect(buildMusicPayload({ ...base, seed: 7 }, id).seed).toBe(7)
    expect(buildMusicPayload(base, id)).not.toHaveProperty('seed')
  })
})

describe('MiniMax Music 3', () => {
  const id = 'minimax/music-3'

  it('sends prompt + lyrics + duration', () => {
    expect(
      buildMusicPayload(
        { ...base, lyrics: '[verse]\nthe city hums', durationSec: 120 },
        id,
      ),
    ).toEqual({
      prompt: base.prompt,
      lyrics: '[verse]\nthe city hums',
      duration: 120,
    })
  })

  it('refuses to submit without lyrics rather than earning a 422', () => {
    expect(() => buildMusicPayload(base, id)).toThrow(/needs lyrics/)
    expect(() => buildMusicPayload({ ...base, lyrics: '   ' }, id)).toThrow()
  })

  it('caps the request at the model ceiling of five minutes', () => {
    expect(clampDuration(600, id)).toBe(300)
    expect(clampDuration(1, id)).toBe(10)
  })
})

describe('ElevenLabs Music', () => {
  const id = 'fal-ai/elevenlabs/music'

  it('speaks milliseconds, not seconds', () => {
    const p = buildMusicPayload({ ...base, durationSec: 45 }, id)
    expect(p).toEqual({ prompt: base.prompt, music_length_ms: 45_000 })
  })

  it('adds force_instrumental only when asked', () => {
    expect(
      buildMusicPayload({ ...base, instrumental: true }, id).force_instrumental,
    ).toBe(true)
    expect(buildMusicPayload(base, id)).not.toHaveProperty('force_instrumental')
  })
})

describe('Lyria 3 Pro', () => {
  const id = 'fal-ai/lyria3/pro'

  it('takes a prompt and nothing else — extra fields are schema errors', () => {
    expect(
      buildMusicPayload(
        {
          ...base,
          durationSec: 120,
          seed: 7,
          negativePrompt: 'distortion',
          lyrics: '[verse]\nignored',
        },
        id,
      ),
    ).toEqual({ prompt: base.prompt })
  })

  it('is the one engine that owns its own length', () => {
    expect(controlsDuration(id)).toBe(false)
    for (const other of MUSIC_MODELS.filter((m) => m.id !== id)) {
      expect(controlsDuration(other.id)).toBe(true)
    }
  })
})

describe('clampDuration', () => {
  it('falls back to the engine default when nothing is asked for', () => {
    expect(clampDuration(undefined, 'fal-ai/ace-step')).toBe(60)
    expect(clampDuration(undefined, 'minimax/music-3')).toBe(90)
  })

  it('holds each engine inside its own range', () => {
    expect(clampDuration(900, 'fal-ai/elevenlabs/music')).toBe(600)
    expect(clampDuration(1, 'fal-ai/elevenlabs/music')).toBe(3)
    expect(clampDuration(9999, 'fal-ai/ace-step')).toBe(240)
  })

  it('treats an unknown model as the default engine instead of throwing', () => {
    expect(clampDuration(60, 'nope/nope')).toBe(60)
  })
})

describe('unknown engines', () => {
  it('are rejected by name', () => {
    expect(() => buildMusicPayload(base, 'nope/nope')).toThrow(
      /Unknown music model/,
    )
  })
})
