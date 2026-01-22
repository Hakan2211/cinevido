/**
 * 3D Models Components
 *
 * Components for 3D model generation using AI (Text-to-3D, Image-to-3D, Image-to-World)
 */

// Viewer
export {
  Model3DViewer,
  Model3DViewerCompact,
  preloadModel,
} from './Model3DViewer'

// Mode & Model Selection
export { Model3DModeToggle } from './Model3DModeToggle'
export { Model3DModelSelect } from './Model3DModelSelect'

// Generation Panels
export { TextTo3DPanel } from './TextTo3DPanel'
export { ImageTo3DPanel } from './ImageTo3DPanel'
export { ImageToWorldPanel } from './ImageToWorldPanel'

// Shared Components
export { MeshSettingsPanel } from './MeshSettingsPanel'
export { MultiImagePicker } from './MultiImagePicker'

// Gallery & Cards
export { Model3DCard } from './Model3DCard'
export { Model3DGallery } from './Model3DGallery'
export { Model3DDetailSheet } from './Model3DDetailSheet'

// Types re-export for convenience
export type { Model3DMode } from '@/server/services/types'
