/**
 * Main Video Composition
 *
 * Renders a manifest v2 sequence: tracks in array order (later lanes
 * composite on top), each clip as a Remotion Sequence that plays its own
 * slice of the source (`sourceInFrame`), fades in over its crossfade
 * (`transitionFrames`) and carries clip gain × track gain into the mix.
 */

import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Video,
  interpolate,
  useCurrentFrame,
} from 'remotion'
import { KaraokeText } from './components/overlays/KaraokeText'
import { BigTitle } from './components/overlays/BigTitle'
import { ImageOverlay } from './components/overlays/ImageOverlay'
import { LowerThird } from './components/overlays/LowerThird'
import { createEmptyManifest } from './types'
import type {
  BigTitleProps,
  CompositionProps,
  ImageOverlayProps,
  KaraokeTextProps,
  LowerThirdProps,
  ManifestClip,
  ManifestTrack,
  TransitionType,
} from './types'

// =============================================================================
// Main Composition
// =============================================================================

export const VideoComposition: React.FC<CompositionProps> = ({ manifest }) => {
  const safeManifest = manifest ?? createEmptyManifest()

  return (
    <AbsoluteFill
      style={{ backgroundColor: safeManifest.globalSettings.backgroundColor }}
    >
      {safeManifest.tracks.map((track) =>
        track.clips.map((clip) => (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={clip.durationFrames}
          >
            <ClipRenderer clip={clip} track={track} />
          </Sequence>
        )),
      )}
    </AbsoluteFill>
  )
}

// =============================================================================
// Clip Renderer
// =============================================================================

const ClipRenderer: React.FC<{ clip: ManifestClip; track: ManifestTrack }> = ({
  clip,
  track,
}) => {
  switch (clip.kind) {
    case 'component':
      return <ComponentClip clip={clip} />
    case 'audio':
      return track.muted ? null : <AudioClip clip={clip} track={track} />
    case 'image':
    case 'video':
    default:
      return <VisualClip clip={clip} track={track} />
  }
}

// =============================================================================
// Video / Image clips
// =============================================================================

const VisualClip: React.FC<{ clip: ManifestClip; track: ManifestTrack }> = ({
  clip,
  track,
}) => {
  const frame = useCurrentFrame()

  // Apply colour effects
  let filterStyle = ''
  for (const effect of clip.effects ?? []) {
    switch (effect.type) {
      case 'brightness':
        filterStyle += `brightness(${effect.value}) `
        break
      case 'contrast':
        filterStyle += `contrast(${effect.value}) `
        break
      case 'saturation':
        filterStyle += `saturate(${effect.value}) `
        break
      case 'blur':
        filterStyle += `blur(${effect.value}px) `
        break
      case 'grayscale':
        filterStyle += `grayscale(${effect.value}) `
        break
    }
  }

  // Crossfade INTO this clip, then the legacy outgoing transition
  const fadeIn = fadeInOpacity(frame, clip.transitionFrames)
  const outgoing = calculateTransition(
    clip.transition ?? 'cut',
    frame,
    clip.durationFrames - OUTGOING_TRANSITION_FRAMES,
    clip.durationFrames,
  )
  const opacity = Number(outgoing.opacity ?? 1) * fadeIn

  if (!clip.url) return null

  const media =
    clip.kind === 'image' ? (
      <Img
        src={clip.url}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    ) : (
      <Video
        src={clip.url}
        startFrom={clip.sourceInFrame}
        volume={track.muted ? 0 : clip.gain * track.gain}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )

  return (
    <AbsoluteFill
      style={{ ...outgoing, opacity, filter: filterStyle || undefined }}
    >
      {media}
    </AbsoluteFill>
  )
}

// =============================================================================
// Audio clips
// =============================================================================

const AudioClip: React.FC<{ clip: ManifestClip; track: ManifestTrack }> = ({
  clip,
  track,
}) => {
  if (!clip.url) return null
  const level = clip.gain * track.gain
  return (
    <Audio
      src={clip.url}
      startFrom={clip.sourceInFrame}
      volume={(frame) => level * fadeInOpacity(frame, clip.transitionFrames)}
    />
  )
}

// =============================================================================
// Transitions
// =============================================================================

/** frames the legacy per-clip outgoing transition runs for */
const OUTGOING_TRANSITION_FRAMES = 15

/** the crossfade a clip fades in with, 0..1 */
function fadeInOpacity(frame: number, transitionFrames: number): number {
  if (transitionFrames <= 0) return 1
  return interpolate(frame, [0, transitionFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

function calculateTransition(
  transition: TransitionType,
  frame: number,
  transitionStart: number,
  totalFrames: number,
): React.CSSProperties {
  if (transition === 'cut' || frame < transitionStart) {
    return { opacity: 1 }
  }

  const progress = interpolate(frame, [transitionStart, totalFrames], [0, 1], {
    extrapolateRight: 'clamp',
  })

  switch (transition) {
    case 'fade':
      return {
        opacity: interpolate(progress, [0, 1], [1, 0]),
      }

    case 'slide-left':
      return {
        transform: `translateX(${interpolate(progress, [0, 1], [0, -100])}%)`,
      }

    case 'slide-right':
      return {
        transform: `translateX(${interpolate(progress, [0, 1], [0, 100])}%)`,
      }

    case 'zoom':
      return {
        transform: `scale(${interpolate(progress, [0, 1], [1, 1.5])})`,
        opacity: interpolate(progress, [0, 1], [1, 0]),
      }

    case 'glitch': {
      // Simple glitch effect using random offsets
      const glitchOffset = Math.sin(frame * 10) * 5
      return {
        transform: `translateX(${glitchOffset}px)`,
        filter: progress > 0.5 ? 'hue-rotate(90deg)' : undefined,
      }
    }

    default:
      return { opacity: 1 }
  }
}

// =============================================================================
// Component overlays
// =============================================================================

const ComponentClip: React.FC<{ clip: ManifestClip }> = ({ clip }) => {
  const props = clip.props ?? {}

  switch (clip.component) {
    case 'KaraokeText':
      return <KaraokeText {...(props as unknown as KaraokeTextProps)} />

    case 'BigTitle':
      return <BigTitle {...(props as unknown as BigTitleProps)} />

    case 'ImageOverlay':
      return <ImageOverlay {...(props as unknown as ImageOverlayProps)} />

    case 'LowerThird':
      return <LowerThird {...(props as unknown as LowerThirdProps)} />

    default:
      console.warn(`Unknown component type: ${String(clip.component)}`)
      return null
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default VideoComposition
