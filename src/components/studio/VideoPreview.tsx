/**
 * Video Preview Component
 *
 * Renders the Remotion player for video preview.
 */

import { useCallback, useRef } from 'react'
import { Player } from '@remotion/player'
import { Maximize, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { VideoComposition } from '../../remotion/Composition'
import { Button } from '../ui/button'
import type { PlayerRef } from '@remotion/player'
import type { ProjectManifest } from '../../remotion/types'

interface VideoPreviewProps {
  manifest: ProjectManifest
  width: number
  height: number
  fps: number
  currentFrame: number
  isPlaying: boolean
  onFrameChange: (frame: number) => void
  onPlayingChange: (playing: boolean) => void
}

export function VideoPreview({
  manifest,
  width,
  height,
  fps,
  currentFrame,
  isPlaying,
  onFrameChange,
  onPlayingChange,
}: VideoPreviewProps) {
  const playerRef = useRef<PlayerRef>(null)

  // Calculate duration from manifest
  const durationFrames = Math.max(
    1,
    manifest.tracks.video.reduce(
      (max, clip) => Math.max(max, clip.startFrame + clip.durationFrames),
      0,
    ),
    manifest.tracks.audio.reduce(
      (max, clip) => Math.max(max, clip.startFrame + clip.durationFrames),
      0,
    ),
    manifest.tracks.components.reduce(
      (max, comp) => Math.max(max, comp.startFrame + comp.durationFrames),
      0,
    ),
    fps * 5, // Minimum 5 seconds
  )

  const formatTime = (frames: number) => {
    const totalSeconds = Math.floor(frames / fps)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const remainingFrames = frames % fps
    return `${minutes}:${seconds.toString().padStart(2, '0')}:${remainingFrames.toString().padStart(2, '0')}`
  }

  const handleTogglePlay = useCallback(() => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pause()
      } else {
        playerRef.current.play()
      }
      onPlayingChange(!isPlaying)
    }
  }, [isPlaying, onPlayingChange])

  const handleSkipBack = useCallback(() => {
    const newFrame = Math.max(0, currentFrame - fps)
    onFrameChange(newFrame)
    playerRef.current?.seekTo(newFrame)
  }, [currentFrame, fps, onFrameChange])

  const handleSkipForward = useCallback(() => {
    const newFrame = Math.min(durationFrames - 1, currentFrame + fps)
    onFrameChange(newFrame)
    playerRef.current?.seekTo(newFrame)
  }, [currentFrame, durationFrames, fps, onFrameChange])

  const handleFullscreen = useCallback(() => {
    playerRef.current?.requestFullscreen()
  }, [])

  // Calculate aspect ratio for responsive sizing
  const aspectRatio = width / height
  const isVertical = height > width

  return (
    <div className="flex h-full flex-col">
      {/* Player Container */}
      <div className="flex-1 flex items-center justify-center bg-black/50 rounded-lg overflow-hidden">
        <div
          className={`relative ${isVertical ? 'h-full' : 'w-full'}`}
          style={{
            aspectRatio: `${width}/${height}`,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          <Player
            ref={playerRef}
            component={VideoComposition}
            inputProps={{ manifest }}
            durationInFrames={durationFrames}
            fps={fps}
            compositionWidth={width}
            compositionHeight={height}
            style={{
              width: '100%',
              height: '100%',
            }}
            controls={false}
            loop={false}
            clickToPlay={false}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-b-lg">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSkipBack}
            title="Skip back 1 second"
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleSkipForward}
            title="Skip forward 1 second"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-mono text-muted-foreground">
            {formatTime(currentFrame)} / {formatTime(durationFrames)}
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleFullscreen}
            title="Fullscreen"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
