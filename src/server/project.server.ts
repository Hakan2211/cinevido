/**
 * Project Server Functions
 *
 * CRUD operations for video projects and their manifests.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db.server'
import { authMiddleware } from './middleware.server'
import { createEmptyManifest } from './services/index.server'
import type { ProjectManifest } from './services/index.server'

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

// =============================================================================
// Folder CRUD Operations
// =============================================================================

const createFolderSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
})

const updateFolderSchema = z.object({
  folderId: z.string(),
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
})

const folderIdSchema = z.object({
  folderId: z.string(),
})

/**
 * Create a new folder
 */
export const createFolderFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createFolderSchema)
  .handler(async ({ data, context }) => {
    const folder = await prisma.projectFolder.create({
      data: {
        name: data.name,
        color: data.color || null,
        userId: context.user.id,
      },
    })

    return {
      id: folder.id,
      name: folder.name,
      color: folder.color,
      createdAt: folder.createdAt,
    }
  })

/**
 * List user's folders
 */
export const listFoldersFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const folders = await prisma.projectFolder.findMany({
      where: { userId: context.user.id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        _count: {
          select: { projects: true },
        },
      },
    })

    return folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      projectCount: f._count.projects,
      createdAt: f.createdAt,
    }))
  })

/**
 * Update a folder
 */
export const updateFolderFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateFolderSchema)
  .handler(async ({ data, context }) => {
    // Verify ownership
    const existing = await prisma.projectFolder.findUnique({
      where: { id: data.folderId },
      select: { userId: true },
    })

    if (!existing) {
      throw new Error('Folder not found')
    }

    if (existing.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    const folder = await prisma.projectFolder.update({
      where: { id: data.folderId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.color !== undefined && { color: data.color }),
      },
    })

    return {
      id: folder.id,
      name: folder.name,
      color: folder.color,
      updatedAt: folder.updatedAt,
    }
  })

/**
 * Delete a folder (projects are moved to no folder)
 */
export const deleteFolderFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(folderIdSchema)
  .handler(async ({ data, context }) => {
    // Verify ownership
    const folder = await prisma.projectFolder.findUnique({
      where: { id: data.folderId },
      select: { userId: true },
    })

    if (!folder) {
      throw new Error('Folder not found')
    }

    if (folder.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    // Projects will have folderId set to null due to onDelete: SetNull
    await prisma.projectFolder.delete({
      where: { id: data.folderId },
    })

    return { success: true }
  })

// =============================================================================
// Search, Filter, and Bulk Actions
// =============================================================================

const searchProjectsSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['draft', 'rendering', 'completed', 'failed']).optional(),
  folderId: z.string().nullable().optional(),
  sortBy: z.enum(['updatedAt', 'createdAt', 'name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
})

const moveProjectToFolderSchema = z.object({
  projectId: z.string(),
  folderId: z.string().nullable(),
})

const bulkDeleteSchema = z.object({
  projectIds: z.array(z.string()).min(1).max(100),
})

const bulkMoveSchema = z.object({
  projectIds: z.array(z.string()).min(1).max(100),
  folderId: z.string().nullable(),
})

/**
 * Search and filter projects with sorting
 */
export const searchProjectsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(searchProjectsSchema)
  .handler(async ({ data, context }) => {
    const sortBy = data.sortBy || 'updatedAt'
    const sortOrder = data.sortOrder || 'desc'

    // Build where clause
    const where: {
      userId: string
      status?: string
      folderId?: string | null
      name?: { contains: string }
    } = {
      userId: context.user.id,
    }

    if (data.status) {
      where.status = data.status
    }

    // Handle folder filter - null means "no folder", undefined means "all"
    if (data.folderId !== undefined) {
      where.folderId = data.folderId
    }

    if (data.query && data.query.trim()) {
      where.name = { contains: data.query.trim() }
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
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
        folderId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { assets: true },
        },
      },
    })

    const total = await prisma.project.count({ where })

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
        folderId: p.folderId,
        assetCount: p._count.assets,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      total,
    }
  })

/**
 * Move a single project to a folder
 */
export const moveProjectToFolderFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(moveProjectToFolderSchema)
  .handler(async ({ data, context }) => {
    // Verify project ownership
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

    // If moving to a folder, verify folder ownership
    if (data.folderId) {
      const folder = await prisma.projectFolder.findUnique({
        where: { id: data.folderId },
        select: { userId: true },
      })

      if (!folder) {
        throw new Error('Folder not found')
      }

      if (folder.userId !== context.user.id) {
        throw new Error('Unauthorized')
      }
    }

    await prisma.project.update({
      where: { id: data.projectId },
      data: { folderId: data.folderId },
    })

    return { success: true }
  })

/**
 * Delete multiple projects at once
 */
export const bulkDeleteProjectsFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(bulkDeleteSchema)
  .handler(async ({ data, context }) => {
    // Verify ownership of all projects
    const projects = await prisma.project.findMany({
      where: {
        id: { in: data.projectIds },
      },
      select: { id: true, userId: true },
    })

    // Check all projects exist and belong to user
    const ownedProjectIds = projects
      .filter((p) => p.userId === context.user.id)
      .map((p) => p.id)

    if (ownedProjectIds.length === 0) {
      throw new Error('No authorized projects to delete')
    }

    await prisma.project.deleteMany({
      where: {
        id: { in: ownedProjectIds },
      },
    })

    return {
      success: true,
      deletedCount: ownedProjectIds.length,
    }
  })

/**
 * Move multiple projects to a folder at once
 */
export const bulkMoveProjectsFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(bulkMoveSchema)
  .handler(async ({ data, context }) => {
    // If moving to a folder, verify folder ownership
    if (data.folderId) {
      const folder = await prisma.projectFolder.findUnique({
        where: { id: data.folderId },
        select: { userId: true },
      })

      if (!folder) {
        throw new Error('Folder not found')
      }

      if (folder.userId !== context.user.id) {
        throw new Error('Unauthorized')
      }
    }

    // Verify ownership of all projects and update
    const projects = await prisma.project.findMany({
      where: {
        id: { in: data.projectIds },
      },
      select: { id: true, userId: true },
    })

    const ownedProjectIds = projects
      .filter((p) => p.userId === context.user.id)
      .map((p) => p.id)

    if (ownedProjectIds.length === 0) {
      throw new Error('No authorized projects to move')
    }

    await prisma.project.updateMany({
      where: {
        id: { in: ownedProjectIds },
      },
      data: { folderId: data.folderId },
    })

    return {
      success: true,
      movedCount: ownedProjectIds.length,
    }
  })
