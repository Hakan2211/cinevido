import { describe, expect, it } from 'vitest'
import {
  applyPlanEdit,
  buildPlan,
  canAfford,
  chooseFinalModel,
  cutSignature,
  finalModelOptions,
  needsAssembly,
  planActive,
  planPhase,
  planTotals,
  priceShot,
  shotNeed,
  snapDuration,
} from './production'
import type { PlanShot, PlanStep, ProductionPlan } from './production'
import {
  DIRECTOR_MODELS,
  IMAGE_MODELS,
  LLM_MODELS,
  MUSIC_MODELS,
  getVideoModelById,
} from '@/server/services/types'

const coffee = {
  title: 'Coffee Brand Spot',
  format: 'ad',
  shots: Array.from({ length: 6 }, (_, i) => ({
    title: `Shot ${i + 1}`,
    description: 'A moment',
    durationSec: 5,
    prompt: `A cinematic still number ${i + 1}, warm morning light`,
    motion: 'slow push-in',
  })),
  musicPrompt: 'warm acoustic, soft piano',
}

const landscape = { width: 1920, height: 1080 }

const done = (extra: Partial<PlanStep> = {}): PlanStep => ({
  status: 'done',
  costUsd: 0.1,
  url: 'https://cdn/x',
  assetId: 'a',
  startedAt: '2026-11-11T00:00:00Z',
  ...extra,
})

