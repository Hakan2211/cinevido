/**
 * Timeline Component
 *
 * Multi-track timeline with drag-and-drop clip reordering.
 * Features: Zoom controls, keyboard shortcuts, snap-to-grid.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Film,
  GripVertical,
  Magnet,
  Minus,
  Music,
  Plus,
  Type,
} from 'lucide-react'
import type { DragEndEvent } from '@dnd-kit/core'
import type {
  AudioClipProps,
  ComponentOverlayProps,
  ProjectManifest,
  VideoClipProps,
} from '../../remotion/types'
import { Button } from '../ui/button'
import { Slider } from '../ui/slider'

interface TimelineProps {
  manifest: ProjectManifest
  fps: number
  currentFrame: number
  selectedClipId: string | null
  onSeek: (frame: number) => void
  onSelectClip: (clipId: string | null) => void
  onManifestChange: (manifest: ProjectManifest) => void
  /** Optional: Called when play/pause is toggled via keyboard */
  onTogglePlay?: () => void
  /** Optional: Is the video currently playing */
  isPlaying?: boolean
}

// Zoom levels: pixels per frame
const MIN_ZOOM = 0.5
const MAX_ZOOM = 8
const DEFAULT_ZOOM = 2

export function Timeline({
  manifest,
  fps,
  currentFrame,
  selectedClipId,
  onSeek,
  onSelectClip,
  onManifestChange: _onManifestChange,
  onTogglePlay,
  isPlaying,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)

  // Zoom state
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM)
  const [snapEnabled, setSnapEnabled] = useState(true)

  // Calculate total duration
  const totalFrames = useMemo(() => {
    return Math.max(
      fps * 30, // Minimum 30 seconds visible
      ...manifest.tracks.video.map((c) => c.startFrame + c.durationFrames),
      ...manifest.tracks.audio.map((c) => c.startFrame + c.durationFrames),
      ...manifest.tracks.components.map((c) => c.startFrame + c.durationFrames),
    )
  }, [manifest, fps])

  // Pixels per frame (based on zoom level)
  const pixelsPerFrame = zoomLevel

  // Zoom handlers
  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev * 1.5, MAX_ZOOM))
  }, [])

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev / 1.5, MIN_ZOOM))
  }, [])

  const handleZoomChange = useCallback((value: number[]) => {
    setZoomLevel(value[0])
  }, [])

  const fitToView = useCallback(() => {
    if (!timelineRef.current) return
    const containerWidth = timelineRef.current.clientWidth - 96 // Subtract track label width
    const newZoom = containerWidth / totalFrames
    setZoomLevel(Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM)))
  }, [totalFrames])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          onTogglePlay?.()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.shiftKey) {
            // Jump 1 second back
            onSeek(Math.max(0, currentFrame - fps))
          } else {
            // Step 1 frame back
            onSeek(Math.max(0, currentFrame - 1))
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.shiftKey) {
            // Jump 1 second forward
            onSeek(Math.min(totalFrames - 1, currentFrame + fps))
          } else {
            // Step 1 frame forward
            onSeek(Math.min(totalFrames - 1, currentFrame + 1))
          }
          break
        case 'Home':
          e.preventDefault()
          onSeek(0)
          break
        case 'End':
          e.preventDefault()
          onSeek(totalFrames - 1)
          break
        case 'KeyJ':
          // Rewind (like professional video editors)
          e.preventDefault()
          onSeek(Math.max(0, currentFrame - fps * 2))
          break
        case 'KeyK':
          // Pause
          e.preventDefault()
          onTogglePlay?.()
          break
        case 'KeyL':
          // Fast forward
          e.preventDefault()
          onSeek(Math.min(totalFrames - 1, currentFrame + fps * 2))
          break
        case 'Equal':
        case 'NumpadAdd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomIn()
          }
          break
        case 'Minus':
        case 'NumpadSubtract':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomOut()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentFrame, fps, totalFrames, onSeek, onTogglePlay, zoomIn, zoomOut])

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return

      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + timelineRef.current.scrollLeft
      const frame = Math.floor(x / pixelsPerFrame)
      onSeek(Math.max(0, Math.min(frame, totalFrames - 1)))
      onSelectClip(null)
    },
    [onSeek, onSelectClip, totalFrames, pixelsPerFrame],
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // TODO: Implement clip reordering
    console.log('Drag end:', active.id, 'over', over.id)
  }, [])

  const playheadPosition = currentFrame * pixelsPerFrame

  return (
    <div className="flex h-full flex-col">
      {/* Timeline Header */}
      <div className="flex items-center justify-between border-b px-2 py-1.5 md:px-4 md:py-2">
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-xs font-medium md:text-sm">Timeline</span>
          <span className="text-[10px] text-muted-foreground md:text-xs">
            {Math.floor(currentFrame / fps)}s / {Math.floor(totalFrames / fps)}s
          </span>
          {/* Playing indicator */}
          {isPlaying && (
            <span className="hidden text-[10px] text-primary md:inline">
              Playing
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          {/* Snap toggle */}
          <Button
            variant={snapEnabled ? 'secondary' : 'ghost'}
            size="icon"
            className="h-6 w-6 md:h-7 md:w-7"
            onClick={() => setSnapEnabled(!snapEnabled)}
            title={`Snap to grid: ${snapEnabled ? 'On' : 'Off'}`}
          >
            <Magnet className="h-3 w-3 md:h-3.5 md:w-3.5" />
          </Button>

          {/* Zoom controls */}
          <div className="hidden items-center gap-1 md:flex">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={zoomOut}
              disabled={zoomLevel <= MIN_ZOOM}
              title="Zoom out (Ctrl+-)"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Slider
              value={[zoomLevel]}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.1}
              onValueChange={handleZoomChange}
              className="w-20"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={zoomIn}
              disabled={zoomLevel >= MAX_ZOOM}
              title="Zoom in (Ctrl++)"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Mobile zoom buttons */}
          <div className="flex items-center gap-0.5 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={zoomOut}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={zoomIn}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Fit to view */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden h-7 text-xs md:flex"
            onClick={fitToView}
            title="Fit timeline to view"
          >
            Fit
          </Button>
        </div>
      </div>

      {/* Tracks Container */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-x-auto overflow-y-hidden"
        onClick={handleTimelineClick}
      >
        <div
          className="relative min-h-full"
          style={{ width: totalFrames * pixelsPerFrame }}
        >
          {/* Time ruler */}
          <div className="sticky top-0 h-6 border-b bg-muted/50">
            <TimeRuler
              totalFrames={totalFrames}
              fps={fps}
              pixelsPerFrame={pixelsPerFrame}
            />
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
            style={{ left: playheadPosition }}
          >
            <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-primary rotate-45" />
          </div>

          {/* Video Track */}
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Track
              name="Video"
              icon={<Film className="h-3 w-3" />}
              clips={manifest.tracks.video}
              type="video"
              pixelsPerFrame={pixelsPerFrame}
              selectedClipId={selectedClipId}
              onSelectClip={onSelectClip}
            />

            {/* Audio Track */}
            <Track
              name="Audio"
              icon={<Music className="h-3 w-3" />}
              clips={manifest.tracks.audio}
              type="audio"
              pixelsPerFrame={pixelsPerFrame}
              selectedClipId={selectedClipId}
              onSelectClip={onSelectClip}
            />

            {/* Components Track */}
            <Track
              name="Overlays"
              icon={<Type className="h-3 w-3" />}
              clips={manifest.tracks.components}
              type="component"
              pixelsPerFrame={pixelsPerFrame}
              selectedClipId={selectedClipId}
              onSelectClip={onSelectClip}
            />
          </DndContext>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Sub-components
// =============================================================================

interface TimeRulerProps {
  totalFrames: number
  fps: number
  pixelsPerFrame: number
}

function TimeRuler({ totalFrames, fps, pixelsPerFrame }: TimeRulerProps) {
  const markers: React.ReactNode[] = []
  const secondWidth = fps * pixelsPerFrame

  for (let second = 0; second <= totalFrames / fps; second++) {
    const x = second * secondWidth
    markers.push(
      <div
        key={second}
        className="absolute top-0 bottom-0 flex flex-col items-start"
        style={{ left: x }}
      >
        <div className="h-2 w-px bg-border" />
        <span className="text-[10px] text-muted-foreground ml-1">
          {second}s
        </span>
      </div>,
    )
  }

  return <div className="relative h-full">{markers}</div>
}

interface TrackProps {
  name: string
  icon: React.ReactNode
  clips: Array<VideoClipProps | AudioClipProps | ComponentOverlayProps>
  type: 'video' | 'audio' | 'component'
  pixelsPerFrame: number
  selectedClipId: string | null
  onSelectClip: (clipId: string | null) => void
}

function Track({
  name,
  icon,
  clips,
  type,
  pixelsPerFrame,
  selectedClipId,
  onSelectClip,
}: TrackProps) {
  const clipIds = clips.map((c) => c.id)

  return (
    <div className="flex h-12 border-b">
      {/* Track label */}
      <div className="sticky left-0 z-10 flex w-24 shrink-0 items-center gap-2 border-r bg-muted/50 px-2">
        {icon}
        <span className="text-xs font-medium">{name}</span>
      </div>

      {/* Clips */}
      <div className="relative flex-1">
        <SortableContext
          items={clipIds}
          strategy={horizontalListSortingStrategy}
        >
          {clips.map((clip) => (
            <TimelineClip
              key={clip.id}
              clip={clip}
              type={type}
              pixelsPerFrame={pixelsPerFrame}
              isSelected={selectedClipId === clip.id}
              onSelect={() => onSelectClip(clip.id)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}

interface TimelineClipProps {
  clip: VideoClipProps | AudioClipProps | ComponentOverlayProps
  type: 'video' | 'audio' | 'component'
  pixelsPerFrame: number
  isSelected: boolean
  onSelect: () => void
}

function TimelineClip({
  clip,
  type,
  pixelsPerFrame,
  isSelected,
  onSelect,
}: TimelineClipProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: clip.id,
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    left: clip.startFrame * pixelsPerFrame,
    width: clip.durationFrames * pixelsPerFrame,
  }

  const colorClass =
    type === 'video'
      ? 'bg-blue-500/80 hover:bg-blue-500'
      : type === 'audio'
        ? 'bg-green-500/80 hover:bg-green-500'
        : 'bg-purple-500/80 hover:bg-purple-500'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute top-1 bottom-1 flex items-center gap-1 rounded px-2 text-white text-xs cursor-pointer ${colorClass} ${
        isSelected ? 'ring-2 ring-white ring-offset-1' : ''
      }`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3 w-3 opacity-50" />
      <span className="truncate">
        {type === 'component'
          ? (clip as ComponentOverlayProps).component
          : clip.id.slice(0, 8)}
      </span>
    </div>
  )
}
