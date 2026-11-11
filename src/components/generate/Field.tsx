/**
 * Small layout pieces shared by the Generate labs' settings panels.
 */

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A labelled settings group: "Model", "Aspect ratio (optional)" … */
export function Field({
  label,
  hint,
  aside,
  children,
}: {
  label: string
  hint?: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {label}
          {hint && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({hint})
            </span>
          )}
        </p>
        {aside}
      </div>
      {children}
    </div>
  )
}

/** One label/value pair in a detail sheet's metadata grid. */
export function Meta({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-primary/10 p-2">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="truncate text-sm font-medium">{children}</p>
      </div>
    </div>
  )
}

/** A compact segmented control: lab tabs, quality tiers, scale factors. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: ReadonlyArray<{ value: T; label: React.ReactNode; title?: string }>
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex rounded-lg border border-border bg-background p-0.5',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-md font-medium whitespace-nowrap transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Error box under the settings. */
export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {children}
    </div>
  )
}