describe('director models', () => {
  it('are all in the catalog, image-to-video where they animate', () => {
    expect(IMAGE_MODELS.some((m) => m.id === DIRECTOR_MODELS.still)).toBe(true)
    expect(MUSIC_MODELS.some((m) => m.id === DIRECTOR_MODELS.music)).toBe(true)
    expect(LLM_MODELS.some((m) => m.id === DIRECTOR_MODELS.selfCheck)).toBe(true)
    for (const id of [
      DIRECTOR_MODELS.draft,
      ...DIRECTOR_MODELS.finals.map((f) => f.model),
    ]) {
      expect(getVideoModelById(id)?.capabilities, id).toContain('image-to-video')
    }
    for (const f of DIRECTOR_MODELS.finals) {
      expect(getVideoModelById(f.model)?.resolutions).toContain(f.resolution)
    }
    expect(getVideoModelById(DIRECTOR_MODELS.draft)?.tier).toBe('draft')
    expect(getVideoModelById(DIRECTOR_MODELS.finals[0].model)?.tier).toBe('hero')
  })

  it('final ladder gets cheaper rung by rung', () => {
    const shot = { durationSec: 5 }
    const costs = DIRECTOR_MODELS.finals.map(
      (final) =>
        priceShot(
          shot,
          { still: DIRECTOR_MODELS.still, draft: DIRECTOR_MODELS.draft, final, auto: true },
          '16:9',
        ).finalUsd,
    )
    expect(costs).toEqual([...costs].sort((a, b) => b - a))
    expect(new Set(costs).size).toBe(costs.length)
  })

  it('offers each final choice once', () => {
    const keys = finalModelOptions().map((o) => `${o.model}@${o.resolution}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys[0]).toBe(
      `${DIRECTOR_MODELS.finals[0].model}@${DIRECTOR_MODELS.finals[0].resolution}`,
    )
  })
})

describe('snapDuration', () => {
  it('picks the nearest length, shorter on a tie', () => {
    expect(snapDuration(5, [5, 8, 10])).toBe(5)
    expect(snapDuration(6, [5, 8, 10])).toBe(5)
    expect(snapDuration(7, [5, 8, 10])).toBe(8)
    expect(snapDuration(6.5, [5, 8])).toBe(5)
    expect(snapDuration(40, [5, 8, 30])).toBe(30)
  })
})

describe('buildPlan', () => {
  it('prices the 30-second coffee ad on Hero within $10', () => {
    const plan = buildPlan(coffee, { budgetUsd: 10, ...landscape })
    expect(plan.shots).toHaveLength(6)
    expect(plan.aspectRatio).toBe('16:9')
    expect(plan.format).toBe('30s ad · 16:9')
    expect(plan.models.final).toEqual(DIRECTOR_MODELS.finals[0])
    expect(plan.notice).toBeUndefined()
    const t = planTotals(plan)
    expect(t.draftUsd).toBeGreaterThan(0)
    expect(t.finalUsd).toBeGreaterThan(t.draftUsd)
    expect(t.draftUsd + t.finalUsd).toBeLessThanOrEqual(10)
  })

  it('steps down the ladder when the budget is tight, and says so', () => {
    const plan = buildPlan(coffee, { budgetUsd: 5, ...landscape })
    expect(plan.models.final).not.toEqual(DIRECTOR_MODELS.finals[0])
    expect(plan.notice).toMatch(/within the \$5\.00 budget/)
    const t = planTotals(plan)
    expect(t.draftUsd + t.finalUsd).toBeLessThanOrEqual(5)
  })

  it('flags a plan nothing can fit', () => {
    const plan = buildPlan(coffee, { budgetUsd: 1, ...landscape })
    expect(chooseFinalModel(plan, 1).fits).toBe(false)
    expect(plan.notice).toMatch(/over the \$1\.00 budget/)
  })

  it('snaps shot lengths to the final model', () => {
    const plan = buildPlan(
      { ...coffee, shots: [{ ...coffee.shots[0], durationSec: 6 }] },
      { budgetUsd: 10, ...landscape },
    )
    const durations = getVideoModelById(plan.models.final.model)!.durations
    expect(durations).toContain(plan.shots[0].durationSec)
  })
})

describe('applyPlanEdit', () => {
  const rendered = (): ProductionPlan => {
    const plan = buildPlan(coffee, { budgetUsd: 10, ...landscape })
    plan.shots = plan.shots.map((s) => ({
      ...s,
      still: done(),
      draft: done({ durationSec: 5 }),
      check: { status: 'done', ok: true, note: 'fine' },
      decision: 'keep',
      wantDraft: true,
    }))
    return plan
  }

  it('keeps renders when nothing they depend on changed', () => {
    const plan = rendered()
    const next = applyPlanEdit(plan, {
      shots: plan.shots.map((s) => ({ ...s, title: `${s.title}!` })),
    })
    expect(next.shots[0].title).toBe('Shot 1!')
    expect(next.shots[0].draft?.status).toBe('done')
    expect(next.shots[0].decision).toBe('keep')
  })

  it('a new prompt drops the still and everything after it', () => {
    const plan = rendered()
    const next = applyPlanEdit(plan, {
      shots: plan.shots.map((s, i) => (i === 0 ? { ...s, prompt: 'Different' } : s)),
    })
    expect(next.shots[0].still).toBeUndefined()
    expect(next.shots[0].draft).toBeUndefined()
    expect(next.shots[0].decision).toBeNull()
    expect(next.shots[1].still?.status).toBe('done')
  })

  it('new motion keeps the still but drops the clips', () => {
    const plan = rendered()
    const next = applyPlanEdit(plan, {
      shots: plan.shots.map((s, i) => (i === 2 ? { ...s, motion: 'whip pan' } : s)),
    })
    expect(next.shots[2].still?.status).toBe('done')
    expect(next.shots[2].draft).toBeUndefined()
  })

  it('a hand-picked final model is marked and re-snaps lengths', () => {
    const plan = rendered()
    const veo = { model: 'fal-ai/veo3.1/image-to-video', resolution: '720p' }
    const next = applyPlanEdit(plan, { shots: plan.shots, final: veo })
    expect(next.models.auto).toBe(false)
    expect(getVideoModelById(veo.model)!.durations).toContain(next.shots[0].durationSec)
  })
})

describe('the runner state machine', () => {
  const base = (): PlanShot => ({
    id: 's1',
    title: 'One',
    description: '',
    durationSec: 5,
    prompt: 'p',
    motion: 'm',
    decision: null,
    wantDraft: false,
    wantFinal: false,
  })

  it('does nothing until asked', () => {
    expect(shotNeed(base())).toBeNull()
  })

  it('drafts: still, then draft, then check', () => {
    const shot = { ...base(), wantDraft: true }
    expect(shotNeed(shot)).toBe('still')
    shot.still = { ...done(), status: 'running' }
    expect(shotNeed(shot)).toBeNull()
    shot.still = done()
    expect(shotNeed(shot)).toBe('draft')
    shot.draft = done()
    expect(shotNeed(shot)).toBe('check')
    shot.check = { status: 'done', ok: true }
    expect(shotNeed(shot)).toBeNull()
  })

  it('never re-spends on a failed step by itself', () => {
    const shot = { ...base(), wantDraft: true, still: done(), draft: { ...done(), status: 'failed' as const } }
    expect(shotNeed(shot)).toBeNull()
    const failedStill = { ...base(), wantDraft: true, still: { ...done(), status: 'failed' as const } }
    expect(shotNeed(failedStill)).toBeNull()
  })

  it('finals: keep re-renders, promote reuses the draft', () => {
    const reviewed = {
      ...base(),
      wantDraft: true,
      wantFinal: true,
      still: done(),
      draft: done(),
      check: { status: 'done' as const, ok: true },
    }
    expect(shotNeed({ ...reviewed, decision: 'keep' })).toBe('final')
    expect(shotNeed({ ...reviewed, decision: 'promote' })).toBe('promote')
  })

  it('direct mode goes still → final without drafts', () => {
    const shot = { ...base(), wantFinal: true, decision: 'keep' as const }
    expect(shotNeed(shot)).toBe('still')
    expect(shotNeed({ ...shot, still: done() })).toBe('final')
  })

  it('assembles once wanted finals settle, and again only if the cut changed', () => {
    const plan = buildPlan(coffee, { budgetUsd: 10, ...landscape })
    plan.music = undefined
    plan.finalsRequestedAt = '2026-11-11T00:00:00Z'
    plan.shots = plan.shots.map((s, i) => ({
      ...s,
      still: done(),
      decision: i < 2 ? 'keep' : null,
      wantFinal: i < 2,
      final: i === 0 ? done({ assetId: 'f1' }) : i === 1 ? { ...done(), status: 'running' } : undefined,
    }))
    expect(needsAssembly(plan)).toBe(false)
    expect(planActive(plan)).toBe(true)
    plan.shots[1].final = done({ assetId: 'f2' })
    expect(needsAssembly(plan)).toBe(true)
    plan.assembly = { clipIds: [], signature: cutSignature(plan), at: 'now' }
    expect(needsAssembly(plan)).toBe(false)
    expect(planActive(plan)).toBe(false)
    expect(planPhase(plan)).toBe('assembled')
  })

  it('stops submitting at the budget but keeps polling running jobs', () => {
    const plan = buildPlan(coffee, { budgetUsd: 10, ...landscape })
    plan.shots[0].wantDraft = true
    plan.stopped = 'Stopped at the budget'
    expect(planActive(plan)).toBe(false)
    plan.shots[1].wantDraft = true
    plan.shots[1].still = { ...done(), status: 'running' }
    expect(planActive(plan)).toBe(true)
  })

  it('budget check allows spending exactly to the cap', () => {
    expect(canAfford({ spentUsd: 9.5 }, 10, 0.5)).toBe(true)
    expect(canAfford({ spentUsd: 9.5 }, 10, 0.51)).toBe(false)
  })
})
