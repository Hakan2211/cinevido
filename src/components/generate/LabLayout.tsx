/**
 * The Generate lab layout (mockup 3): a settings panel on the left with a
 * sticky Generate footer, results on the right. Each lab route renders
 * <LabShell> full-bleed (see FULL_BLEED_ROUTES in routes/_app.tsx).
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Loader2, Maximize2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Segmented } from './Field'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
      <div className="scrollbar-quiet flex-1 space-y-6 overflow-y-auto p-6">
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
    <section className="scrollbar-quiet min-h-0 flex-1 overflow-y-auto p-6">
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

/** Words in a prompt, for the counter */
function countWords(text: string) {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/** Grow a textarea to fit its text, up to its CSS max-height */
function fit(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/**
 * The prompt textarea. It grows with the text (then scrolls, with a scrollbar
 * that only shows on hover), counts words, and opens a full-size editor for
 * long prompts. The counter turns amber near the limit.
 */
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
  const [expanded, setExpanded] = useState(false)
  const inner = useRef<HTMLTextAreaElement | null>(null)

  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      inner.current = el
      if (typeof textareaRef === 'function') textareaRef(el)
      else if (textareaRef)
        (
          textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>
        ).current = el
    },
    [textareaRef],
  )

  // Re-fit when the value changes from outside too (a draft restored, a preset)
  useLayoutEffect(() => fit(inner.current), [value])

  const words = countWords(value)
  const near = value.length >= max * 0.9

  return (
    <>
      <div className="group rounded-xl border border-input bg-background transition-colors focus-within:border-muted-foreground/60">
        <textarea
          ref={setRef}
          value={value}
          maxLength={max}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="scrollbar-quiet block max-h-[40vh] w-full resize-none overflow-y-auto bg-transparent px-3.5 pt-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
        />
        <div className="flex items-center gap-2 px-2 pb-1.5 pl-3.5">
          <p
            className={cn(
              'flex-1 text-[11px] tabular-nums text-muted-foreground',
              near && 'text-amber-500',
            )}
          >
            {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
            {near && (
              <>
                {' '}
                · {value.length.toLocaleString()}/{max.toLocaleString()}{' '}
                characters
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            disabled={disabled}
            className="rounded-md p-1 text-muted-foreground opacity-60 transition hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none group-hover:opacity-100"
            aria-label="Expand prompt editor"
            title="Expand"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[85vh] flex-col gap-3 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prompt</DialogTitle>
          </DialogHeader>
          <textarea
            autoFocus
            value={value}
            maxLength={max}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl+Enter still generates (the lab listens on the document)
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                setExpanded(false)
            }}
            placeholder={placeholder}
            className="scrollbar-quiet min-h-0 flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/70 focus:border-muted-foreground/60"
          />
          <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
            <span className={cn(near && 'text-amber-500')}>
              {words.toLocaleString()} {words === 1 ? 'word' : 'words'} ·{' '}
              {value.length.toLocaleString()}/{max.toLocaleString()} characters
            </span>
            <span>Ctrl+Enter to generate · Esc to close</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
