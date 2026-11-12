/**
 * Director v2 — the production runner.
 *
 * Moves a plan (src/lib/production.ts) forward one tick at a time: polls the
 * fal jobs it started, starts whatever each shot needs next, self-checks
 * finished drafts, and lays the finals out on the timeline. The Studio calls
 * `tickProduction` every few seconds while a plan is active, so a run
 * survives a closed tab: the jobs keep going at fal and the next tick picks
 * them up.
 *
 * Money rules:
 *   - every submit is checked against the budget first; the run stops (and
 *     says why) before a job would take it over
 *   - a job's estimate is charged at submit and refunded if fal fails it
 *   - a failed step is never retried on its own — only the user re-spends
 *
 * Jobs are GenerationJob rows kept at status 'pending' until they finish, so
 * the Workspace's legacy poller (which completes 'processing' jobs) leaves
 * them alone and no asset is ever created twice.
 */

import { prisma } from '../../db.server'
import { getUserFalApiKey } from '../byok.server'
import { getUserStorageConfig } from '../storage-config.server'
import {
  generateImage,
  generateVideo,
  getJobStatus,
} from '../services/fal.server'
import { editImage, getEditJobStatus } from '../services/edit.server'
import { uploadFromUrl } from '../services/bunny.server'
import {
  generateMusic,
  isMockMusic,
  mockMusicStatus,
} from '../services/music.server'
import { generateSpeech } from '../services/tts.server'
import { chatCompletion } from '../services/openrouter.server'
import {
  appendClip,
  addClip,
  migrateManifest,
  newId,
  removeClip,
  sequenceEndFrame,
} from '../services/index.server'
import { DIRECTOR_MODELS, getVideoModelById } from '../services/types'
import {
  audioNeeds,
  canAfford,
  cutShots,
  cutSignature,
  draftDuration,
  finalsCost,
  musicDuration,
  needsAssembly,
  parsePlan,
  planTotals,
  priceMusic,
  priceShot,
  priceVoiceover,
  shotDuration,
  shotNeed,
  stillCost,
  stillSize,
} from '../../lib/production'
import {
  isVoice,
  parseBible,
  stillRequest,
  waitingForCutout,
} from '../../lib/bible'
import { composePackshot } from '../services/packshot.server'
import type { ProjectBible } from '../../lib/bible'
import type { PlanShot, PlanStep, ProductionPlan } from '../../lib/production'
import type { FalImageResult, FalVideoResult } from '../services/fal.server'
import type { FalMusicResult } from '../services/music.server'

const MOCK = process.env.MOCK_GENERATION === 'true'

// =============================================================================
// Loading, saving, locking
// =============================================================================

export interface ProductionContext {
  userId: string
  projectId: string
}

export async function loadProduction(ctx: ProductionContext) {
  const project = await prisma.project.findUnique({
    where: { id: ctx.projectId },
    select: {
      id: true,
      userId: true,
      plan: true,
      budgetUsd: true,
      width: true,
      height: true,
      fps: true,
      manifest: true,
      bible: true,
    },
  })
  if (!project) throw new Error('Project not found')
  if (project.userId !== ctx.userId) throw new Error('Unauthorized')
  return {
    project,
    plan: parsePlan(project.plan),
    bible: parseBible(project.bible),
  }
}

export async function savePlan(
  projectId: string,
  plan: ProductionPlan | null,
): Promise<void> {
  if (plan) plan.updatedAt = new Date().toISOString()
  await prisma.project.update({
    where: { id: projectId },
    data: { plan: plan ? JSON.stringify(plan) : null },
  })
}

export async function saveBible(projectId: string, bible: ProjectBible) {
  await prisma.project.update({
    where: { id: projectId },
    data: { bible: JSON.stringify(bible) },
  })
}

/**
 * One runner per project at a time. Two tabs ticking together would both see
 * "this shot needs a draft" and pay for it twice. The app runs as a single
 * Node process (SQLite), so an in-process lock is enough.
 */
const locks = new Map<string, Promise<unknown>>()

export async function withProjectLock<T>(
  projectId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = locks.get(projectId) ?? Promise.resolve()
  const run = prev.catch(() => {}).then(fn)
  locks.set(projectId, run)
  try {
    return await run
  } finally {
    if (locks.get(projectId) === run) locks.delete(projectId)
  }
}

