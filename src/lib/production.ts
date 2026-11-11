/**
 * Director v2 — the production plan.
 *
 * A plan is a priced storyboard the Director proposes from a brief. Every
 * shot runs the same pipeline:
 *
 *   still (text-to-image) → draft (image-to-video, Draft tier) → self-check
 *                         → final (image-to-video, Hero tier when it fits)
 *
 * The draft and the final animate the same still, so a final keeps the
 * composition the user approved in review. Prices come from the catalog via
 * job-cost.ts — the LLM proposes shots, never numbers.
 *
 * Stored as JSON on `Project.plan`. Shared by client and server (no
 * server-only imports).
 */

import {
  editJobCost,
  imageJobCost,
  musicJobCost,
  speechJobCost,
  videoJobCost,
} from './job-cost'
import { TIER_LABELS } from './pricing'
import {
  DIRECTOR_MODELS,
  MUSIC_MODELS,
  VIDEO_MODELS,
} from '@/server/services/types'
import type { VideoModelConfig } from '@/server/services/types'

// =============================================================================
// Types
// =============================================================================

export type StepStatus = 'running' | 'done' | 'failed'

/** One fal job in a shot's pipeline */
export interface PlanStep {
  status: StepStatus
  jobId?: string
  assetId?: string
  url?: string
  /** seconds of footage (videos, audio) */
  durationSec?: number
  /** what this step was charged against the budget at submit */
  costUsd: number
  error?: string
  startedAt: string
}

export interface ShotCheck {
  status: 'running' | 'done' | 'failed'
  ok?: boolean
  note?: string
  frameUrl?: string
}

/**
 * Review outcome. `keep` re-renders the shot on the final model; `promote`
 * uses the draft as the final as-is (no second render, no cost).
 */
export type ShotDecision = 'keep' | 'promote' | null

export interface PlanShot {
  id: string
  title: string
  /** one line for the card */
  description: string
  durationSec: number
  /** the still: subject, composition, light, style */
  prompt: string
  /** what moves: camera and action, for image-to-video */
  motion: string
  /**
   * Project Bible entries in this shot (ids, src/lib/bible.ts). Members with
   * a reference image make the still an edit of those references.
   */
  cast?: Array<string>
  still?: PlanStep
  draft?: PlanStep
  check?: ShotCheck
  final?: PlanStep
  decision: ShotDecision
  /** what has been asked of this shot so far */
  wantDraft: boolean
  wantFinal: boolean
}

export interface FinalChoice {
  model: string
  resolution?: string
}

export interface PlanModels {
  still: string
  draft: string
  final: FinalChoice
  /** true until the user picks a final model by hand */
  auto: boolean
}

export interface ProductionPlan {
  version: 1
  title: string
  /** "30s spot · 16:9" */
  format: string
  aspectRatio: AspectRatio
  models: PlanModels
  shots: Array<PlanShot>
  voiceover?: { script: string; step?: PlanStep }
  music?: { prompt: string; step?: PlanStep }
  /** running total charged against the budget (failed jobs are refunded) */
  spentUsd: number
  /** set when finals were asked for; finals of every wanted shot then assemble */
  finalsRequestedAt?: string
  assembly?: { clipIds: Array<string>; signature: string; at: string }
  /** what the planner changed ("Finals on Kling 4 720p to stay in budget") */
  notice?: string
  /** set when the run stopped short of the budget; cleared by the next action */
  stopped?: string
  createdAt: string
  updatedAt: string
}

export type AspectRatio = '16:9' | '9:16' | '1:1'

/** What the Director sends to `proposePlan` */
export interface PlanDraftInput {
  title: string
  format?: string
  shots: Array<{
    title: string
    description: string
    durationSec: number
    prompt: string
    motion: string
    /** Bible entry ids, already resolved from names */
    cast?: Array<string>
  }>
  voiceoverScript?: string
  musicPrompt?: string
}

