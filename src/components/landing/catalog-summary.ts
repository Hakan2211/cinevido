/**
 * The landing page's view of the model catalog — read from
 * src/server/services/types.ts so the page never lists a retired model or a
 * stale price. Models that share a name across modes (Kling 4 text- and
 * image-to-video) appear once.
 */

import {
  AUDIO_MODELS,
  EDIT_MODELS,
  IMAGE_MODELS,
  IMAGE_TO_3D_MODELS,
  IMAGE_TO_WORLD_MODELS,
  MUSIC_MODELS,
  SFX_MODELS,
  TEXT_TO_3D_MODELS,
  UPSCALE_MODELS,
  VIDEO_MODELS,
  VIDEO_UPSCALE_MODELS,
} from '@/server/services/types'
import type { ModelConfig } from '@/server/services/types'

export interface CatalogGroup {
  title: string
  models: Array<ModelConfig>
}

function unique(models: ReadonlyArray<ModelConfig>): Array<ModelConfig> {
  const seen = new Set<string>()
  return models.filter((m) => !seen.has(m.name) && seen.add(m.name))
}

const TIER_RANK = { draft: 0, standard: 1, hero: 2 } as const
function byTier(models: Array<ModelConfig>): Array<ModelConfig> {
  return models.sort(
    (a, b) =>
      (a.tier ? TIER_RANK[a.tier] : 3) - (b.tier ? TIER_RANK[b.tier] : 3),
  )
}

export const CATALOG_GROUPS: Array<CatalogGroup> = [
  { title: 'Video', models: byTier(unique(VIDEO_MODELS)) },
  { title: 'Image', models: byTier(unique([...IMAGE_MODELS, ...EDIT_MODELS])) },
  {
    title: 'Voice, music & sound',
    models: unique([...AUDIO_MODELS, ...MUSIC_MODELS, ...SFX_MODELS]),
  },
  {
    title: '3D',
    models: unique([
      ...TEXT_TO_3D_MODELS,
      ...IMAGE_TO_3D_MODELS,
      ...IMAGE_TO_WORLD_MODELS,
    ]),
  },
  {
    title: 'Upscale',
    models: unique([...UPSCALE_MODELS, ...VIDEO_UPSCALE_MODELS]),
  },
]

export const CATALOG_MODEL_COUNT = CATALOG_GROUPS.reduce(
  (n, g) => n + g.models.length,
  0,
)