/** Is a tick already running for this project? (polls skip instead of queueing) */
export function isLocked(projectId: string): boolean {
  return locks.has(projectId)
}

// =============================================================================
// Submitting
// =============================================================================

function errorText(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg
}

interface SubmitArgs {
  ctx: ProductionContext
  key: string
  shot?: PlanShot
  stage:
    | 'still'
    | 'draft'
    | 'final'
    | 'music'
    | 'reference'
    | 'cutout'
    | 'packshot'
  costUsd: number
}

/** Create the job row, call fal, and store fal's own status/response URLs */
export async function submitJob(
  args: SubmitArgs & {
    type: 'image' | 'video' | 'music' | 'edit'
    model: string
    input: Record<string, unknown>
    start: () => Promise<{
      requestId: string
      statusUrl?: string
      responseUrl?: string
      cancelUrl?: string
    }>
  },
): Promise<PlanStep> {
  const startedAt = new Date().toISOString()
  const job = await prisma.generationJob.create({
    data: {
      userId: args.ctx.userId,
      projectId: args.ctx.projectId,
      type: args.type,
      status: 'pending',
      provider: 'fal',
      model: args.model,
      input: JSON.stringify({
        ...args.input,
        production: { shotId: args.shot?.id, stage: args.stage },
      }),
      estimatedCostUsd: args.costUsd,
    },
  })
  try {
    const fal = await args.start()
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        externalId: fal.requestId,
        statusUrl: fal.statusUrl,
        responseUrl: fal.responseUrl,
        cancelUrl: fal.cancelUrl,
      },
    })
    return {
      status: 'running',
      jobId: job.id,
      costUsd: args.costUsd,
      startedAt,
    }
  } catch (error) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: errorText(error) },
    })
    return {
      status: 'failed',
      jobId: job.id,
      costUsd: 0,
      error: errorText(error),
      startedAt,
    }
  }
}

/**
 * A shot's still: an edit of its cast's reference images when the Bible has
 * them (same faces and products in every shot), otherwise text-to-image.
 * Both carry the Bible's style.
 */
function submitStill(
  plan: ProductionPlan,
  bible: ProjectBible,
  shot: PlanShot,
  ctx: ProductionContext,
  key: string,
  costUsd: number,
) {
  const request = stillRequest(bible, shot)
  if (request.mode === 'packshot') {
    // the set only; the cut-out is placed on it when it lands
    const size = stillSize(plan.aspectRatio)
    return submitJob({
      ctx,
      key,
      shot,
      stage: 'still',
      costUsd,
      type: 'image',
      model: plan.models.still,
      input: { prompt: request.prompt, ...size, packshot: true },
      start: () =>
        generateImage(
          { prompt: request.prompt, model: plan.models.still, ...size },
          key,
        ),
    }).then((step) =>
      step.status === 'running'
        ? { ...step, packshotOf: request.cutoutUrl }
        : step,
    )
  }
  if (request.mode === 'reference') {
    const model = DIRECTOR_MODELS.referenceStill
    return submitJob({
      ctx,
      key,
      shot,
      stage: 'still',
      costUsd,
      type: 'edit',
      model,
      input: {
        prompt: request.prompt,
        imageUrls: request.imageUrls,
        aspectRatio: plan.aspectRatio,
        editType: 'edit',
      },
      start: () =>
        editImage(
          {
            prompt: request.prompt,
            imageUrls: request.imageUrls,
            model,
            aspectRatio: plan.aspectRatio,
          },
          key,
        ),
    })
  }
  const size = stillSize(plan.aspectRatio)
  return submitJob({
    ctx,
    key,
    shot,
    stage: 'still',
    costUsd,
    type: 'image',
    model: plan.models.still,
    input: { prompt: request.prompt, ...size },
    start: () =>
      generateImage(
        { prompt: request.prompt, model: plan.models.still, ...size },
        key,
      ),
  })
}

/**
 * A packshot's set has landed: place the cut-out on it. The composite
 * becomes the still; the set stays in the library. Failing here keeps the
 * charge (fal billed the set) and leaves the shot to Retry.
 */