// =============================================================================
// Geometry
// =============================================================================

export function aspectFromSize(width: number, height: number): AspectRatio {
  if (Math.abs(width - height) < 2) return '1:1'
  return width > height ? '16:9' : '9:16'
}

/** Still size: the image models upscale it (Seedream renders at 2x) */
export function stillSize(aspect: AspectRatio): {
  width: number
  height: number
} {
  if (aspect === '16:9') return { width: 1280, height: 720 }
  if (aspect === '9:16') return { width: 720, height: 1280 }
  return { width: 1024, height: 1024 }
}

// =============================================================================
// Models and durations
// =============================================================================

function videoModel(id: string): VideoModelConfig | undefined {
  return VIDEO_MODELS.find((m) => m.id === id)
}

/** Nearest length the model offers; ties go to the shorter (cheaper) one */
export function snapDuration(sec: number, durations: Array<number>): number {
  if (durations.length === 0) return sec
  return durations.reduce((best, d) =>
    Math.abs(d - sec) < Math.abs(best - sec) ||
    (Math.abs(d - sec) === Math.abs(best - sec) && d < best)
      ? d
      : best,
  )
}

/** Shot lengths follow the final model — the final is the deliverable */
export function shotDuration(sec: number, models: PlanModels): number {
  return snapDuration(sec, videoModel(models.final.model)?.durations ?? [5])
}

export function draftDuration(sec: number, models: PlanModels): number {
  return snapDuration(sec, videoModel(models.draft)?.durations ?? [5])
}

/**
 * Final models a user can pick in Edit plan: the Director's ladder, then
 * every other Hero / Workhorse image-to-video model at its default resolution.
 */
export function finalModelOptions(): Array<
  FinalChoice & { label: string; tier: string }
> {
  const seen = new Set<string>()
  const out: Array<FinalChoice & { label: string; tier: string }> = []
  const push = (choice: FinalChoice) => {
    const key = `${choice.model}@${choice.resolution ?? ''}`
    const m = videoModel(choice.model)
    if (!m || seen.has(key)) return
    seen.add(key)
    out.push({
      ...choice,
      label: choice.resolution ? `${m.name} · ${choice.resolution}` : m.name,
      tier: m.tier ? TIER_LABELS[m.tier] : 'Specialist',
    })
  }
  DIRECTOR_MODELS.finals.forEach((c) => push({ ...c }))
  VIDEO_MODELS.filter(
    (m) =>
      m.capabilities.includes('image-to-video') &&
      (m.tier === 'hero' || m.tier === 'standard'),
  ).forEach((m) => push({ model: m.id, resolution: m.defaultResolution }))
  return out
}

export function modelName(id: string): string {
  return videoModel(id)?.name ?? id.split('/').slice(-2).join(' ')
}

// =============================================================================
// Pricing
// =============================================================================

export interface ShotEstimate {
  stillUsd: number
  draftUsd: number
  finalUsd: number
}

/**
 * A still with a cast is priced as a reference edit. That is the dearer of
 * the two, so a cast whose members have no image yet is quoted high, never
 * low; the runner charges what it actually submits.
 */
export function stillCost(
  shot: Pick<PlanShot, 'cast'>,
  models: PlanModels,
  aspect: AspectRatio,
  withReferences = !!shot.cast?.length,
): number {
  return withReferences
    ? (editJobCost(DIRECTOR_MODELS.referenceStill, {}) ?? 0)
    : (imageJobCost(models.still, stillSize(aspect)) ?? 0)
}

export function priceShot(
  shot: Pick<PlanShot, 'durationSec' | 'cast'>,
  models: PlanModels,
  aspect: AspectRatio,
): ShotEstimate {
  return {
    stillUsd: stillCost(shot, models, aspect),
    draftUsd:
      videoJobCost(models.draft, {
        duration: draftDuration(shot.durationSec, models),
      }) ?? 0,
    finalUsd:
      videoJobCost(models.final.model, {
        duration: shotDuration(shot.durationSec, models),
        resolution: models.final.resolution,
      }) ?? 0,
  }
}

