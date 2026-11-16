/**
 * One saver per finished job.
 *
 * A job's result is copied to storage and saved as an asset by whoever polls
 * it once fal reports it done. Several pollers can ask at once (the app-wide
 * job tracker, a lab page, a second tab), so the first one *claims* the job
 * by moving its progress to CLAIMED; the others see it as still processing
 * until the claimant marks it completed. A claim older than CLAIM_TTL_MS
 * (a crash mid-save) can be taken over.
 *
 * Server-only helpers: nothing here is a server function.
 */

import { prisma } from '../../db.server'

export const CLAIMED = 99
const CLAIM_TTL_MS = 2 * 60 * 1000

/** Claim a pending/processing job for saving; false if someone else has it */
export async function claimJob(jobId: string): Promise<boolean> {
  const stale = new Date(Date.now() - CLAIM_TTL_MS)
  const res = await prisma.generationJob.updateMany({
    where: {
      id: jobId,
      status: { in: ['pending', 'processing'] },
      OR: [{ progress: { lt: CLAIMED } }, { updatedAt: { lt: stale } }],
    },
    data: { progress: CLAIMED, status: 'processing' },
  })
  return res.count === 1
}

/** Give a claim back (the save failed) so the next poll can try again */
export async function releaseJob(jobId: string): Promise<void> {
  await prisma.generationJob.updateMany({
    where: { id: jobId, status: 'processing', progress: CLAIMED },
    data: { progress: 0 },
  })
}

/** Record in-flight progress without overwriting a claim */
export async function recordJobProgress(
  jobId: string,
  status: 'pending' | 'processing',
  progress: number,
): Promise<void> {
  await prisma.generationJob.updateMany({
    where: {
      id: jobId,
      status: { in: ['pending', 'processing'] },
      progress: { lt: CLAIMED },
    },
    data: { status, progress: Math.min(Math.round(progress), CLAIMED - 1) },
  })
}

/** What a poller that lost the claim reports */
export function claimedElsewhere(jobId: string) {
  return {
    jobId,
    status: 'processing' as const,
    progress: CLAIMED,
  }
}