async function finishPackshot(
  step: PlanStep,
  shot: PlanShot,
  ctx: ProductionContext,
): Promise<PlanStep> {
  if (step.status !== 'done' || !step.url || !step.packshotOf) {
    return step.status === 'failed' ? { ...step, packshotOf: undefined } : step
  }
  try {
    const out = await composePackshot({
      backgroundUrl: step.url,
      cutoutUrl: step.packshotOf,
      userId: ctx.userId,
      projectId: ctx.projectId,
      shotId: shot.id,
      title: shot.title,
    })
    return {
      ...step,
      url: out.url,
      assetId: out.assetId,
      packshotOf: undefined,
    }
  } catch (error) {
    return {
      ...step,
      status: 'failed',
      packshotOf: undefined,
      error: `Placing the product failed: ${errorText(error)}`,
    }
  }
}

/** What the still of a shot costs as it would be submitted now */
function stillPrice(
  plan: ProductionPlan,
  bible: ProjectBible,
  shot: PlanShot,
): number {
  return stillCost(
    shot,
    plan.models,
    plan.aspectRatio,
    stillRequest(bible, shot).mode === 'reference',
  )
}

function submitClip(
  plan: ProductionPlan,
  shot: PlanShot,
  stage: 'draft' | 'final',
  ctx: ProductionContext,
  key: string,
  costUsd: number,
) {
  const model = stage === 'draft' ? plan.models.draft : plan.models.final.model
  const config = getVideoModelById(model)
  const duration =
    stage === 'draft'
      ? draftDuration(shot.durationSec, plan.models)
      : shotDuration(shot.durationSec, plan.models)
  // only send a resolution the model lists (rule 3)
  const resolution =
    stage === 'final' &&
    plan.models.final.resolution &&
    config?.resolutions?.includes(plan.models.final.resolution)
      ? plan.models.final.resolution
      : undefined
  const imageUrl = shot.still?.url ?? ''
  const prompt = shot.motion || shot.description
  return submitJob({
    ctx,
    key,
    shot,
    stage,
    costUsd,
    type: 'video',
    model,
    input: {
      generationType: 'image-to-video',
      prompt,
      imageUrl,
      duration,
      resolution,
    },
    start: () =>
      generateVideo(
        {
          generationType: 'image-to-video',
          prompt,
          imageUrl,
          model,
          duration,
          resolution,
        },
        key,
      ),
  }).then((step) => ({ ...step, durationSec: duration }))
}

function submitMusic(
  plan: ProductionPlan,
  ctx: ProductionContext,
  key: string,
  costUsd: number,
) {
  const durationSec = musicDuration(plan)
  const prompt = plan.music?.prompt ?? ''
  return submitJob({
    ctx,
    key,
    stage: 'music',
    costUsd,
    type: 'music',
    model: DIRECTOR_MODELS.music,
    input: { prompt, instrumental: true, durationSec, title: plan.title },
    start: () =>
      generateMusic(
        {
          prompt,
          model: DIRECTOR_MODELS.music,
          instrumental: true,
          durationSec,
        },
        key,
      ),
  }).then((step) => ({ ...step, durationSec }))
}

/** Voiceover is synchronous at fal (seconds), so it finishes inside the tick */
async function makeVoiceover(
  plan: ProductionPlan,
  bible: ProjectBible,
  ctx: ProductionContext,
  key: string,
  costUsd: number,
): Promise<PlanStep> {
  const script = plan.voiceover?.script ?? ''
  const voice = isVoice(bible.voice) ? bible.voice : undefined
  const startedAt = new Date().toISOString()
  const job = await prisma.generationJob.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      type: 'audio',
      status: 'pending',
      provider: 'fal',
      model: DIRECTOR_MODELS.voice,
      input: JSON.stringify({
        text: script,
        voice,
        production: { stage: 'voiceover' },
      }),
      estimatedCostUsd: costUsd,
    },
  })
  try {
    const storage = await getUserStorageConfig(ctx.userId)
    const result = await generateSpeech(
      { text: script, voice, model: DIRECTOR_MODELS.voice },
      key,
      storage,
    )
    const asset = await prisma.asset.create({
      data: {
        userId: ctx.userId,
        projectId: ctx.projectId,
        type: 'audio',
        storageUrl: result.audioUrl,
        filename: `voiceover-${Date.now()}.mp3`,
        prompt: script.slice(0, 500),
        provider: 'fal',
        model: DIRECTOR_MODELS.voice,
        durationSeconds: result.duration,
        metadata: JSON.stringify({ wordTimestamps: result.wordTimestamps }),
      },
    })
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: 100,
        output: JSON.stringify({ url: result.audioUrl, assetId: asset.id }),
      },
    })
    return {
      status: 'done',
      jobId: job.id,
      assetId: asset.id,
      url: result.audioUrl,
      durationSec: result.duration,
      costUsd,
      startedAt,
    }
  } catch (error) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: errorText(error) },
    })
    return {
      status: 'failed',
      jobId: job.id,
      costUsd: 0,
      error: errorText(error),
      startedAt,
    }
  }
}

