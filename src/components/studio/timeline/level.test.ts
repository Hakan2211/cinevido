/**
 * The mixer displays decibels but the manifest stores a multiplier, and the
 * inspector's fields parse timecode the user types. Both conversions are the
 * kind that look right and are quietly off by a frame or a decibel.
 */

import { describe, expect, it } from 'vitest'
import { GAIN_MAX, dbToGain, formatGainDb, gainToDb } from './shared'
import { formatTimecode, parseTimecode } from '../../../remotion/types'

describe('gain <-> dB', () => {
  it('puts unity at 0 dB and silence at -infinity', () => {
    expect(gainToDb(1)).toBe(0)
    expect(gainToDb(0)).toBe(-Infinity)
    expect(formatGainDb(1)).toBe('0.0 dB')
    expect(formatGainDb(0)).toBe('-\u221e')
  })

  it('doubles at +6 dB and halves at -6 dB', () => {
    expect(gainToDb(2)).toBeCloseTo(6.02, 1)
    expect(gainToDb(0.5)).toBeCloseTo(-6.02, 1)
    expect(dbToGain(6.0206)).toBeCloseTo(2, 3)
  })

  it('signs departures from unity but never signs unity itself', () => {
    expect(formatGainDb(1.26)).toBe('+2.0 dB')
    expect(formatGainDb(0.5)).toBe('-6.0 dB')
    expect(formatGainDb(1.001)).toBe('0.0 dB') // inside the rounding deadband
  })

  it('tops out at the +12 dB the fader draws', () => {
    expect(gainToDb(GAIN_MAX)).toBeCloseTo(12.04, 1)
  })

  it('round-trips', () => {
    for (const gain of [0.1, 0.5, 1, 1.5, 2, 3.98]) {
      expect(dbToGain(gainToDb(gain))).toBeCloseTo(gain, 6)
    }
  })
})

describe('parseTimecode', () => {
  it('is the inverse of formatTimecode', () => {
    for (const frames of [0, 1, 29, 30, 745, 108_000]) {
      expect(parseTimecode(formatTimecode(frames, 30, true), 30)).toBe(frames)
      expect(parseTimecode(formatTimecode(frames, 30, false), 30)).toBe(frames)
    }
  })

  it('right-aligns short forms — the last field is always frames', () => {
    expect(parseTimecode('12', 30)).toBe(12) // bare frame count
    expect(parseTimecode('02:03', 30)).toBe(2 * 30 + 3) // SS:FF
    expect(parseTimecode('01:00:00', 30)).toBe(60 * 30) // MM:SS:FF
    expect(parseTimecode('00:00:04:12', 30)).toBe(4 * 30 + 12)
  })

  it('accepts the separators people actually type', () => {
    expect(parseTimecode('00.00.04.12', 30)).toBe(4 * 30 + 12)
    expect(parseTimecode('  00:00:04:12  ', 30)).toBe(4 * 30 + 12)
  })

  it('returns null rather than guessing, so a bad edit reverts', () => {
    expect(parseTimecode('', 30)).toBeNull()
    expect(parseTimecode('abc', 30)).toBeNull()
    expect(parseTimecode('1::2', 30)).toBeNull()
    expect(parseTimecode('-5', 30)).toBeNull()
    expect(parseTimecode('1:2:3:4:5', 30)).toBeNull()
  })

  it('rejects a frame number the rate cannot hold', () => {
    expect(parseTimecode('00:00:30', 30)).toBeNull() // 30 frames at 30fps
    expect(parseTimecode('00:00:29', 30)).toBe(29)
    expect(parseTimecode('00:00:30', 60)).toBe(30) // fine at 60fps
  })
})
