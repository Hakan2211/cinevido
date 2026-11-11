import type { Model3DMode } from '@/server/services/types'

/** The 3D lab's panel tabs (`?mode=`), passed through to each <LabPanel>. */
export const MODEL_3D_TABS: ReadonlyArray<{
  value: Model3DMode
  label: string
}> = [
  { value: 'text-to-3d', label: 'Text' },
  { value: 'image-to-3d', label: 'Image' },
  { value: 'image-to-world', label: 'World' },
]

export interface Model3DPanelTabs {
  tabs: typeof MODEL_3D_TABS
  tab: Model3DMode
  onTabChange: (mode: Model3DMode) => void
}
