/**
 * AspectCards — the aspect-ratio picker: one card per ratio with a shape icon.
 */

import {
  RectangleHorizontal,
  RectangleVertical,
  Settings2,
  Square,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

function iconFor(ratio: string): LucideIcon {
  if (ratio === 'custom') return Settings2
  const [w, h] = ratio.split(':').map(Number)
  if (!w || !h || w === h) return Square
  return w > h ? RectangleHorizontal : RectangleVertical
}

export function AspectCards({
  ratios,
  value,
  onChange,
  columns = 3,
  labels,
}: {
  ratios: ReadonlyArray<string>
  value: string
  onChange: (ratio: string) => void
  columns?: 3 | 4 | 5 | 6
  /** Display text overrides, e.g. { custom: 'Custom' } */
  labels?: Record<string, string>
}) {
  const cols = {
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }[columns]
  return (
    <div className={cn('grid gap-2', cols)}>
      {ratios.map((ratio) => {
        const Icon = iconFor(ratio)
        const selected = value === ratio
        return (
          <button
            type="button"
            key={ratio}
            onClick={() => onChange(ratio)}
            aria-pressed={selected}
            className={cn(
              'flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium tabular-nums transition-colors',
              selected
                ? 'border-primary/60 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {labels?.[ratio] ?? ratio}
          </button>
        )
      })}
    </div>
  )
}
