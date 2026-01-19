/**
 * Remotion Types
 *
 * Shared types for the video composition system.
 */

// =============================================================================
// Composition Props
// =============================================================================

export interface CompositionProps {
  manifest?: ProjectManifest
}

export interface ProjectManifest {
  version: number
  tracks: {
    video: Array<VideoClipProps>
    audio: Array<AudioClipProps>
    components: Array<ComponentOverlayProps>
  }
  globalSettings: {
    backgroundColor: string
  }
}

export interface VideoClipProps {
  id: string
  assetId: string
  url: string
  startFrame: number
  durationFrames: number
  layer: number
  transition?: TransitionType
  effects?: Array<ClipEffectProps>
}

export interface AudioClipProps {
  id: string
  assetId: string
  url: string
  startFrame: number
  durationFrames: number
  volume: number
  wordTimestamps?: Array<WordTimestampProps>
}

export interface ComponentOverlayProps {
  id: string
  component: ComponentType

  props: Record<string, any>
  startFrame: number
  durationFrames: number
  layer: number
}

export interface WordTimestampProps {
  word: string
  start: number
  end: number
}

export interface ClipEffectProps {
  type: 'brightness' | 'contrast' | 'saturation' | 'blur' | 'grayscale'
  value: number
}

// =============================================================================
// Component Types
// =============================================================================

export type ComponentType =
  | 'KaraokeText'
  | 'BigTitle'
  | 'ImageOverlay'
  | 'LowerThird'

export type TransitionType =
  | 'cut'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'glitch'
  | 'zoom'

// =============================================================================
// Overlay Component Props
// =============================================================================

export interface KaraokeTextProps {
  text: string
  wordTimestamps: Array<WordTimestampProps>
  fontSize?: number
  fontFamily?: string
  color?: string
  highlightColor?: string
  backgroundColor?: string
  position?: 'top' | 'center' | 'bottom'
}

export interface BigTitleProps {
  text: string
  fontSize?: number
  fontFamily?: string
  color?: string
  animation?: 'fade' | 'slide-up' | 'scale' | 'typewriter'
  position?: 'top' | 'center' | 'bottom'
}

export interface ImageOverlayProps {
  src: string
  width?: number
  height?: number
  x?: number
  y?: number
  opacity?: number
}

export interface LowerThirdProps {
  title: string
  subtitle?: string
  backgroundColor?: string
  textColor?: string
  position?: 'left' | 'center' | 'right'
}

// =============================================================================
// Player State
// =============================================================================

export interface PlayerState {
  isPlaying: boolean
  currentFrame: number
  durationFrames: number
  fps: number
}

// =============================================================================
// Timeline Types
// =============================================================================

export interface TimelineTrack {
  id: string
  type: 'video' | 'audio' | 'component'
  name: string
  clips: Array<TimelineClip>
  muted?: boolean
  locked?: boolean
}

export interface TimelineClip {
  id: string
  trackId: string
  type: 'video' | 'audio' | 'component'
  startFrame: number
  durationFrames: number
  clipData: VideoClipProps | AudioClipProps | ComponentOverlayProps
}

export interface TimelineSelection {
  clipId: string | null
  trackId: string | null
}

// =============================================================================
// Helper to create empty manifest
// =============================================================================

export function createEmptyManifest(): ProjectManifest {
  return {
    version: 1,
    tracks: {
      video: [],
      audio: [],
      components: [],
    },
    globalSettings: {
      backgroundColor: '#000000',
    },
  }
}
