/**
 * ModeToggle - Tab-style mode selector for image operations
 *
 * Modes:
 * - generate: Create new images from text prompts
 * - edit: Inpaint/outpaint existing images
 * - upscale: Enhance image resolution
 * - variations: Create variations of an image
 */

import { cn } from '@/lib/utils'
import { Sparkles, Paintbrush, ArrowUpCircle, Copy } from 'lucide-react'

export type ImageMode = 'generate' | 'edit' | 'upscale' | 'variations'

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
    id: 'variations',
    label: 'Variations',
    icon: Copy,
    description: 'Create image variations',
  },
]

export function ModeToggle({ mode, onModeChange, className }: ModeToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border bg-muted p-1',
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
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title={m.description}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export { modes as IMAGE_MODES }