// =============================================================================
// Polling
// =============================================================================

type MediaKind = 'image' | 'video' | 'music'

/** Poll one running step; on completion store the file and create the asset */
export async function pollStep(
  step: PlanStep,
  kind: MediaKind,
  ctx: ProductionContext,
  key: string,
  label: { shot?: PlanShot; stage: string; metadata?: Record<string, unknown> },
): Promise<PlanStep> {
  if (step.status !== 'running' || !step.jobId) return step
  const job = await prisma.generationJob.findUnique({
    where: { id: step.jobId },
  })
  if (!job)
    return {
      ...step,
      status: 'failed',
      costUsd: 0,
      error: 'Job record missing',
    }

  // finished elsewhere (another tab's tick)
  if (job.status === 'completed' && job.output) {
    const out = JSON.parse(job.output) as { url?: string; assetId?: string }
    return { ...step, status: 'done', url: out.url, assetId: out.assetId }
  }
  if (job.status === 'failed') {
    return {
      ...step,
      status: 'failed',
      costUsd: 0,
      error: job.error ?? 'Failed',
    }
  }
  if (!job.statusUrl || !job.responseUrl) return step

  let fal: Awaited<ReturnType<typeof getJobStatus>>
  try {
    fal =
      kind === 'music' && isMockMusic()
        ? (mockMusicStatus() as never)
        : job.type === 'edit'
          ? ((await getEditJobStatus(
              job.statusUrl,
              job.responseUrl,
              key,
            )) as never)
          : await getJobStatus(job.statusUrl, job.responseUrl, key)
  } catch {
    return step // transient — try again next tick
  }

  if (fal.status === 'failed') {
    const error = fal.error || 'Generation failed at fal'
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'failed', error },
    })
    return { ...step, status: 'failed', costUsd: 0, error }
  }
  if (fal.status !== 'completed' || !fal.result) {
    const progress = fal.status === 'processing' ? 50 : 10
    if (job.progress !== progress) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { progress },
      })
    }
    return step
  }

  const sourceUrl =
    kind === 'image'
      ? (fal.result as FalImageResult).images?.[0]?.url
      : kind === 'video'
        ? (fal.result as FalVideoResult).video?.url
        : (fal.result as unknown as FalMusicResult).audio?.url
  if (!sourceUrl) {
    const error = 'fal returned no file'
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'failed', error },
    })
    return { ...step, status: 'failed', costUsd: 0, error }
  }

  try {
    const storage = await getUserStorageConfig(ctx.userId)
    const folder =
      kind === 'image' ? 'images' : kind === 'video' ? 'videos' : 'music'
    const upload = await uploadFromUrl(
      sourceUrl,
      {
        folder: `${folder}/${ctx.userId}`,
        filename: `${label.stage}-${Date.now()}`,
      },
      storage ?? undefined,
    )
    const input = JSON.parse(job.input) as { prompt?: string }
    const asset = await prisma.asset.create({
      data: {
        userId: ctx.userId,
        projectId: ctx.projectId,
        type: kind,
        storageUrl: upload.url,
        filename: label.shot
          ? `${label.shot.title} · ${label.stage}`.slice(0, 120)
          : upload.filename,
        prompt: input.prompt,
        provider: 'fal',
        model: job.model,
        durationSeconds: kind === 'image' ? null : (step.durationSec ?? null),
        metadata: JSON.stringify({
          ...label.metadata,
          production: { shotId: label.shot?.id, stage: label.stage },
        }),
      },
    })
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: 100,
        output: JSON.stringify({ url: upload.url, assetId: asset.id }),
      },
    })
    return { ...step, status: 'done', url: upload.url, assetId: asset.id }
  } catch (error) {
    // fal has billed this one — keep the charge
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: errorText(error) },
    })
    return {
      ...step,
      status: 'failed',
      error: `Saving the file failed: ${errorText(error)}`,
    }
  }
}

