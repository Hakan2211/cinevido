/**
 * fal.ai credit balance — the pill in the top bar.
 *
 * Reads the balance through the user's read-only billing key (Settings →
 * Providers). Without one it links there; with one it shows the balance and
 * turns amber below the user's low-balance threshold (Settings → Usage,
 * default $2) and red below a quarter of it, since fal locks the account —
 * and every generation fails — once credits run out.
 */

import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatUsd } from '@/lib/pricing'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function useFalCredits() {
  return useQuery({
    queryKey: ['falCredits'],
    queryFn: async () => {
      const { getFalCreditsFn } = await import('@/server/byok.server')
      return getFalCreditsFn()
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function CreditPill({ className }: { className?: string }) {
  const { data, isLoading } = useFalCredits()

  if (isLoading || !data) {
    return (
      <div
        className={cn(
          'h-9 w-28 rounded-full bg-muted animate-pulse',
          className,
        )}
      />
    )
  }

  if (data.status !== 'ok') {
    const hint =
      data.status === 'no-key'
        ? 'Add a read-only fal key to see your balance'
        : data.status === 'forbidden'
          ? 'Your billing key cannot read the balance'
          : 'Balance unavailable right now'
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/settings/providers"
              className={cn(
                'flex h-9 items-center gap-2 rounded-full border border-dashed border-border px-3.5 text-sm text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground',
                className,
              )}
            >
              <Coins className="h-4 w-4" />
              fal —
            </Link>
          </TooltipTrigger>
          <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const low = data.balance < data.lowBalanceUsd
  const critical = data.balance < data.lowBalanceUsd / 4
  const amount =
    data.currency === 'USD'
      ? formatUsd(data.balance)
      : `${data.balance.toFixed(2)} ${data.currency}`

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/settings/providers"
            className={cn(
              'flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors',
              critical
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : low
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:bg-accent',
              className,
            )}
          >
            {low ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Coins className="h-4 w-4 text-primary" />
            )}
            <span className="text-muted-foreground">fal</span>
            <span className="font-semibold tabular-nums">{amount}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          {critical
            ? 'Almost out — fal locks the account when credits run out'
            : low
              ? 'Running low on fal credits'
              : `fal balance · checked ${new Date(data.checkedAt).toLocaleTimeString()}`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
