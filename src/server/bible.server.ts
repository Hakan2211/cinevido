/**
 * Director v2 — the Project Bible: server functions for the Studio's Bible
 * tab (read, save, generate a reference portrait, poll it).
 *
 * Writes go through the production lock so a save never races a tick that
 * is reading the Bible to submit a still.
 *
 * Only server functions are exported: the client imports this module, and
 * anything else exported here would pull Prisma into the browser bundle.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './middleware.server'
import { getUserFalApiKey } from './byok.server'
import { generateImage } from './services/fal.server'
import { editImage } from './services/edit.server'
import { DIRECTOR_MODELS } from './services/types'
import {
  loadProduction,
  pollStep,
  saveBible,
  submitJob,
  withProjectLock,
} from './agent/production.server'
import {
  CUTOUT_MODEL,
  REFERENCE_SIZE,
  bibleFromInput,
  canCutOut,
  cutoutCost,
  cutoutPrompt,
  bibleInputSchema,
  referenceCost,
  referencePrompt,
} from '../lib/bible'

const projectSchema = z.object({ projectId: z.string() })

export const getBibleFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(projectSchema)
  .handler(async ({ data, context }) => {
    const { bible } = await loadProduction({
      projectId: data.projectId,
      userId: context.user.id,
    })
    return { bible }
  })

export const saveBibleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(bibleInputSchema.extend({ projectId: z.string() }))
  .handler(async ({ data, context }) => {
    const ctx = { projectId: data.projectId, userId: context.user.id }
    return withProjectLock(data.projectId, async () => {
      const { bible: prev } = await loadProduction(ctx)
      const bible = bibleFromInput(data, prev)
      await saveBible(data.projectId, bible)
      return { bible }
    })
  })

/**
 * Generate a reference portrait for one entry from its description and the
 * style. Billed to the user's fal key at the price the button shows; not
 * charged to the production budget (that covers the shots).
 */
export const generateReferenceFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ projectId: z.string(), entryId: z.string() }))
  .handler(async ({ data, context }) => {
    const ctx = { projectId: data.projectId, userId: context.user.id }
    return withProjectLock(data.projectId, async () => {
      const { bible } = await loadProduction(ctx)
      const entry = bible.entries.find((e) => e.id === data.entryId)
      if (!entry) throw new Error('That entry is gone — save the Bible first.')
      if (entry.pending?.status === 'running') {
        throw new Error('A reference is already being generated.')
      }
      if (!entry.description.trim()) {
        throw new Error(
          'Describe the look first — the reference is drawn from it.',
        )
      }
      const key = await getUserFalApiKey(context.user.id)
      const prompt = referencePrompt(bible, entry)
      const model = DIRECTOR_MODELS.still
      entry.pending = await submitJob({
        ctx,
        key,
        stage: 'reference',
        costUsd: referenceCost(),
        type: 'image',
        model,
        input: { prompt, ...REFERENCE_SIZE },
        start: () => generateImage({ prompt, model, ...REFERENCE_SIZE }, key),
      })
      entry.pendingCutout = undefined
      await saveBible(data.projectId, bible)
      return { bible }
    })
  })

/**
 * Cut an entry's reference out of its background (Seedream 5.5 Edit,
 * transparent PNG) — a clean product or character for the reference edits
 * and for packshots. Billed to the user's key like a generated reference,
 * not to the production budget. "Undo cut-out" restores `uncut`.
 */
export const cutoutReferenceFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ projectId: z.string(), entryId: z.string() }))
  .handler(async ({ data, context }) => {
    const ctx = { projectId: data.projectId, userId: context.user.id }
    return withProjectLock(data.projectId, async () => {
      const { bible } = await loadProduction(ctx)
      const entry = bible.entries.find((e) => e.id === data.entryId)
      if (!entry) throw new Error('That entry is gone — save the Bible first.')
      if (!entry.imageUrl) throw new Error('Pick a reference image first.')
      if (!canCutOut(entry)) {
        throw new Error(
          entry.cutout
            ? 'This reference is already cut out.'
            : entry.kind === 'place'
              ? 'Places are backgrounds — there is nothing to cut out.'
              : 'Wait for the reference that is being made.',
        )
      }
      const key = await getUserFalApiKey(context.user.id)
      const prompt = cutoutPrompt(entry)
      const imageUrls = [entry.imageUrl]
      entry.pending = await submitJob({
        ctx,
        key,
        stage: 'cutout',
        costUsd: cutoutCost(),
        type: 'edit',
        model: CUTOUT_MODEL,
        input: {
          prompt,
          imageUrls,
          editType: 'edit',
          background: 'transparent',
        },
        start: () =>
          editImage(
            {
              prompt,
              imageUrls,
              model: CUTOUT_MODEL,
              background: 'transparent',
            },
            key,
          ),
      })
      entry.pendingCutout = true
      await saveBible(data.projectId, bible)
      return { bible }
    })
  })

/** Poll the reference portraits in flight; a finished one becomes the image */
export const pollBibleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(projectSchema)
  .handler(async ({ data, context }) => {
    const ctx = { projectId: data.projectId, userId: context.user.id }
    return withProjectLock(data.projectId, async () => {
      const { bible } = await loadProduction(ctx)
      const running = bible.entries.filter(
        (e) => e.pending?.status === 'running',
      )
      if (running.length === 0) return { bible }
      const key = await getUserFalApiKey(context.user.id)
      const before = JSON.stringify(bible)
      await Promise.all(
        running.map(async (entry) => {
          const cut = !!entry.pendingCutout
          const step = await pollStep(entry.pending!, 'image', ctx, key, {
            stage: `${cut ? 'cut-out' : 'reference'} ${entry.name}`,
            ...(cut && { metadata: { transparent: true } }),
          })
          if (step.status === 'done' && step.url) {
            if (cut && entry.imageUrl) {
              entry.uncut = { imageUrl: entry.imageUrl, assetId: entry.assetId }
              entry.cutout = true
            }
            entry.imageUrl = step.url
            entry.assetId = step.assetId
            entry.pending = undefined
            entry.pendingCutout = undefined
          } else {
            entry.pending = step
          }
        }),
      )
      if (JSON.stringify(bible) !== before)
        await saveBible(data.projectId, bible)
      return { bible }
    })
  })