export function totalSeconds(plan: Pick<ProductionPlan, 'shots'>): number {
  return plan.shots.reduce((s, shot) => s + shot.durationSec, 0)
}

/** Music runs the length of the cut, within what the engine can write */
export function musicDuration(plan: Pick<ProductionPlan, 'shots'>): number {
  const m = MUSIC_MODELS.find((x) => x.id === DIRECTOR_MODELS.music)
  const sec = Math.ceil(totalSeconds(plan))
  return Math.min(m?.maxDurationSec ?? sec, Math.max(m?.minDurationSec ?? 1, sec))
}

export function priceVoiceover(script: string): number {
  return speechJobCost(DIRECTOR_MODELS.voice, script) ?? 0
}

export function priceMusic(plan: Pick<ProductionPlan, 'shots'>): number {
  return musicJobCost(DIRECTOR_MODELS.music, musicDuration(plan)) ?? 0
}

export interface PlanTotals {
  /** stills + drafts for every shot */
  draftUsd: number
  /** final renders for every shot, plus voiceover and music */
  finalUsd: number
  /** Final mode, no drafts: stills + finals + audio */
  directUsd: number
  audioUsd: number
}

export function planTotals(
  plan: Pick<
    ProductionPlan,
    'shots' | 'models' | 'aspectRatio' | 'voiceover' | 'music'
  >,
): PlanTotals {
  let stills = 0
  let drafts = 0
  let finals = 0
  for (const shot of plan.shots) {
    const e = priceShot(shot, plan.models, plan.aspectRatio)
    stills += e.stillUsd
    drafts += e.draftUsd
    finals += e.finalUsd
  }
  const audioUsd =
    (plan.voiceover ? priceVoiceover(plan.voiceover.script) : 0) +
    (plan.music ? priceMusic(plan) : 0)
  return {
    draftUsd: round(stills + drafts),
    finalUsd: round(finals + audioUsd),
    directUsd: round(stills + finals + audioUsd),
    audioUsd: round(audioUsd),
  }
}

/**
 * What finals for the approved shots will cost now: kept shots re-render,
 * promoted shots reuse the draft, shots with a final already are paid for.
 */
export function finalsCost(plan: ProductionPlan): number {
  let usd = 0
  for (const shot of plan.shots) {
    if (shot.decision !== 'keep' || shot.final?.status === 'done') continue
    usd += priceShot(shot, plan.models, plan.aspectRatio).finalUsd
  }
  if (plan.voiceover && !plan.voiceover.step) {
    usd += priceVoiceover(plan.voiceover.script)
  }
  if (plan.music && !plan.music.step) usd += priceMusic(plan)
  return round(usd)
}

function round(usd: number): number {
  return Math.round(usd * 10_000) / 10_000
}

/** Within budget, allowing for float dust */
export function canAfford(
  plan: Pick<ProductionPlan, 'spentUsd'>,
  budgetUsd: number,
  costUsd: number,
): boolean {
  return plan.spentUsd + costUsd <= budgetUsd + 0.0005
}

/**
 * The best final model whose drafts + finals fit the budget, trying the
 * Director's ladder in order. When nothing fits it returns the cheapest rung
 * with `fits: false` — the run will then stop at the budget, not overspend.
 */
export function chooseFinalModel(
  plan: Pick<ProductionPlan, 'shots' | 'aspectRatio' | 'voiceover' | 'music'>,
  budgetUsd: number,
  base: Omit<PlanModels, 'final' | 'auto'> = {
    still: DIRECTOR_MODELS.still,
    draft: DIRECTOR_MODELS.draft,
  },
): { final: FinalChoice; fits: boolean } {
  const ladder = DIRECTOR_MODELS.finals.map((c) => ({ ...c }))
  for (const final of ladder) {
    const models: PlanModels = { ...base, final, auto: true }
    const shots = plan.shots.map((s) => ({
      ...s,
      durationSec: shotDuration(s.durationSec, models),
    }))
    const t = planTotals({ ...plan, shots, models })
    if (t.draftUsd + t.finalUsd <= budgetUsd + 0.0005) {
      return { final, fits: true }
    }
  }
  return { final: ladder[ladder.length - 1], fits: false }
}

