/**
 * Settings → Usage: fal balance, this month's spend, the low-balance
 * threshold behind the credit pill, a daily spend chart and the last jobs.
 *
 * Month spend and the chart come from fal (real, whole account) when there is
 * a billing key, otherwise from Cinevido's own per-job estimates. Job costs
 * are always our estimates (see src/lib/job-cost.ts).
 */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  AudioLines,
  Box,
  Film,
  ImageIcon,
  Loader2,
  Music,
  RefreshCw,
  Sparkles,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { SettingsCard } from './SettingsCard'
import type { ChartConfig } from '@/components/ui/chart'
import type { JobKind, UsageJob, UsageSummary } from '@/server/usage.server'
import { useFalCredits } from '@/components/byok'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatUsd } from '@/lib/pricing'
import { cn } from '@/lib/utils'

export function useUsage() {
  return useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const { getUsageFn } = await import('@/server/usage.server')
      return getUsageFn()
    },
    staleTime: 60_000,
  })
}

export function UsageSection() {
  const queryClient = useQueryClient()
  const { data: usage, isLoading, isFetching } = useUsage()

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['usage'] })
    void queryClient.invalidateQueries({ queryKey: ['falCredits'] })
  }

  return (
    <SettingsCard
      title="Usage"
      description="Your fal balance, what you've spent this month and your recent jobs."
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={isFetching}
          className="text-muted-foreground"
        >
          {usage && (
            <span className="mr-2 hidden text-xs sm:inline">
              Updated {timeAgo(usage.checkedAt)}
            </span>
          )}
          <RefreshCw
            className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')}
          />
        </Button>
      }
    >
      <div className="grid gap-3 lg:grid-cols-3">
        <BalanceTile />
        <SpendTile usage={usage} loading={isLoading} />
        <ThresholdTile />
      </div>

      {usage && (
        <>
          <SpendChart usage={usage} />
          <JobsTable jobs={usage.recentJobs} />
        </>
      )}
    </SettingsCard>
  )
}

// =============================================================================
// Tiles
// =============================================================================

function Tile({
  label,
  children,
  footer,
}: {
  label: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-28 flex-col rounded-lg border border-border bg-background/40 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 flex-1">{children}</div>
      {footer && (
        <div className="mt-2 text-xs text-muted-foreground">{footer}</div>
      )}
    </div>
  )
}

function BalanceTile() {
  const { data: credits, isLoading } = useFalCredits()
  return (
    <Tile
      label="Current balance"
      footer={
        credits?.status === 'ok' ? (
          <a
            href="https://fal.ai/dashboard/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Top up on fal
          </a>
        ) : credits?.status === 'no-key' ? (
          'Add a billing key above to see it'
        ) : credits?.status === 'forbidden' ? (
          'Your billing key can’t read the balance'
        ) : credits?.status === 'error' ? (
          'fal is not answering right now'
        ) : null
      }
    >
      {isLoading ? (
        <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <p className="text-3xl font-semibold tabular-nums">
          {credits?.status === 'ok' ? formatUsd(credits.balance) : '—'}
        </p>
      )}
    </Tile>
  )
}

function SpendTile({
  usage,
  loading,
}: {
  usage: UsageSummary | undefined
  loading: boolean
}) {
  const period = usage
    ? `${shortDate(usage.periodStart)} – ${shortDate(new Date().toISOString())}`
    : ''
  return (
    <Tile
      label="Spent this month"
      footer={
        usage &&
        (usage.source === 'fal' ? (
          <>
            {period} · from fal, whole account
            <br />
            Cinevido estimate {formatUsd(usage.estimatedMonthUsd)}
          </>
        ) : (
          <>
            {period} · Cinevido estimate
            {usage.falError && (
              <>
                <br />
                fal usage unavailable: {usage.falError}
              </>
            )}
          </>
        ))
      }
    >
      {loading ? (
        <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <p className="text-3xl font-semibold tabular-nums">
          {usage ? formatUsd(usage.monthUsd) : '—'}
        </p>
      )}
    </Tile>
  )
}

