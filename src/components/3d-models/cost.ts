/**
 * What a 3D run costs with the panel's current settings — the label form of
 * `model3DCost` in `@/lib/job-cost`, which the server also stores on the job.
 */

import { formatEstimate } from '@/lib/pricing'
import { model3DCost } from '@/lib/job-cost'
import type { Model3DConfig } from '@/server/services/types'
import type { MeshSettings } from './MeshSettingsPanel'

export function format3DCost(
  model: Model3DConfig | undefined,
  options: {
    mesh?: MeshSettings
    /** Meshy text-to-3D: 'preview' is untextured */
    meshyMode?: 'preview' | 'full'
    imageCount?: number
  } = {},
): string | null {
  return formatEstimate(
    model3DCost(model, {
      enablePbr: options.mesh?.enablePbr,
      faceCount: options.mesh?.faceCount,
      generateType: options.mesh?.generateType,
      meshyMode: options.meshyMode,
      imageCount: options.imageCount,
    }),
  )
}
