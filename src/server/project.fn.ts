/**
 * Project Server Functions
 *
 * CRUD operations for video projects and their manifests.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import { createEmptyManifest } from './services'
import type { ProjectManifest } from './services'

// =============================================================================
// Schemas
// =============================================================================

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  width: z.number().min(480).max(4096).optional(),
  height: z.number().min(480).max(4096).optional(),
  fps: z.number().min(24).max(60).optional(),
})

const updateProjectSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(100).optional(),
  width: z.number().min(480).max(4096).optional(),
  height: z.number().min(480).max(4096).optional(),
  fps: z.number().min(24).max(60).optional(),
})

const projectIdSchema = z.object({
  projectId: z.string(),
})

const updateManifestSchema = z.object({
  projectId: z.string(),
  manifest: z.string(), // JSON string of ProjectManifest
})

const listProjectsSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  status: z.enum(['draft', 'rendering', 'completed', 'failed']).optional(),
})

// =============================================================================
// Project CRUD
// =============================================================================

/**
 * Create a new project
 */
export const createProjectFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createProjectSchema)
  .handler(async ({ data, context }) => {
    const emptyManifest = createEmptyManifest()

    const project = await prisma.project.create({
      data: {
        name: data.name,
        userId: context.user.id,
        width: data.width || 1080,
        height: data.height || 1920,
        fps: data.fps || 30,
        manifest: JSON.stringify(emptyManifest),
        status: 'draft',
      },
    })

    return {
      id: project.id,
      name: project.name,
      width: project.width,
      height: project.height,
      fps: project.fps,
      status: project.status,
      manifest: emptyManifest,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }
  })

/**
 * Get a project by ID
 */
export const getProjectFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(projectIdSchema)
  .handler(async ({ data, context }) => {
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      include: {
        assets: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!project) {
      throw new Error('Project not found')
    }

    // Verify ownership
    if (project.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    return {
      id: project.id,
      name: project.name,
      width: project.width,
      height: project.height,
      fps: project.fps,
      duration: project.duration,
      status: project.status,
      outputUrl: project.outputUrl,
      thumbnailUrl: project.thumbnailUrl,
      manifest: JSON.parse(project.manifest) as ProjectManifest,
      assets: project.assets.map((asset) => ({
        id: asset.id,
        type: asset.type,
        url: asset.storageUrl,
        filename: asset.filename,
        prompt: asset.prompt,
        metadata: asset.metadata ? JSON.parse(asset.metadata) : null,
        durationSeconds: asset.durationSeconds,
        createdAt: asset.createdAt,
      })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }
  })

/**
 * List user's projects
 */
export const listProjectsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listProjectsSchema)
  .handler(async ({ data, context }) => {
    const projects = await prisma.project.findMany({
      where: {
        userId: context.user.id,
        ...(data.status && { status: data.status }),
      },
      orderBy: { updatedAt: 'desc' },
      take: data.limit || 20,
      skip: data.offset || 0,
      select: {
        id: true,
        name: true,
        width: true,
        height: true,
        fps: true,
        duration: true,
        status: true,
        thumbnailUrl: true,
        outputUrl: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { assets: true },
        },
      },
    })

    const total = await prisma.project.count({
      where: {
        userId: context.user.id,
        ...(data.status && { status: data.status }),
      },
    })

    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        width: p.width,
        height: p.height,
        fps: p.fps,
        duration: p.duration,
        status: p.status,
        thumbnailUrl: p.thumbnailUrl,
        outputUrl: p.outputUrl,
        assetCount: p._count.assets,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      total,
    }
  })

/**
 * Update project settings
 */
export const updateProjectFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateProjectSchema)
  .handler(async ({ data, context }) => {
    // Verify ownership
    const existing = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { userId: true },
    })

    if (!existing) {
      throw new Error('Project not found')
    }

    if (existing.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    const project = await prisma.project.update({
      where: { id: data.projectId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.width && { width: data.width }),
        ...(data.height && { height: data.height }),
        ...(data.fps && { fps: data.fps }),
      },
    })

    return {
      id: project.id,
      name: project.name,
      width: project.width,
      height: project.height,
      fps: project.fps,
      status: project.status,
      updatedAt: project.updatedAt,
    }
  })

/**
 * Delete a project
 */
export const deleteProjectFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(projectIdSchema)
  .handler(async ({ data, context }) => {
    // Verify ownership
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { userId: true },
    })

    if (!project) {
      throw new Error('Project not found')
    }

    if (project.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    // Delete project (assets will be cascade deleted or orphaned based on schema)
    await prisma.project.delete({
      where: { id: data.projectId },
    })

    return { success: true }
  })

/**
 * Duplicate a project
 */
export const duplicateProjectFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(projectIdSchema)
  .handler(async ({ data, context }) => {
    // Get original project
    const original = await prisma.project.findUnique({
      where: { id: data.projectId },
    })

    if (!original) {
      throw new Error('Project not found')
    }

    if (original.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    // Create duplicate
    const duplicate = await prisma.project.create({
      data: {
        name: `${original.name} (Copy)`,
        userId: context.user.id,
        width: original.width,
        height: original.height,
        fps: original.fps,
        manifest: original.manifest,
        status: 'draft',
      },
    })

    return {
      id: duplicate.id,
      name: duplicate.name,
      createdAt: duplicate.createdAt,
    }
  })

// =============================================================================
// Manifest Operations
// =============================================================================

/**
 * Update project manifest (the timeline/composition data)
 */
export const updateManifestFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateManifestSchema)
  .handler(async ({ data, context }) => {
    // Verify ownership
    const existing = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { userId: true },
    })

    if (!existing) {
      throw new Error('Project not found')
    }

    if (existing.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    // Validate manifest JSON
    let manifest: ProjectManifest
    try {
      manifest = JSON.parse(data.manifest)
    } catch {
      throw new Error('Invalid manifest JSON')
    }

    // Calculate total duration from manifest
    let maxFrame = 0
    for (const clip of manifest.tracks.video) {
      const endFrame = clip.startFrame + clip.durationFrames
      if (endFrame > maxFrame) maxFrame = endFrame
    }
    for (const clip of manifest.tracks.audio) {
      const endFrame = clip.startFrame + clip.durationFrames
      if (endFrame > maxFrame) maxFrame = endFrame
    }
    for (const comp of manifest.tracks.components) {
      const endFrame = comp.startFrame + comp.durationFrames
      if (endFrame > maxFrame) maxFrame = endFrame
    }

    const project = await prisma.project.update({
      where: { id: data.projectId },
      data: {
        manifest: data.manifest,
        duration: maxFrame,
      },
    })

    return {
      id: project.id,
      duration: project.duration,
      updatedAt: project.updatedAt,
    }
  })

/**
 * Get just the manifest for a project (lighter endpoint for polling)
 */
export const getManifestFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(projectIdSchema)
  .handler(async ({ data, context }) => {
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: {
        userId: true,
        manifest: true,
        duration: true,
        updatedAt: true,
      },
    })

    if (!project) {
      throw new Error('Project not found')
    }

    if (project.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    return {
      manifest: JSON.parse(project.manifest) as ProjectManifest,
      duration: project.duration,
      updatedAt: project.updatedAt,
    }
  })
