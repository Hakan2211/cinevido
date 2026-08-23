/**
 * Remotion Module
 *
 * Exports for video composition and playback.
 */

// Main composition
export { VideoComposition } from './Composition'
export { RemotionRoot } from './Root'

// Types
export type {
  CompositionProps,
  ProjectManifest,
  ManifestTrack,
  ManifestClip,
  TrackKind,
  ClipKind,
  LegacyProjectManifest,
  VideoClipProps,
  AudioClipProps,
  ComponentOverlayProps,
  WordTimestampProps,
  ClipEffectProps,
  ComponentType,
  TransitionType,
  KaraokeTextProps,
  BigTitleProps,
  ImageOverlayProps,
  LowerThirdProps,
  PlayerState,
  TimelineSelection,
} from './types'

// Utilities
export {
  MANIFEST_VERSION,
  BASE_TRACKS,
  TRACK_CODE,
  createEmptyManifest,
  createTrack,
  migrateManifest,
  withBaseLanes,
  newId,
  trackEndFrame,
  sequenceEndFrame,
  clipCount,
  allClips,
  tracksOfKind,
  findClip,
  trackCode,
  trackKindForAsset,
  clipKindForAsset,
  clipHasAudio,
  mapTrack,
  addClip,
  appendClip,
  updateClip,
  removeClip,
  splitClipAt,
  formatTimecode,
  formatDuration,
} from './types'

// Overlay components
export { KaraokeText } from './components/overlays/KaraokeText'
export { BigTitle } from './components/overlays/BigTitle'
export { ImageOverlay } from './components/overlays/ImageOverlay'
export { LowerThird } from './components/overlays/LowerThird'