// =============================================================================
// Building and editing plans
// =============================================================================

export const MAX_SHOTS = 12

/** Turn the Director's proposal into a priced plan that fits the budget */
export function buildPlan(
  input: PlanDraftInput,
  opts: { budgetUsd: number; width: number; height: number; now?: Date },
): ProductionPlan {
  const now = (opts.now ?? new Date()).toISOString()
  const aspectRatio = aspectFromSize(opts.width, opts.height)
  const shots: Array<PlanShot> = input.shots
    .slice(0, MAX_SHOTS)
    .map((s, i) => ({
      id: `shot-${i + 1}-${Math.random().toString(36).slice(2, 7)}`,
      title: s.title.trim().slice(0, 80) || `Shot ${i + 1}`,
      description: s.description.trim().slice(0, 240),
      durationSec: Math.max(1, Math.round(s.durationSec || 5)),
      prompt: s.prompt.trim(),
      motion: s.motion.trim(),
      ...(s.cast?.length ? { cast: [...s.cast] } : {}),
      decision: null,
      wantDraft: false,
      wantFinal: false,
    }))

  const draft: Omit<ProductionPlan, 'models'> = {
    version: 1,
    title: input.title.trim().slice(0, 120) || 'Untitled production',
    format: '',
    aspectRatio,
    shots,
    voiceover: input.voiceoverScript?.trim()
      ? { script: input.voiceoverScript.trim() }
      : undefined,
    music: input.musicPrompt?.trim()
      ? { prompt: input.musicPrompt.trim() }
      : undefined,
    spentUsd: 0,
    createdAt: now,
    updatedAt: now,
  }

  const { final, fits } = chooseFinalModel(draft, opts.budgetUsd)
  const models: PlanModels = {
    still: DIRECTOR_MODELS.still,
    draft: DIRECTOR_MODELS.draft,
    final,
    auto: true,
  }
  const plan: ProductionPlan = {
    ...draft,
    models,
    shots: shots.map((s) => ({
      ...s,
      durationSec: shotDuration(s.durationSec, models),
    })),
  }
  plan.format = formatLabel(plan, input.format)

  const top = DIRECTOR_MODELS.finals[0]
  if (!fits) {
    const t = planTotals(plan)
    plan.notice = `Drafts and finals need ≈$${(t.draftUsd + t.finalUsd).toFixed(2)}, over the $${opts.budgetUsd.toFixed(2)} budget even on ${modelName(final.model)}. Raise the budget or cut shots; a run stops when the budget is spent.`
  } else if (final.model !== top.model || final.resolution !== top.resolution) {
    plan.notice = `Finals on ${modelName(final.model)}${final.resolution ? ` ${final.resolution}` : ''} to stay within the $${opts.budgetUsd.toFixed(2)} budget.`
  }
  return plan
}

export function formatLabel(
  plan: Pick<ProductionPlan, 'shots' | 'aspectRatio'>,
  kind?: string,
): string {
  const sec = totalSeconds(plan)
  const what = kind?.trim() ? ` ${kind.trim()}` : ''
  return `${sec}s${what} · ${plan.aspectRatio}`
}

export interface ShotEdit {
  id?: string
  title: string
  description: string
  durationSec: number
  prompt: string
  motion: string
  /** Bible entry ids; undefined keeps the shot's cast */
  cast?: Array<string>
}

const sameCast = (a?: Array<string>, b?: Array<string>) =>
  [...(a ?? [])].sort().join('|') === [...(b ?? [])].sort().join('|')

