/**
 * Project ownership for writes that take a client-supplied `projectId`.
 *
 * Generation endpoints accept an optional project to file their asset under;
 * without this check a user could drop assets into someone else's project.
 */

import { prisma } from '../db.server'

/** `projectId` if the user owns it, null if none was given; throws otherwise */
export async function ownedProjectId(
  projectId: string | null | undefined,
  userId: string,
): Promise<string | null> {
  if (!projectId) return null
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })
  if (!project || project.userId !== userId) {
    throw new Error('Project not found')
  }
  return projectId
}
