/**
 * The Generate lab layout (mockup 3): a settings panel on the left with a
 * sticky Generate footer, results on the right. Each lab route renders
 * <LabShell> full-bleed (see FULL_BLEED_ROUTES in routes/_app.tsx).
 */

import { Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Segmented } from './Field'

export function LabShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col lg:flex-row', className)}>
      {children}
    </div>
  )
}

export function LabPanel<T extends string>({
  title,
  subtitle,
  tabs,
  tab,
  onTabChange,
  footer,
  children,
}: {
  title: string
  subtitle?: string
  tabs?: ReadonlyArray<{ value: T; label: string }>
  tab?: T
  onTabChange?: (tab: T) => void
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-card/40 lg:h-full lg:w-[400px] lg:border-r lg:border-b-0">
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {tabs && tab !== undefined && onTabChange && (
            <Segmented
              size="sm"
              options={tabs}
              value={tab}
              onChange={onTabChange}
            />
          )}
        </div>
        {children}
      </div>
      {footer && <div className="border-t border-border p-4">{footer}</div>}
    </aside>
  )
}

/** The panel's primary action: "Generate · ≈ $0.47". */
export function GenerateButton({
  label,
  icon: Icon,
  busy,
  busyLabel,
  costLabel,
  disabled,
  onClick,
  hint = 'Billed to your fal account · Ctrl+Enter to generate',
}: {
  label: string
  icon: LucideIcon
  busy: boolean
  busyLabel: string
  costLabel: string | null
  disabled: boolean
  onClick: () => void
  hint?: string | null
}) {
  return (
    <>
      <Button
        size="lg"
        className="w-full"
        onClick={onClick}
        disabled={disabled}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {busyLabel}
          </>
        ) : (
          <>
            <Icon className="h-4 w-4" />
            {label}
            {costLabel && (
              <span className="font-normal tabular-nums opacity-80">
                · {costLabel}
              </span>
            )}
          </>
        )}
      </Button>
      {hint && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </>
  )
}

export function LabResults({
  title = 'Results',
  count,
  aside,
  children,
}: {
  title?: string
  count?: number
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {count !== undefined && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

/** The prompt textarea with a character counter. */
export function PromptBox({
  value,
  onChange,
  placeholder,
  max = 2000,
  rows = 5,
  disabled,
  textareaRef,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  max?: number
  rows?: number
  disabled?: boolean
  textareaRef?: React.Ref<HTMLTextAreaElement>
}) {
  return (
    <div className="rounded-xl border border-input bg-background transition-colors focus-within:border-muted-foreground/60">
      <textarea
        ref={textareaRef}
        value={value}
        maxLength={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="block w-full resize-none bg-transparent px-3.5 pt-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
      />
      <p className="px-3.5 pb-2 text-right text-[11px] tabular-nums text-muted-foreground">
        {value.length}/{max}
      </p>
    </div>
  )
}
