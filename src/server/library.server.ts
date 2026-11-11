/**
 * Library — everything the user has made or uploaded, newest first.
 *
 * Assets (image / video / audio / music / sfx) and finished 3D models are
 * merged into one list and paged by `createdAt` (cursor = the last item's
 * timestamp), so "All" can page through both tables at once.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db.server'
import { authMiddleware } from './middleware.server'
import {
  AUDIO_MODELS,
  EDIT_MODELS,
  IMAGE_MODELS,
  IMAGE_TO_3D_MODELS,
  IMAGE_TO_WORLD_MODELS,
  MOTION_CONTROL_MODELS,
  MUSIC_MODELS,
  SFX_MODELS,
  TEXT_TO_3D_MODELS,
  UPSCALE_MODELS,
  VIDEO_MODELS,
  VIDEO_UPSCALE_MODELS,
} from './services/types'

export const LIBRARY_KINDS = ['all', 'image', 'video', 'audio', '3d'] as const
export type LibraryKind = (typeof LIBRARY_KINDS)[number]

export interface LibraryItem {
  id: string
  kind: Exclude<LibraryKind, 'all'>
  /** the asset's own type: image | video | audio | music | sfx | 3d */
  type: string
  url: string
  /** a still for 3D models; images use `url` */
  thumbnailUrl: string | null
  prompt: string | null
  modelId: string | null
  modelName: string | null
  /** "upload" for user uploads */
  provider: string | null
  durationSec: number | null
  width: number | null
  height: number | null
  projectId: string | null
  createdAt: string
}

const AUDIO_TYPES = ['audio', 'music', 'sfx']

/** A finished 3D model with something to open */
const HAS_3D_FILE = {
  status: 'completed',
  OR: [
    { modelGlbUrl: { not: null } },
    { worldFileUrl: { not: null } },
    { gaussianSplatUrl: { not: null } },
  ],
}

const MODEL_NAMES = new Map<string, string>(
  [
    ...IMAGE_MODELS,
    ...EDIT_MODELS,
    ...UPSCALE_MODELS,
    ...VIDEO_MODELS,
    ...VIDEO_UPSCALE_MODELS,
    ...AUDIO_MODELS,
    ...SFX_MODELS,
    ...MUSIC_MODELS,
    ...TEXT_TO_3D_MODELS,
    ...IMAGE_TO_3D_MODELS,
    ...IMAGE_TO_WORLD_MODELS,
    ...MOTION_CONTROL_MODELS,
  ].map((m) => [m.id, m.name]),
)

function parseMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

const input = z.object({
  kind: z.enum(LIBRARY_KINDS).default('all'),
  cursor: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(60).default(30),
})

export const listLibraryFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: z.input<typeof input>) => input.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.user.id
    const before = data.cursor ? { lt: new Date(data.cursor) } : undefined
    const wantAssets = data.kind !== '3d'
    const want3d = data.kind === 'all' || data.kind === '3d'
    const assetTypes =
      data.kind === 'all'
        ? ['image', 'video', ...AUDIO_TYPES]
        : data.kind === 'audio'
          ? AUDIO_TYPES
          : [data.kind]

    const [assets, models3d] = await Promise.all([
      wantAssets
        ? prisma.asset.findMany({
            where: {
              userId,
              type: { in: assetTypes },
              ...(before && { createdAt: before }),
            },
            orderBy: { createdAt: 'desc' },
            take: data.limit + 1,
          })
        : [],
      want3d
        ? prisma.model3DAsset.findMany({
            where: {
              userId,
              ...HAS_3D_FILE,
              ...(before && { createdAt: before }),
            },
            orderBy: { createdAt: 'desc' },
            take: data.limit + 1,
          })
        : [],
    ])

    const items: Array<LibraryItem> = [
      ...assets.map((a): LibraryItem => {
        const meta = parseMeta(a.metadata)
        return {
          id: a.id,
          kind: AUDIO_TYPES.includes(a.type)
            ? 'audio'
            : (a.type as 'image' | 'video'),
          type: a.type,
          url: a.storageUrl,
          thumbnailUrl: null,
          prompt: a.prompt,
          modelId: a.model,
          modelName: a.model ? (MODEL_NAMES.get(a.model) ?? null) : null,
          provider: a.provider,
          durationSec: a.durationSeconds ?? num(meta.duration),
          width: num(meta.width),
          height: num(meta.height),
          projectId: a.projectId,
          createdAt: a.createdAt.toISOString(),
        }
      }),
      ...models3d.map(
        (m): LibraryItem => ({
          id: m.id,
          kind: '3d',
          type: '3d',
          url: (m.modelGlbUrl ?? m.worldFileUrl ?? m.gaussianSplatUrl)!,
          thumbnailUrl: m.thumbnailUrl,
          prompt: m.prompt,
          modelId: m.modelId,
          modelName: MODEL_NAMES.get(m.modelId) ?? null,
          provider: 'fal',
          durationSec: null,
          width: null,
          height: null,
          projectId: null,
          createdAt: m.createdAt.toISOString(),
        }),
      ),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    const page = items.slice(0, data.limit)
    const hasMore =
      items.length > data.limit ||
      assets.length > data.limit ||
      models3d.length > data.limit
    return {
      items: page,
      nextCursor:
        hasMore && page.length > 0 ? page[page.length - 1].createdAt : null,
    }
  })

export const getLibraryCountsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id
    const [byType, models3d] = await Promise.all([
      prisma.asset.groupBy({
        by: ['type'],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.model3DAsset.count({ where: { userId, ...HAS_3D_FILE } }),
    ])
    const count = (types: Array<string>) =>
      byType
        .filter((t) => types.includes(t.type))
        .reduce((s, t) => s + t._count._all, 0)
    const image = count(['image'])
    const video = count(['video'])
    const audio = count(AUDIO_TYPES)
    return {
      all: image + video + audio + models3d,
      image,
      video,
      audio,
      '3d': models3d,
    } satisfies Record<LibraryKind, number>
  })