// =============================================================================
// Self-check
// =============================================================================

const CHECK_PROMPT = `You review one frame from an AI-generated video shot against the shot's brief.
Look for what would make a director reject the take: wrong subject or action, broken anatomy (hands, faces, limbs), melted or garbled objects, unreadable or misspelled text, wrong mood or lighting, obvious AI artifacts.
Reply with JSON only: {"ok": true|false, "note": "<one short sentence>"}.
ok=true when the frame matches the brief and has no visible defect. When ok=false the note names the problem and ends with "retry suggested".`

/**
 * Compare the middle frame of a finished draft to its shot. Returns the
 * verdict and what it cost (frame extraction is fractions of a cent; the
 * vision call reports its own cost).
 */
export async function selfCheck(
  shot: PlanShot,
  videoUrl: string,
  key: string,
): Promise<{
  ok?: boolean
  note: string
  frameUrl?: string
  costUsd: number
  failed?: boolean
}> {
  if (MOCK)
    return { ok: true, note: 'Self-check skipped in mock mode.', costUsd: 0 }

  let frameUrl: string | undefined
  try {
    const res = await fetch(`https://fal.run/${DIRECTOR_MODELS.frameExtract}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ video_url: videoUrl, frame_type: 'middle' }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`frame extract ${res.status}`)
    const body = (await res.json()) as { images?: Array<{ url: string }> }
    frameUrl = body.images?.[0]?.url
    if (!frameUrl) throw new Error('no frame returned')
  } catch (error) {
    return {
      note: `Couldn't grab a frame to check (${errorText(error)}).`,
      costUsd: 0,
      failed: true,
    }
  }

  try {
    const response = await chatCompletion(
      {
        model: DIRECTOR_MODELS.selfCheck,
        temperature: 0,
        maxTokens: 200,
        messages: [
          { role: 'system', content: CHECK_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Shot: ${shot.title}\nBrief: ${shot.description}\nPicture: ${shot.prompt}\nMotion: ${shot.motion}`,
              },
              { type: 'image_url', image_url: { url: frameUrl } },
            ],
          },
        ],
      },
      key,
    )
    const text = response.choices[0]?.message?.content
    const raw = typeof text === 'string' ? text : ''
    const json = raw.match(/\{[\s\S]*\}/)?.[0]
    const parsed = json
      ? (JSON.parse(json) as { ok?: unknown; note?: unknown })
      : {}
    const ok = typeof parsed.ok === 'boolean' ? parsed.ok : undefined
    const note =
      typeof parsed.note === 'string' && parsed.note.trim()
        ? parsed.note.trim().slice(0, 240)
        : ok === undefined
          ? 'The check gave no clear answer.'
          : ok
            ? 'Matches the brief.'
            : 'Looks off — retry suggested.'
    return {
      ok,
      note,
      frameUrl,
      costUsd: response.usage?.cost ?? 0,
      failed: ok === undefined,
    }
  } catch (error) {
    return {
      note: `Self-check failed (${errorText(error)}).`,
      frameUrl,
      costUsd: 0,
      failed: true,
    }
  }
}

// =============================================================================
// Assembly
// =============================================================================

/**
 * Lay the finals on the base video lane in shot order, voiceover on Voice
 * and the score on Music, replacing whatever the last assembly placed.
 */
async function assemble(
  plan: ProductionPlan,
  project: { id: string; manifest: string; fps: number },
): Promise<ProductionPlan> {
  let manifest = migrateManifest(project.manifest)
  for (const id of plan.assembly?.clipIds ?? []) {
    manifest = removeClip(manifest, id)
  }
  const fps = project.fps
  const clipIds: Array<string> = []
  let firstFrame: number | undefined
  let lastFrame = 0

  cutShots(plan).forEach((shot) => {
    const final = shot.final!
    const sec = final.durationSec ?? shot.durationSec
    const placed = appendClip(manifest, 'video', {
      id: newId('shot'),
      kind: 'video',
      assetId: final.assetId,
      url: final.url,
      label: shot.title,
      durationFrames: Math.round(sec * fps),
      sourceInFrame: 0,
      transitionFrames: 0,
      gain: 1,
    })
    manifest = placed.manifest
    clipIds.push(placed.clip.id)
    firstFrame ??= placed.clip.startFrame
    lastFrame = placed.clip.startFrame + placed.clip.durationFrames
  })

  const start = firstFrame ?? 0
  const cutFrames = lastFrame - start
  const audio: Array<['voice' | 'music', PlanStep | undefined]> = [
    ['voice', plan.voiceover?.step],
    ['music', plan.music?.step],
  ]
  for (const [kind, step] of audio) {
    if (step?.status !== 'done' || !step.url) continue
    let wordTimestamps: unknown
    if (kind === 'voice' && step.assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: step.assetId },
      })
      wordTimestamps = asset?.metadata
        ? JSON.parse(asset.metadata).wordTimestamps
        : undefined
    }
    const sec = step.durationSec ?? cutFrames / fps
    const placed = addClip(manifest, kind, {
      id: newId(kind),
      kind: 'audio',
      assetId: step.assetId,
      url: step.url,
      label: kind === 'voice' ? 'Voiceover' : plan.title,
      startFrame: start,
      durationFrames: Math.max(1, Math.min(Math.round(sec * fps), cutFrames)),
      sourceInFrame: 0,
      transitionFrames: 0,
      gain: kind === 'music' && plan.voiceover ? 0.35 : 1,
      ...(wordTimestamps ? { wordTimestamps: wordTimestamps as never } : {}),
    })
    manifest = placed.manifest
    clipIds.push(placed.clip.id)
  }

  await prisma.project.update({
    where: { id: project.id },
    data: {
      manifest: JSON.stringify(manifest),
      duration: sequenceEndFrame(manifest),
      thumbnailUrl: cutShots(plan)[0]?.still?.url ?? undefined,
    },
  })
  return {
    ...plan,
    assembly: {
      clipIds,
      signature: cutSignature(plan),
      at: new Date().toISOString(),
    },
  }
}

// =============================================================================
// The tick
// =============================================================================

function charge(plan: ProductionPlan, step: PlanStep) {
  plan.spentUsd = Math.round((plan.spentUsd + step.costUsd) * 10_000) / 10_000
}

function refund(
  plan: ProductionPlan,
  before: PlanStep | undefined,
  after: PlanStep,
) {
  if (
    before?.status === 'running' &&
    after.status === 'failed' &&
    after.costUsd === 0
  ) {
    plan.spentUsd = Math.max(
      0,
      Math.round((plan.spentUsd - before.costUsd) * 10_000) / 10_000,
    )
  }
}

function stop(
  plan: ProductionPlan,
  budgetUsd: number,
  what: string,
  costUsd: number,
) {
  const left = Math.max(0, budgetUsd - plan.spentUsd)
  plan.stopped = `Stopped at the budget: ${what} needs ≈$${costUsd.toFixed(2)} and $${left.toFixed(2)} of $${budgetUsd.toFixed(2)} is left. Raise the budget to continue.`
}

/**
 * Advance a production by one step everywhere it can move. Safe to call as
 * often as you like: it only starts what a shot needs and only spends within
 * the budget.
 */
export async function tickProduction(ctx: ProductionContext): Promise<{
  plan: ProductionPlan | null
  budgetUsd: number
  assembled: boolean
}> {
  return withProjectLock(ctx.projectId, async () => {
    const { project, plan, bible } = await loadProduction(ctx)
    if (!plan)
      return { plan: null, budgetUsd: project.budgetUsd, assembled: false }
    const budget = project.budgetUsd
    const key = await getUserFalApiKey(ctx.userId)
    const before = JSON.stringify(plan)

    // 1. poll everything in flight, in parallel
    await Promise.all(
      plan.shots.map(async (shot) => {
        for (const stage of ['still', 'draft', 'final'] as const) {
          const step = shot[stage]
          if (step?.status !== 'running') continue
          let next = await pollStep(
            step,
            stage === 'still' ? 'image' : 'video',
            ctx,
            key,
            {
              shot,
              stage,
            },
          )
          refund(plan, step, next)
          if (stage === 'still' && next.packshotOf) {
            next = await finishPackshot(next, shot, ctx)
          }
          shot[stage] = next
        }
      }),
    )
    if (plan.music?.step?.status === 'running') {
      const next = await pollStep(plan.music.step, 'music', ctx, key, {
        stage: 'music',
      })
      refund(plan, plan.music.step, next)
      plan.music.step = next
    }

    // 2. start what each shot needs, in order, within budget
    // (a raised budget lifts an earlier stop)
    plan.stopped = undefined
    const checks: Array<PlanShot> = []
    for (const shot of plan.shots) {
      const need = shotNeed(shot)
      if (!need) continue
      if (need === 'check') {
        checks.push(shot)
        continue
      }
      if (need === 'promote') {
        shot.final = { ...shot.draft!, costUsd: 0 }
        continue
      }
      // a cut-out of its cast is on its way: the still waits for it
      if (need === 'still' && waitingForCutout(bible, shot)) continue
      const price = priceShot(shot, plan.models, plan.aspectRatio)
      const cost =
        need === 'still'
          ? stillPrice(plan, bible, shot)
          : need === 'draft'
            ? price.draftUsd
            : price.finalUsd
      if (!canAfford(plan, budget, cost)) {
        stop(plan, budget, `the ${need} for “${shot.title}”`, cost)
        break
      }
      const step =
        need === 'still'
          ? await submitStill(plan, bible, shot, ctx, key, cost)
          : await submitClip(plan, shot, need, ctx, key, cost)
      shot[need] = step
      charge(plan, step)
    }

    if (!plan.stopped) {
      for (const need of audioNeeds(plan)) {
        // audio goes last so it never starves a shot of budget
        if (plan.shots.some((s) => s.wantFinal && shotNeed(s) !== null)) break
        const cost =
          need === 'music'
            ? priceMusic(plan)
            : priceVoiceover(plan.voiceover!.script)
        if (!canAfford(plan, budget, cost)) {
          stop(
            plan,
            budget,
            need === 'music' ? 'the music' : 'the voiceover',
            cost,
          )
          break
        }
        const step =
          need === 'music'
            ? await submitMusic(plan, ctx, key, cost)
            : await makeVoiceover(plan, bible, ctx, key, cost)
        if (need === 'music') plan.music!.step = step
        else plan.voiceover!.step = step
        charge(plan, step)
      }
    }

    // 3. self-check finished drafts, in parallel
    for (const shot of checks) shot.check = { status: 'running' }
    if (checks.length > 0) {
      await Promise.all(
        checks.map(async (shot) => {
          const result = await selfCheck(shot, shot.draft!.url!, key)
          plan.spentUsd =
            Math.round((plan.spentUsd + result.costUsd) * 10_000) / 10_000
          shot.check = {
            status: result.failed ? 'failed' : 'done',
            ok: result.ok,
            note: result.note,
            frameUrl: result.frameUrl,
          }
        }),
      )
    }

    // 4. assemble once every wanted final has settled
    let assembled = false
    let next = plan
    if (needsAssembly(plan)) {
      next = await assemble(plan, project)
      assembled = true
    }

    if (JSON.stringify(next) !== before) await savePlan(ctx.projectId, next)
    return { plan: next, budgetUsd: budget, assembled }
  })
}

// =============================================================================
// User actions
// =============================================================================

export type RenderStage = 'drafts' | 'finals' | 'direct'

/**
 * Ask for drafts (every shot), finals (approved shots) or a direct render
 * (finals for every shot, no drafts — the composer's Final mode). Refuses
 * up front when the projected cost would not fit the budget.
 */
export async function requestRender(
  ctx: ProductionContext,
  stage: RenderStage,
): Promise<{ plan: ProductionPlan; message: string }> {
  return withProjectLock(ctx.projectId, async () => {
    const { project, plan } = await loadProduction(ctx)
    if (!plan)
      throw new Error('There is no plan yet — ask the Director for one.')
    const budget = project.budgetUsd
    const left = Math.max(0, budget - plan.spentUsd)

    let projected = 0
    if (stage === 'drafts') {
      for (const shot of plan.shots) {
        if (shot.draft?.status === 'done' || shot.draft?.status === 'running')
          continue
        const p = priceShot(shot, plan.models, plan.aspectRatio)
        projected +=
          (shot.still?.status === 'done' ? 0 : p.stillUsd) + p.draftUsd
      }
    } else if (stage === 'finals') {
      if (!plan.shots.some((s) => s.decision)) {
        throw new Error(
          'Keep or promote at least one shot before rendering finals.',
        )
      }
      projected = finalsCost(plan)
    } else {
      for (const shot of plan.shots) {
        if (shot.final?.status === 'done') continue
        const p = priceShot(shot, plan.models, plan.aspectRatio)
        projected +=
          (shot.still?.status === 'done' ? 0 : p.stillUsd) + p.finalUsd
      }
      projected += planTotals(plan).audioUsd
    }
    if (projected > left + 0.0005) {
      throw new Error(
        `That needs ≈$${projected.toFixed(2)} and $${left.toFixed(2)} of the $${budget.toFixed(2)} budget is left. Raise the budget or cut shots.`,
      )
    }

    for (const shot of plan.shots) {
      if (stage === 'drafts') shot.wantDraft = true
      else if (stage === 'finals') shot.wantFinal = !!shot.decision
      else {
        shot.wantFinal = true
        shot.decision ??= 'keep'
      }
    }
    if (stage !== 'drafts') plan.finalsRequestedAt = new Date().toISOString()
    plan.stopped = undefined
    await savePlan(ctx.projectId, plan)

    const what =
      stage === 'drafts'
        ? `drafts for ${plan.shots.length} shots`
        : stage === 'finals'
          ? `finals for ${plan.shots.filter((s) => s.decision).length} shots`
          : `finals for ${plan.shots.length} shots, no drafts`
    return { plan, message: `Rendering ${what}, ≈$${projected.toFixed(2)}.` }
  })
}

export type ReviewAction = 'keep' | 'promote' | 'clear' | 'retry' | 'retryFinal'

export async function reviewShot(
  ctx: ProductionContext,
  shotId: string,
  action: ReviewAction,
): Promise<ProductionPlan> {
  return withProjectLock(ctx.projectId, async () => {
    const { plan } = await loadProduction(ctx)
    if (!plan) throw new Error('No plan')
    const shot = plan.shots.find((s) => s.id === shotId)
    if (!shot) throw new Error('Shot not found')

    switch (action) {
      case 'keep':
      case 'promote':
        if (shot.draft?.status !== 'done' && action === 'promote') {
          throw new Error('There is no finished draft to promote.')
        }
        // changing your mind after a final exists drops that final
        if (
          shot.decision !== action &&
          shot.final &&
          shot.final.status !== 'running'
        ) {
          shot.final = undefined
        }
        shot.decision = action
        if (plan.finalsRequestedAt) shot.wantFinal = true
        break
      case 'clear':
        shot.decision = null
        shot.wantFinal = false
        break
      case 'retry':
        if (shotBusyStage(shot))
          throw new Error('That shot is still rendering.')
        // a new still and a new draft; the old ones stay in the library
        shot.still = undefined
        shot.draft = undefined
        shot.check = undefined
        shot.final = undefined
        shot.decision = null
        shot.wantDraft = true
        shot.wantFinal = false
        break
      case 'retryFinal':
        if (shot.final?.status === 'running')
          throw new Error('The final is still rendering.')
        shot.final = undefined
        if (shot.still?.status === 'failed') shot.still = undefined
        shot.wantFinal = true
        break
    }
    plan.stopped = undefined
    await savePlan(ctx.projectId, plan)
    return plan
  })
}

function shotBusyStage(shot: PlanShot): boolean {
  return [shot.still, shot.draft, shot.final, shot.check].some(
    (s) => s?.status === 'running',
  )
}
