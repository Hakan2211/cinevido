/**
 * Timeline Component
 *
 * Multi-track timeline with drag-and-drop clip reordering.
 */

import { useCallback, useMemo, useRef } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Film, GripVertical, Music, Type } from 'lucide-react'
import type { DragEndEvent } from '@dnd-kit/core'
import type {
  AudioClipProps,
  ComponentOverlayProps,
  ProjectManifest,
  VideoClipProps,
} from '../../remotion/types'

interface TimelineProps {
  manifest: ProjectManifest
  fps: number
  currentFrame: number
  selectedClipId: string | null
  onSeek: (frame: number) => void
  onSelectClip: (clipId: string | null) => void
  onManifestChange: (manifest: ProjectManifest) => void
}

export function Timeline({
  manifest,
  fps,
  currentFrame,
  selectedClipId,
  onSeek,
  onSelectClip,
  onManifestChange,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)

  // Calculate total duration
  const totalFrames = useMemo(() => {
    return Math.max(
      fps * 30, // Minimum 30 seconds visible
      ...manifest.tracks.video.map((c) => c.startFrame + c.durationFrames),
      ...manifest.tracks.audio.map((c) => c.startFrame + c.durationFrames),
      ...manifest.tracks.components.map((c) => c.startFrame + c.durationFrames),
    )
  }, [manifest, fps])

  // Pixels per frame
  const pixelsPerFrame = 2

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
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Timeline</span>
          <span className="text-xs text-muted-foreground">
            {Math.floor(currentFrame / fps)}s / {Math.floor(totalFrames / fps)}s
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs text-muted-foreground hover:text-foreground">
            Zoom -
          </button>
          <button className="text-xs text-muted-foreground hover:text-foreground">
            Zoom +
          </button>
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
  const markers: Array<JSX.Element> = []
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
