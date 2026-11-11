/**
 * What a 3D run costs with the panel's current settings. Hunyuan3D bills by
 * generate type plus +$0.15 each for PBR, a custom face count and multi-view
 * input; Meshy bills $0.80 untextured / $1.20 textured; the rest are flat.
 */

import { estimateCost, formatEstimate } from '@/lib/pricing'
import { HUNYUAN_DEFAULT_FACE_COUNT } from '@/server/services/types'
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
  if (!model) return null
  const isHunyuan = model.id.startsWith('hunyuan3d')
  const isMeshy = model.id.startsWith('meshy')
  const addOns: Array<string> = []
  if (isHunyuan) {
    if (options.mesh?.enablePbr) addOns.push('pbr')
    if (
      options.mesh?.faceCount &&
      options.mesh.faceCount !== HUNYUAN_DEFAULT_FACE_COUNT
    ) {
      addOns.push('faceCount')
    }
    if ((options.imageCount ?? 0) > 1) addOns.push('multiView')
  }
  const quality = isHunyuan
    ? (options.mesh?.generateType ?? 'Normal')
    : isMeshy
      ? options.meshyMode === 'preview'
        ? 'untextured'
        : 'textured'
      : undefined
  return formatEstimate(estimateCost(model.pricing, { quality, addOns }))
}
