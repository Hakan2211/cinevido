import { describe, expect, it } from 'vitest'
import {
  MAX_BIBLE_ENTRIES,
  emptyBible,
  parseBible,
  referenceCost,
  referencePrompt,
  resolveCast,
  shotReferences,
  stillRequest,
  upsertEntries,
} from './bible'
import { applyPlanEdit, buildPlan, priceShot } from './production'
import { RECIPES, recipeBible, recipeProjectName, recipeReady } from './recipes'
import type { ProjectBible } from './bible'
import { buildEditPayload } from '@/server/services/edit.server'
import { DIRECTOR_MODELS, EDIT_MODELS } from '@/server/services/types'

const bible = (): ProjectBible => ({
  version: 1,
  style: '35mm film, warm grade',
  voice: 'Aria',
  entries: [
    {
      id: 'ref-mara',
      kind: 'character',
      name: 'Mara',
      description: 'woman in her 30s, short black hair',
      imageUrl: 'https://cdn/mara.png',
    },
    {
      id: 'ref-cafe',
      kind: 'place',
      name: 'The café',
      description: 'tiled corner café',
    },
    {
      id: 'ref-cup',
      kind: 'product',
      name: 'Ember cup',
      description: 'matte black cup',
      imageUrl: 'https://cdn/cup.png',
    },
  ],
})

describe('reference model', () => {
  it('is a multi-reference edit model that sets the aspect ratio', () => {
    const m = EDIT_MODELS.find((x) => x.id === DIRECTOR_MODELS.referenceStill)
    expect(m).toBeDefined()
    expect(m!.maxImages).toBeGreaterThanOrEqual(4)
    for (const a of ['16:9', '9:16', '1:1'])
      expect(m!.aspectRatios).toContain(a)
    const payload = buildEditPayload(
      { prompt: 'x', imageUrls: ['https://cdn/a.png'], aspectRatio: '9:16' },
      m!.id,
    )
    expect(payload.aspect_ratio).toBe('9:16')
  })

  it('never sends an aspect ratio to models that do not declare one', () => {
    const plain = EDIT_MODELS.find((m) => !m.aspectRatios)!
    const payload = buildEditPayload(
      { prompt: 'x', imageUrls: ['https://cdn/a.png'], aspectRatio: '16:9' },
      plain.id,
    )
    expect(payload).not.toHaveProperty('aspect_ratio')
  })
})

describe('parseBible', () => {
  it('falls back to an empty Bible on junk', () => {
    expect(parseBible(null)).toEqual(emptyBible())
    expect(parseBible('{nope')).toEqual(emptyBible())
    expect(parseBible('{"version":2}')).toEqual(emptyBible())
  })
  it('round-trips', () => {
    expect(parseBible(JSON.stringify(bible()))).toEqual(bible())
  })
})

describe('upsertEntries', () => {
  it('updates by name, case-insensitively, and keeps the image', () => {
    const next = upsertEntries(bible(), [
      { name: 'mara', description: 'now with a red scarf' },
    ])
    const mara = next.entries.find((e) => e.id === 'ref-mara')!
    expect(mara.description).toBe('now with a red scarf')
    expect(mara.imageUrl).toBe('https://cdn/mara.png')
    expect(next.entries).toHaveLength(3)
  })
  it('adds new entries up to the limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `Extra ${i}` }))
    const next = upsertEntries(bible(), many)
    expect(next.entries).toHaveLength(MAX_BIBLE_ENTRIES)
    expect(next.entries[3].kind).toBe('character')
  })
})

describe('cast and stills', () => {
  it('resolves names to ids, dropping unknown and repeated names', () => {
    expect(
      resolveCast(bible(), ['Mara', 'nobody', 'MARA', 'Ember cup']),
    ).toEqual(['ref-mara', 'ref-cup'])
  })

  it('references only cast members with an image', () => {
    const refs = shotReferences(bible(), ['ref-cafe', 'ref-cup', 'ref-mara'])
    expect(refs.map((e) => e.id)).toEqual(['ref-cup', 'ref-mara'])
  })

  it('renders from text with the style when no cast member has an image', () => {
    const r = stillRequest(bible(), {
      prompt: 'Wide shot of the café.',
      cast: ['ref-cafe'],
    })
    expect(r).toEqual({
      mode: 'text',
      prompt: 'Wide shot of the café. Style: 35mm film, warm grade',
    })
  })

  it('edits the references in, naming which image is who', () => {
    const r = stillRequest(bible(), {
      prompt: 'Mara lifts the cup',
      cast: ['ref-mara', 'ref-cup'],
    })
    expect(r.mode).toBe('reference')
    if (r.mode !== 'reference') return
    expect(r.imageUrls).toEqual(['https://cdn/mara.png', 'https://cdn/cup.png'])
    expect(r.prompt).toContain(
      'image 1 is Mara (woman in her 30s, short black hair)',
    )
    expect(r.prompt).toContain('image 2 is Ember cup')
    expect(r.prompt).toContain('Mara lifts the cup. Style: 35mm film')
  })

  it('a reference portrait is framed for its kind', () => {
    const b = bible()
    expect(referencePrompt(b, b.entries[0])).toMatch(/^Character reference/)
    expect(referencePrompt(b, b.entries[2])).toMatch(/^Product reference/)
    expect(referenceCost()).toBeGreaterThan(0)
  })
})

