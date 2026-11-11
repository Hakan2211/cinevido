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
import { DIRECTOR_MODELS } from './services/types'
import {
  loadProduction,
  pollStep,
  saveBible,
  submitJob,
  withProjectLock,
} from './agent/production.server'
import {
  REFERENCE_SIZE,
  bibleFromInput,
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
          const step = await pollStep(entry.pending!, 'image', ctx, key, {
            stage: `reference ${entry.name}`,
          })
          if (step.status === 'done' && step.url) {
            entry.imageUrl = step.url
            entry.assetId = step.assetId
            entry.pending = undefined
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
