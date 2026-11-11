/**
 * Result cards for the labs' results grid: the media on top, then model name,
 * estimated cost and a "…" menu. Optional icon actions float over the media
 * on hover. PendingCard is the placeholder while a job runs.
 */

import { AlertTriangle, Loader2, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface CardAction {
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}

type Aspect = 'video' | 'square'
const ASPECT: Record<Aspect, string> = {
  video: 'aspect-video',
  square: 'aspect-square',
}

export function ResultCard({
  media,
  aspect = 'video',
  title,
  cost,
  onSelect,
  onHover,
  hoverActions,
  menuActions,
  menuLabel = 'Actions',
}: {
  media: React.ReactNode
  aspect?: Aspect
  title: string
  /** Estimated cost, e.g. "$0.72" (no ≈) */
  cost?: string | null
  onSelect: () => void
  onHover?: (hovering: boolean) => void
  /** Icon buttons over the media on hover */
  hoverActions?: Array<CardAction>
  /** Items in the "…" menu; destructive ones go last after a separator */
  menuActions: Array<CardAction>
  menuLabel?: string
}) {
  const regular = menuActions.filter((a) => !a.destructive)
  const destructive = menuActions.filter((a) => a.destructive)
  return (
    <div className="group flex flex-col">
      <div
        className={cn(
          ASPECT[aspect],
          'relative overflow-hidden rounded-xl border border-border bg-muted',
        )}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
      >
        <button
          type="button"
          className="absolute inset-0 text-left"
          onClick={onSelect}
          aria-label={`Open ${title}`}
        >
          {media}
        </button>
        {hoverActions && hoverActions.length > 0 && (
          <TooltipProvider delayDuration={300}>
            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {hoverActions.map((a) => (
                <Tooltip key={a.label}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={a.disabled}
                      onClick={a.onClick}
                      aria-label={a.label}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg bg-black/65 text-white transition-colors hover:bg-black/85 disabled:opacity-50',
                        a.destructive && 'hover:bg-destructive',
                      )}
                    >
                      <a.icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{a.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-sm">
        <span className="truncate font-medium">{title}</span>
        {cost && (
          <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
            {cost}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground',
                !cost && 'ml-auto',
              )}
              aria-label={menuLabel}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {regular.map((a) => (
              <DropdownMenuItem
                key={a.label}
                onClick={a.onClick}
                disabled={a.disabled}
              >
                <a.icon className="mr-2 h-4 w-4" />
                {a.label}
              </DropdownMenuItem>
            ))}
            {destructive.length > 0 && regular.length > 0 && (
              <DropdownMenuSeparator />
            )}
            {destructive.map((a) => (
              <DropdownMenuItem
                key={a.label}
                onClick={a.onClick}
                disabled={a.disabled}
                className="text-destructive focus:text-destructive"
              >
                <a.icon className="mr-2 h-4 w-4" />
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function PendingCard({
  aspect = 'video',
  status,
  eta,
  progress = 0,
  queuePosition,
  onStopWaiting,
  title,
  cost,
}: {
  aspect?: Aspect
  status: string
  eta?: string
  progress?: number
  queuePosition?: number | null
  onStopWaiting?: () => void
  title?: string
  cost?: string | null
}) {
  return (
    <div className="flex flex-col">
      <div
        className={cn(
          ASPECT[aspect],
          'relative overflow-hidden rounded-xl border border-border bg-card',
        )}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium">{status}</p>
          {eta && <p className="mt-1 text-xs text-muted-foreground">{eta}</p>}
          {!!queuePosition && queuePosition >= 50 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-primary">
              <AlertTriangle className="h-3.5 w-3.5" />
              Queue position {queuePosition}
              {queuePosition >= 200 && onStopWaiting && (
                <button
                  type="button"
                  onClick={onStopWaiting}
                  className="underline"
                >
                  stop waiting
                </button>
              )}
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
          <div
            className={cn(
              'h-full bg-primary transition-all duration-500',
              progress === 0 &&
                'w-1/4 animate-[indeterminate_1.6s_ease-in-out_infinite]',
            )}
            style={progress ? { width: `${progress}%` } : undefined}
          />
        </div>
      </div>
      {(title || cost) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 text-sm">
          <span className="truncate font-medium">{title}</span>
          {cost && (
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {cost}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