function ThresholdTile() {
  const queryClient = useQueryClient()
  const { data: credits } = useFalCredits()
  const current = credits?.lowBalanceUsd
  const [value, setValue] = useState('')

  useEffect(() => {
    if (current !== undefined) setValue(String(current))
  }, [current])

  const save = useMutation({
    mutationFn: async (usd: number) => {
      const { setLowBalanceFn } = await import('@/server/byok.server')
      return setLowBalanceFn({ data: { usd } })
    },
    onSuccess: () => {
      toast.success('Threshold saved')
      void queryClient.invalidateQueries({ queryKey: ['falCredits'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const parsed = Number.parseFloat(value)
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 10_000
  const dirty = valid && parsed !== current

  return (
    <Tile
      label="Low-balance warning"
      footer={
        valid
          ? `The balance pill turns amber below ${formatUsd(parsed)} and red below ${formatUsd(parsed / 4)}.`
          : 'Enter an amount in dollars.'
      }
    >
      <form
        className="mt-1 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (dirty) save.mutate(Math.round(parsed * 100) / 100)
        }}
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input
            inputMode="decimal"
            aria-label="Low-balance threshold in dollars"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="pl-7 tabular-nums"
          />
        </div>
        <Button type="submit" disabled={!dirty || save.isPending}>
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Save'
          )}
        </Button>
      </form>
    </Tile>
  )
}

// =============================================================================
// Chart
// =============================================================================

const chartConfig = {
  usd: { label: 'Spend', color: 'var(--primary)' },
} satisfies ChartConfig

function SpendChart({ usage }: { usage: UsageSummary }) {
  const data = useMemo(
    () =>
      usage.daily.map((d) => ({
        day: d.day,
        label: shortDate(d.day),
        usd: Math.round(d.usd * 100) / 100,
      })),
    [usage.daily],
  )
  const hasSpend = data.some((d) => d.usd > 0)

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium">Daily spend</h3>
        <p className="text-xs text-muted-foreground">
          {usage.source === 'fal'
            ? 'fal account, UTC days'
            : 'Cinevido estimates, UTC days'}
        </p>
      </div>
      {hasSpend ? (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-48 w-full"
          aria-label={`Daily spend this month, total ${formatUsd(usage.monthUsd)}`}
        >
          <BarChart data={data} margin={{ left: 0, right: 0, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => `$${v}`}
            />
            <ChartTooltip
              cursor={{ fill: 'var(--accent)' }}
              content={
                <ChartTooltipContent
                  hideIndicator
                  formatter={(value) => (
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatUsd(Number(value))}
                    </span>
                  )}
                />
              }
            />
            <Bar
              dataKey="usd"
              fill="var(--color-usd)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Nothing spent this month yet
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Jobs table
// =============================================================================

const KIND_ICON: Record<JobKind, typeof Film> = {
  Image: ImageIcon,
  Edit: ImageIcon,
  Layers: Layers,
  Upscale: Sparkles,
  Video: Film,
  Motion: Film,
  Voice: AudioLines,
  SFX: AudioLines,
  Music: Music,
  '3D': Box,
}

const STATUS_LABEL: Record<UsageJob['status'], string> = {
  pending: 'Queued',
  processing: 'Running',
  completed: 'Completed',
  failed: 'Failed',
}

function JobsTable({ jobs }: { jobs: Array<UsageJob> }) {
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-medium">
        {jobs.length > 1 ? `Last ${jobs.length} jobs` : 'Recent jobs'}
      </h3>
      {jobs.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          No jobs yet
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Prompt</th>
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-3 py-2 text-right font-medium">Length</th>
                <th className="px-3 py-2 text-right font-medium">Cost</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Costs are estimates from the catalog price at the time of the run; fal
        doesn&apos;t bill failed runs.
      </p>
    </div>
  )
}

function JobRow({ job }: { job: UsageJob }) {
  const Icon = KIND_ICON[job.kind]
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
            {job.thumbnailUrl ? (
              <img
                src={job.thumbnailUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : job.videoUrl ? (
              <video
                src={`${job.videoUrl}#t=0.1`}
                preload="metadata"
                muted
                className="h-full w-full object-cover"
              />
            ) : (
              <Icon className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <span className="text-muted-foreground">{job.kind}</span>
        </div>
      </td>
      <td className="max-w-72 px-3 py-2">
        <p className="truncate" title={job.prompt ?? undefined}>
          {job.prompt ?? '—'}
        </p>
      </td>
      <td className="whitespace-nowrap px-3 py-2">{job.modelName}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
        {job.durationSec ? `${Math.round(job.durationSec * 10) / 10}s` : '—'}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
        {job.costUsd !== null ? formatUsd(job.costUsd) : '—'}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
        {new Date(job.createdAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5',
            job.status === 'failed' && 'text-destructive',
            (job.status === 'pending' || job.status === 'processing') &&
              'text-primary',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              job.status === 'completed' && 'bg-success',
              job.status === 'failed' && 'bg-destructive',
              (job.status === 'pending' || job.status === 'processing') &&
                'bg-primary',
            )}
          />
          {STATUS_LABEL[job.status]}
        </span>
      </td>
    </tr>
  )
}

// =============================================================================
// Formatting
// =============================================================================

/** "Nov 3" for an ISO date or YYYY-MM-DD (read as UTC) */
function shortDate(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.round(minutes / 60)} h ago`
}
