'use client'

import { cn } from '@/lib/utils'
import { Type, Image, Globe } from 'lucide-react'
import type { Model3DMode } from '@/server/services/types'

interface Model3DModeToggleProps {
  mode: Model3DMode
  onModeChange: (mode: Model3DMode) => void
  className?: string
}

const modes = [
  {
    id: 'text-to-3d' as const,
    label: 'Text to 3D',
    icon: Type,
    description: 'Generate from text',
  },
  {
    id: 'image-to-3d' as const,
    label: 'Image to 3D',
    icon: Image,
    description: 'Convert images',
  },
  {
    id: 'image-to-world' as const,
    label: 'Image to World',
    icon: Globe,
    description: 'Create 3D worlds',
  },
]

export function Model3DModeToggle({
  mode,
  onModeChange,
  className,
}: Model3DModeToggleProps) {
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
