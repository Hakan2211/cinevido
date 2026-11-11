/**
 * Building blocks shared by the Settings sections.
 */

import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SettingsHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-6">
      <p className="text-sm text-muted-foreground">Settings</p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function SettingsCard({
  icon: Icon,
  title,
  badge,
  description,
  actions,
  children,
  className,
}: {
  icon?: LucideIcon
  title: string
  badge?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('rounded-xl border border-border bg-card p-5', className)}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-semibold">{title}</h2>
            {badge}
          </div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  )
}

/** "● Connected" / "○ Not connected" */
export function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        ok ? 'text-success' : 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          ok ? 'bg-success' : 'border border-muted-foreground',
        )}
      />
      {label}
    </span>
  )
}

export function InlineMessage({
  tone,
  children,
}: {
  tone: 'ok' | 'error'
  children: React.ReactNode
}) {
  const Icon = tone === 'ok' ? CheckCircle2 : AlertCircle
  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-sm',
        tone === 'ok' ? 'text-success' : 'text-destructive',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </p>
  )
}

/** A stored secret, shown as its last characters only */
export function MaskedKey({ lastFour }: { lastFour: string | null }) {
  return (
    <div className="flex h-9 items-center rounded-md border border-input bg-background px-3 font-mono text-sm text-muted-foreground">
      ••••••••••••••••{lastFour?.replace(/^\.+/, '')}
    </div>
  )
}