/**
 * Apply an Edit-plan save. Shots keep their renders unless what they render
 * from changed: a new prompt or cast drops the still and everything after it, a new
 * motion or length drops the clips.
 */
export function applyPlanEdit(
  plan: ProductionPlan,
  edit: { title?: string; shots: Array<ShotEdit>; final?: FinalChoice },
  now = new Date(),
): ProductionPlan {
  const models: PlanModels = edit.final
    ? { ...plan.models, final: edit.final, auto: false }
    : plan.models
  const finalChanged =
    models.final.model !== plan.models.final.model ||
    models.final.resolution !== plan.models.final.resolution

  const byId = new Map(plan.shots.map((s) => [s.id, s]))
  const shots: Array<PlanShot> = edit.shots.slice(0, MAX_SHOTS).map((e, i) => {
    const durationSec = shotDuration(Math.max(1, Math.round(e.durationSec)), models)
    const prev = e.id ? byId.get(e.id) : undefined
    const cast = e.cast ?? prev?.cast
    const base: PlanShot = {
      id: prev?.id ?? `shot-${i + 1}-${Math.random().toString(36).slice(2, 7)}`,
      title: e.title.trim().slice(0, 80) || `Shot ${i + 1}`,
      description: e.description.trim().slice(0, 240),
      durationSec,
      prompt: e.prompt.trim(),
      motion: e.motion.trim(),
      ...(cast?.length ? { cast: [...cast] } : {}),
      decision: null,
      wantDraft: false,
      wantFinal: false,
    }
    if (!prev) return base
    // a new cast is a new picture, like a new prompt
    const stillOk = prev.prompt === base.prompt && sameCast(prev.cast, base.cast)
    const clipsOk =
      stillOk && prev.motion === base.motion && prev.durationSec === durationSec
    return {
      ...base,
      still: stillOk ? prev.still : undefined,
      draft: clipsOk ? prev.draft : undefined,
      check: clipsOk ? prev.check : undefined,
      final: clipsOk && !finalChanged ? prev.final : undefined,
      decision: clipsOk ? prev.decision : null,
      wantDraft: clipsOk ? prev.wantDraft : false,
      wantFinal: clipsOk && !finalChanged ? prev.wantFinal : false,
    }
  })

  const next: ProductionPlan = {
    ...plan,
    title: edit.title?.trim() || plan.title,
    models,
    shots,
    notice: undefined,
    stopped: undefined,
    updatedAt: now.toISOString(),
  }
  next.format = formatLabel(next, plan.format.split(' · ')[0].replace(/^\d+s\s*/, ''))
  return next
}

// =============================================================================
// Reading a plan
// =============================================================================

export type PlanPhase =
  | 'planned'
  | 'drafting'
  | 'review'
  | 'finalizing'
  | 'assembled'

const isRunning = (step?: { status: string }) => step?.status === 'running'
const settled = (step?: { status: string }) =>
  step?.status === 'done' || step?.status === 'failed'

export function shotBusy(shot: PlanShot): boolean {
  return (
    isRunning(shot.still) ||
    isRunning(shot.draft) ||
    isRunning(shot.check) ||
    isRunning(shot.final)
  )
}

export type ShotNeed = 'still' | 'draft' | 'check' | 'final' | 'promote'

/**
 * The next thing the runner must start for a shot, or null when it is
 * waiting on a job, finished, failed, or nothing was asked of it. A failed
 * step stays failed until the user retries — the runner never re-spends on
 * its own.
 */
export function shotNeed(shot: PlanShot): ShotNeed | null {
  if (!shot.wantDraft && !shot.wantFinal) return null
  if (!shot.still) return 'still'
  if (shot.still.status !== 'done') return null
  if (shot.wantDraft && !shot.draft) return 'draft'
  if (shot.wantDraft && shot.draft?.status === 'done' && !shot.check) {
    return 'check'
  }
  if (shot.wantFinal && !shot.final) {
    if (shot.decision === 'promote') {
      return shot.draft?.status === 'done' ? 'promote' : null
    }
    return 'final'
  }
  return null
}

