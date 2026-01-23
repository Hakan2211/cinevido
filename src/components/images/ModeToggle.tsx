/**
 * ModeToggle - Premium tab-style mode selector for image operations
 *
 * Modes:
 * - generate: Create new images from text prompts
 * - edit: Inpaint/outpaint existing images
 * - upscale: Enhance image resolution
 */

import { ArrowUpCircle, Baby, Paintbrush, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ImageMode = 'generate' | 'edit' | 'upscale' | 'aging'

interface ModeToggleProps {
  mode: ImageMode
  onModeChange: (mode: ImageMode) => void
  className?: string
}

const modes: Array<{
  id: ImageMode
  label: string
  icon: React.ElementType
  description: string
}> = [
  {
    id: 'generate',
    label: 'Generate',
    icon: Sparkles,
    description: 'Create new images from text',
  },
  {
    id: 'edit',
    label: 'Edit',
    icon: Paintbrush,
    description: 'Inpaint & outpaint',
  },
  {
    id: 'upscale',
    label: 'Upscale',
    icon: ArrowUpCircle,
    description: 'Enhance resolution',
  },
  {
    id: 'aging',
    label: 'Aging',
    icon: Baby,
    description: 'Age & baby prediction',
  },
]

export function ModeToggle({ mode, onModeChange, className }: ModeToggleProps) {
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

export { modes as IMAGE_MODES }
