/**
 * Director v2 — server functions for the Studio's production UI.
 *
 * The runner itself lives in agent/production.server.ts so the Director's
 * tools and these functions share one implementation.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db.server'
import { authMiddleware } from './middleware.server'
import {
  isLocked,
  loadProduction,
  requestRender,
  reviewShot,
  savePlan,
  tickProduction,
  withProjectLock,
} from './agent/production.server'
import { applyPlanEdit, shotBusy } from '../lib/production'
import type { ProductionPlan } from '../lib/production'

const projectSchema = z.object({ projectId: z.string() })

export interface ProductionState {
  plan: ProductionPlan | null
  budgetUsd: number
  /** true when this call laid finals on the timeline — reload the manifest */
  assembled: boolean
}

/** Read the plan without advancing it */
export const getProductionFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(projectSchema)
  .handler(async ({ data, context }): Promise<ProductionState> => {
    const { project, plan } = await loadProduction({
      projectId: data.projectId,
      userId: context.user.id,
    })
    return { plan, budgetUsd: project.budgetUsd, assembled: false }
  })

/**
 * Advance the production (poll fal, start what's next, self-check, assemble).
 * A poll that arrives while a tick is running reads instead of queueing.
 */
export const tickProductionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(projectSchema)
  .handler(async ({ data, context }): Promise<ProductionState> => {
    const ctx = { projectId: data.projectId, userId: context.user.id }
    if (isLocked(data.projectId)) {
      const { project, plan } = await loadProduction(ctx)
      return { plan, budgetUsd: project.budgetUsd, assembled: false }
    }
    return tickProduction(ctx)
  })

export const renderProductionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      projectId: z.string(),
      stage: z.enum(['drafts', 'finals', 'direct']),
    }),
  )
  .handler(async ({ data, context }) => {
    const ctx = { projectId: data.projectId, userId: context.user.id }
    const { message } = await requestRender(ctx, data.stage)
    // submit the first jobs now rather than on the next poll
    const state = await tickProduction(ctx)
    return { ...state, message }
  })

export const reviewShotFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      projectId: z.string(),
      shotId: z.string(),
      action: z.enum(['keep', 'promote', 'clear', 'retry', 'retryFinal']),
    }),
  )
  .handler(async ({ data, context }): Promise<ProductionState> => {
    const ctx = { projectId: data.projectId, userId: context.user.id }
    await reviewShot(ctx, data.shotId, data.action)
    return tickProduction(ctx)
  })

const shotEditSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(80),
  description: z.string().max(240),
  durationSec: z.number().min(1).max(30),
  prompt: z.string().min(1).max(1200),
  motion: z.string().max(500),
  cast: z.array(z.string().max(40)).max(4).optional(),
  packshot: z.string().max(40).nullable().optional(),
})

/** Edit plan: shots, order, final model. Re-priced on the server. */
export const updatePlanFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      projectId: z.string(),
      title: z.string().max(120).optional(),
      shots: z.array(shotEditSchema).min(1).max(12),
      final: z
        .object({ model: z.string(), resolution: z.string().optional() })
        .optional(),
    }),
  )
  .handler(async ({ data, context }): Promise<ProductionState> => {
    const ctx = { projectId: data.projectId, userId: context.user.id }
    return withProjectLock(data.projectId, async () => {
      const { project, plan } = await loadProduction(ctx)
      if (!plan) throw new Error('No plan to edit')
      if (plan.shots.some(shotBusy)) {
        throw new Error(
          'Wait for the running renders to finish before editing the plan.',
        )
      }
      const next = applyPlanEdit(plan, {
        title: data.title,
        shots: data.shots,
        final: data.final,
      })
      await savePlan(data.projectId, next)
      return { plan: next, budgetUsd: project.budgetUsd, assembled: false }
    })
  })

export const setBudgetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({ projectId: z.string(), budgetUsd: z.number().min(1).max(1000) }),
  )
  .handler(async ({ data, context }) => {
    await loadProduction({ projectId: data.projectId, userId: context.user.id })
    await prisma.project.update({
      where: { id: data.projectId },
      data: { budgetUsd: Math.round(data.budgetUsd * 100) / 100 },
    })
    return { budgetUsd: data.budgetUsd }
  })