/** Voiceover / music the finals asked for and nobody has started */
export function audioNeeds(plan: ProductionPlan): Array<'voiceover' | 'music'> {
  if (!plan.finalsRequestedAt) return []
  const out: Array<'voiceover' | 'music'> = []
  if (plan.voiceover && !plan.voiceover.step) out.push('voiceover')
  if (plan.music && !plan.music.step) out.push('music')
  return out
}

/** The final clips that make the cut, in shot order */
export function cutShots(plan: ProductionPlan): Array<PlanShot> {
  return plan.shots.filter(
    (s) => s.wantFinal && s.final?.status === 'done' && s.final.url,
  )
}

/** Identity of a cut: which finals and audio are on the timeline */
export function cutSignature(plan: ProductionPlan): string {
  return [
    ...cutShots(plan).map((s) => s.final?.assetId ?? s.final?.url),
    plan.voiceover?.step?.assetId ?? '',
    plan.music?.step?.assetId ?? '',
  ].join('|')
}

/**
 * Ready to (re)assemble: finals were asked for, every wanted final and the
 * audio have settled, at least one final made it, and the cut differs from
 * what is on the timeline.
 */
export function needsAssembly(plan: ProductionPlan): boolean {
  if (!plan.finalsRequestedAt) return false
  const wanted = plan.shots.filter((s) => s.wantFinal)
  if (wanted.length === 0) return false
  if (!wanted.every((s) => settled(s.final) || s.still?.status === 'failed')) {
    return false
  }
  if (plan.voiceover && !settled(plan.voiceover.step)) return false
  if (plan.music && !settled(plan.music.step)) return false
  if (cutShots(plan).length === 0) return false
  return plan.assembly?.signature !== cutSignature(plan)
}

/**
 * Should the client keep ticking? Running jobs always need polling; new
 * submissions only while the run is not stopped at the budget.
 */
export function planActive(plan: ProductionPlan): boolean {
  if (plan.shots.some(shotBusy)) return true
  if (isRunning(plan.music?.step) || isRunning(plan.voiceover?.step)) {
    return true
  }
  if (plan.stopped) return false
  return (
    plan.shots.some((s) => shotNeed(s) !== null) ||
    audioNeeds(plan).length > 0 ||
    needsAssembly(plan)
  )
}

export function planPhase(plan: ProductionPlan): PlanPhase {
  if (plan.finalsRequestedAt) {
    return plan.assembly && !planActive(plan) ? 'assembled' : 'finalizing'
  }
  const drafting = plan.shots.filter((s) => s.wantDraft)
  if (drafting.length === 0) return 'planned'
  return drafting.some((s) => shotBusy(s) || shotNeed(s) !== null)
    ? 'drafting'
    : 'review'
}

/** Shots the user approved for the cut */
export function approvedCount(plan: ProductionPlan): number {
  return plan.shots.filter((s) => s.decision).length
}

/** The newest picture of a shot: final, then draft, then still */
export function shotPreview(
  shot: PlanShot,
): { kind: 'video' | 'image'; url: string } | null {
  if (shot.final?.status === 'done' && shot.final.url) {
    return { kind: 'video', url: shot.final.url }
  }
  if (shot.draft?.status === 'done' && shot.draft.url) {
    return { kind: 'video', url: shot.draft.url }
  }
  if (shot.still?.status === 'done' && shot.still.url) {
    return { kind: 'image', url: shot.still.url }
  }
  return null
}

export function parsePlan(json: string | null | undefined): ProductionPlan | null {
  if (!json) return null
  try {
    const plan = JSON.parse(json) as ProductionPlan
    return plan.version === 1 && Array.isArray(plan.shots) ? plan : null
  } catch {
    return null
  }
}
