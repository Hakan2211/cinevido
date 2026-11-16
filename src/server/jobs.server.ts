/**
 * Lab jobs still running, for the app-wide job tracker (src/lib/lab-jobs.ts).
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db.server'
import { ACTIVE_WINDOW_MS, LAB_JOB_TYPES, toLabJob } from '../lib/lab-jobs'
import { authMiddleware } from './middleware.server'
import { getUserFalApiKey } from './byok.server'
import { cancelJob } from './services/fal.server'
import type { LabJob } from '../lib/lab-jobs'

/** The user's unfinished lab jobs, newest first */
export const listActiveLabJobsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Array<LabJob>> => {
    const rows = await prisma.generationJob.findMany({
      where: {
        userId: context.user.id,
        projectId: null,
        type: { in: [...LAB_JOB_TYPES] },
        status: { in: ['pending', 'processing'] },
        createdAt: { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    return rows.map(toLabJob).filter((job): job is LabJob => job !== null)
  })

/**
 * "Stop waiting": ask fal to cancel (a queued request is not billed) and
 * close the job so the tracker drops it.
 */
export const stopLabJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ jobId: z.string() }))
  .handler(async ({ data, context }) => {
    const job = await prisma.generationJob.findUnique({
      where: { id: data.jobId },
    })
    if (!job || job.userId !== context.user.id) throw new Error('Job not found')
    if (job.status !== 'pending' && job.status !== 'processing') {
      return { stopped: false }
    }

    // Only fal's own cancel URL (edit/upscale jobs don't store one)
    if (job.cancelUrl) {
      try {
        await cancelJob(job.cancelUrl, await getUserFalApiKey(job.userId))
      } catch {
        // already running or finished: it may still be billed, but we stop
      }
    }

    const res = await prisma.generationJob.updateMany({
      where: { id: job.id, status: { in: ['pending', 'processing'] } },
      data: { status: 'failed', error: 'Stopped waiting' },
    })
    return { stopped: res.count === 1 }
  })
