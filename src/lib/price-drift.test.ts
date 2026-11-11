import { describe, expect, it } from 'vitest'
import { buildDriftRows, compareRule, ruleNumbers } from './price-drift'
import type { FalPrice } from './price-drift'

const fal = (unit_price: number, unit: string): FalPrice => ({
  endpoint_id: 'x',
  unit_price,
  unit,
  currency: 'USD',
})

describe('price drift', () => {
  it('matches fal’s base price against any resolution in the rule', () => {
    // Kling 4: we quote 1080p, fal's API quotes 720p
    const rule = {
      kind: 'perSecond' as const,
      usd: 0.235,
      byResolution: { '720p': 0.157, '1080p': 0.235 },
    }
    expect(compareRule(rule, fal(0.157, 'seconds'))).toBe('ok')
    expect(compareRule(rule, fal(0.2, 'seconds'))).toBe('drift')
  })

  it('counts no-audio and quality tables as the rule’s prices', () => {
    expect(
      ruleNumbers({
        kind: 'perSecond',
        usd: 0.4,
        noAudio: { usd: 0.2 },
      }),
    ).toEqual([0.2, 0.4])
    expect(
      compareRule(
        { kind: 'flat', usd: 1.2, byQuality: { untextured: 0.8 } },
        fal(0.8, 'generations'),
      ),
    ).toBe('ok')
  })

  it('flags a unit it can’t compare instead of calling it drift', () => {
    expect(
      compareRule({ kind: 'perImage', usd: 0.06 }, fal(0.001, 'units')),
    ).toBe('unit')
    expect(
      compareRule(
        { kind: 'range', min: 0.01, max: 0.25, per: 'image' },
        fal(1, 'units'),
      ),
    ).toBe('unit')
    // same number in fal's generic unit is a match
    expect(
      compareRule({ kind: 'perImage', usd: 0.0675 }, fal(0.0675, 'units')),
    ).toBe('ok')
  })

  it('reports missing and unpriced models, drift first', () => {
    const rows = buildDriftRows(
      [
        {
          endpoint: 'a',
          name: 'A',
          category: 'Image',
          rule: { kind: 'perImage', usd: 0.03 },
        },
        { endpoint: 'b', name: 'B', category: 'Image', rule: null },
        {
          endpoint: 'c',
          name: 'C',
          category: 'Image',
          rule: { kind: 'perImage', usd: 0.03 },
        },
        {
          endpoint: 'd',
          name: 'D',
          category: 'Image',
          rule: { kind: 'perImage', usd: 0.03 },
        },
      ],
      [
        { ...fal(0.03, 'images'), endpoint_id: 'a' },
        { ...fal(0.01, 'images'), endpoint_id: 'b' },
        { ...fal(0.05, 'images'), endpoint_id: 'd' },
      ],
    )
    expect(rows.map((r) => [r.endpoint, r.status])).toEqual([
      ['d', 'drift'],
      ['c', 'missing'],
      ['b', 'unpriced'],
      ['a', 'ok'],
    ])
  })
})
