/**
 * VideoModeToggle - Premium tab-style mode selector for video generation
 *
 * Modes:
 * - text-to-video: Generate videos from text prompts
 * - image-to-video: Animate an image (first frame)
 * - keyframes: Create transitions between first and last frame
 * - upscale: Enhance video resolution with AI
 */

import { ArrowUpCircle, Film, Image, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VideoMode =
  | 'text-to-video'
  | 'image-to-video'
  | 'keyframes'
  | 'upscale'

interface VideoModeToggleProps {
  mode: VideoMode
  onModeChange: (mode: VideoMode) => void
  className?: string
}

const modes: Array<{
  id: VideoMode
  label: string
  icon: React.ElementType
  description: string
}> = [
  {
    id: 'text-to-video',
    label: 'Text to Video',
    icon: Film,
    description: 'Generate from text prompt',
  },
  {
    id: 'image-to-video',
    label: 'Image to Video',
    icon: Image,
    description: 'Animate a starting image',
  },
  {
    id: 'keyframes',
    label: 'Keyframes',
    icon: Layers,
    description: 'Transition between images',
  },
  {
    id: 'upscale',
    label: 'Upscale',
    icon: ArrowUpCircle,
    description: 'Enhance video resolution',
  },
]

export function VideoModeToggle({
  mode,
  onModeChange,
  className,
}: VideoModeToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-2xl border border-border/50 bg-card/50 p-1.5',
        'shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      {modes.map((m) => {
        const Icon = m.icon
        const isActive = mode === m.id

        return (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={cn(
              'relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium',
              'transition-all duration-200 ease-out',
              isActive
                ? 'bg-primary text-primary-foreground active-glow'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
            title={m.description}
          >
            <Icon className={cn('h-4 w-4', isActive && 'drop-shadow-sm')} />
            <span className="hidden sm:inline">{m.label}</span>
            {isActive && (
              <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 transition-opacity hover:opacity-100" />
            )}
          </button>
        )
      })}
    </div>
  )
}

export { modes as VIDEO_MODES }
