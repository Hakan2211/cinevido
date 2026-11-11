/**
 * Right column of the Studio (mockup 4): per-shot progress of the running
 * production, and what it has spent against its budget and the fal balance.
 */

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, Music, Mic, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatUsd } from '@/lib/pricing'
import { planActive } from '@/lib/production'
import { useFalCredits } from '@/components/byok/CreditBalance'
import { ShotThumb, elapsed, shotStatus } from './shot-ui'
import type { PlanStep } from '@/lib/production'
import type { Production } from './types'

export function JobsPanel({
  production,
  onOpenStoryboard,
}: {
  production: Production
  onOpenStoryboard: () => void
}) {
  const { plan } = production
  const now = useNow(plan ? planActive(plan) : false)

  const rows = plan?.shots.filter((s) => s.wantDraft || s.wantFinal) ?? []

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-base font-semibold">Jobs</h2>
        {plan && rows.length > 0 && (
          <button onClick={onOpenStoryboard} className="text-xs text-muted-foreground hover:text-foreground">
            Storyboard →
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {!plan || rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {plan ? 'Nothing rendering yet. Render drafts from the plan.' : 'No production yet. Describe what to make.'}
          </p>
        ) : (
          <>
            {rows.map((shot) => {
              const i = plan.shots.indexOf(shot)
              const st = shotStatus(shot, plan)
              const time = elapsed(st.since, now)
              return (
                <div key={shot.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <ShotThumb shot={shot} index={i} className="h-11 w-14 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      Shot {i + 1} · {shot.title}
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          st.failed ? 'bg-destructive' : 'bg-primary',
                          st.running && 'animate-pulse',
                        )}
                        style={{ width: `${Math.max(st.running ? 8 : 0, st.progress * 100)}%` }}
                      />
                    </div>
                    <p className={cn('mt-1 truncate text-xs', st.failed ? 'text-destructive' : 'text-muted-foreground')}>
                      {st.label}
                      {time && <span className="tabular-nums"> · {time}</span>}
                    </p>
                  </div>
                  <StatusIcon running={st.running} failed={st.failed} done={st.progress === 1} />
                </div>
              )
            })}
            <AudioRow icon={<Mic className="h-4 w-4" />} label="Voiceover" step={plan.voiceover?.step} wanted={!!plan.voiceover && !!plan.finalsRequestedAt} />
            <AudioRow icon={<Music className="h-4 w-4" />} label="Music" step={plan.music?.step} wanted={!!plan.music && !!plan.finalsRequestedAt} />
          </>
        )}
      </div>
    </section>
  )
}

function AudioRow({
  icon,
  label,
  step,
  wanted,
}: {
  icon: React.ReactNode
  label: string
  step?: PlanStep
  wanted: boolean
}) {
  if (!wanted) return null
  const text =
    step?.status === 'running'
      ? 'Rendering…'
      : step?.status === 'done'
        ? 'Ready'
        : step?.status === 'failed'
          ? `Failed${step.error ? `: ${step.error}` : ''}`
          : 'Starts after the finals are submitted'
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className={cn('truncate text-xs', step?.status === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>{text}</p>
      </div>
      <StatusIcon running={step?.status === 'running'} failed={step?.status === 'failed'} done={step?.status === 'done'} />
    </div>
  )
}

function StatusIcon({ running, failed, done }: { running: boolean; failed: boolean; done: boolean }) {
  if (running) return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
  if (failed) return <X className="h-4 w-4 shrink-0 text-destructive" />
  if (done) return <Check className="h-4 w-4 shrink-0 text-success" />
  return <span className="h-4 w-4 shrink-0" />
}

/** Re-render once a second while something runs, for elapsed times */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

export function SpendCard({ production }: { production: Production }) {
  const { plan, budgetUsd } = production
  const credits = useFalCredits()
  const spent = plan?.spentUsd ?? 0
  const pct = Math.min(100, (spent / Math.max(budgetUsd, 0.01)) * 100)

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-base font-semibold">Spend</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">This production</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatUsd(spent)}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">fal balance</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {credits.data?.status === 'ok' ? formatUsd(credits.data.balance) : '—'}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Budget</span>
          <span className="tabular-nums">
            {formatUsd(spent)} of {formatUsd(budgetUsd)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {plan?.stopped && (
        <p className="mt-3 flex gap-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {plan.stopped}
        </p>
      )}
      {credits.data && credits.data.status !== 'ok' && (
        <p className="mt-3 text-xs text-muted-foreground">
          Add a read-only billing key in Settings → Providers to see your fal balance.
        </p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Estimates charged at submit, refunded if fal fails a job; self-checks add their real cost.
      </p>
    </section>
  )
}