describe('plans with a cast', () => {
  const input = {
    title: 'Ember',
    shots: [
      {
        title: 'A',
        description: 'a',
        durationSec: 5,
        prompt: 'Mara at the window',
        motion: 'push in',
        cast: ['ref-mara'],
      },
      {
        title: 'B',
        description: 'b',
        durationSec: 5,
        prompt: 'Empty street at dawn',
        motion: 'pan',
      },
    ],
  }
  const plan = buildPlan(input, { budgetUsd: 10, width: 1920, height: 1080 })

  it('keeps the cast on the shot', () => {
    expect(plan.shots[0].cast).toEqual(['ref-mara'])
    expect(plan.shots[1].cast).toBeUndefined()
  })

  it('prices a cast shot as a reference edit', () => {
    const a = priceShot(plan.shots[0], plan.models, plan.aspectRatio)
    const b = priceShot(plan.shots[1], plan.models, plan.aspectRatio)
    expect(a.stillUsd).toBeGreaterThan(0)
    expect(a.stillUsd).not.toBe(b.stillUsd)
    expect(a.draftUsd).toBe(b.draftUsd)
  })

  it('a new cast drops the still, an unchanged one keeps it', () => {
    const rendered = {
      ...plan,
      shots: plan.shots.map((s) => ({
        ...s,
        still: {
          status: 'done' as const,
          url: 'https://cdn/s',
          costUsd: 0.04,
          startedAt: '',
        },
      })),
    }
    const same = applyPlanEdit(rendered, { shots: rendered.shots })
    expect(same.shots[0].still).toBeDefined()
    const recast = applyPlanEdit(rendered, {
      shots: rendered.shots.map((s, i) =>
        i === 0 ? { ...s, cast: ['ref-mara', 'ref-cup'] } : s,
      ),
    })
    expect(recast.shots[0].still).toBeUndefined()
    expect(recast.shots[0].cast).toEqual(['ref-mara', 'ref-cup'])
    expect(recast.shots[1].still).toBeDefined()
  })
})

describe('recipes', () => {
  it('each has a required field and a fitting budget', () => {
    for (const r of RECIPES) {
      expect(r.fields.some((f) => f.required)).toBe(true)
      expect(r.budgetUsd).toBeGreaterThan(0)
      expect(recipeReady(r, {})).toBe(false)
    }
  })

  it('product ad: the photo becomes the product reference, described by its look', () => {
    const r = RECIPES.find((x) => x.id === 'product-ad')!
    const values = {
      product: 'Ember cold brew',
      look: 'matte black can',
      mood: 'warm',
    }
    expect(recipeReady(r, values)).toBe(true)
    const seeded = recipeBible(r, values, {
      photo: { url: 'https://cdn/can.png', assetId: 'a1' },
    })
    expect(seeded.entries).toEqual([
      {
        name: 'Ember cold brew',
        kind: 'product',
        description: 'matte black can',
        imageUrl: 'https://cdn/can.png',
        assetId: 'a1',
      },
    ])
    expect(seeded.style).toContain('warm')
    expect(r.brief(values)).toContain('Ember cold brew')
    expect(r.brief(values)).toContain('Project Bible')
    expect(recipeProjectName(r, values)).toBe('Product ad · Ember cold brew')
  })

  it('skips an entry with neither a photo nor words', () => {
    const r = RECIPES.find((x) => x.id === 'music-video')!
    expect(recipeBible(r, { genre: 'synth-pop' }, {}).entries).toEqual([])
  })

  it('briefs leave out lines for empty optional fields', () => {
    const r = RECIPES.find((x) => x.id === 'explainer')!
    const brief = r.brief({ topic: 'heat pumps' })
    expect(brief).not.toContain('Audience:')
    expect(brief).not.toContain('undefined')
  })
})
