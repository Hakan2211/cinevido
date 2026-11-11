/**
 * Storyboard review (mockup 5): every shot's draft with the self-check's
 * note, Keep / Retry / Promote to final, the approved count and what finals
 * will cost, and a strip of the cut as it stands.
 *
 * Keep = re-render on the final model from the same still.
 * Promote to final = use the draft as it is (no second render, no cost).
 */

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatUsd } from '@/lib/pricing'
import {
  approvedCount,
  finalsCost,
  modelName,
  planPhase,
  planTotals,
  priceShot,
  shotBusy,
  shotPreview,
  totalSeconds,
} from '@/lib/production'
import { ShotThumb, clock, shotStatus } from './shot-ui'
import type { PlanShot, ProductionPlan } from '@/lib/production'
import type { Production } from './types'

export function StoryboardBoard({
  production,
  onOpenEditor,
}: {
  production: Production
  onOpenEditor: () => void
}) {
  const { plan } = production
  if (!plan) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-semibold">No storyboard yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe what to make in the Director tab and it will plan the shots.
          </p>
        </div>
      </div>
    )
  }
  return <Board plan={plan} production={production} onOpenEditor={onOpenEditor} />
}

function Board({
  plan,
  production,
  onOpenEditor,
}: {
  plan: ProductionPlan
  production: Production
  onOpenEditor: () => void
}) {
  const phase = planPhase(plan)
  const approved = approvedCount(plan)
  const drafted = plan.shots.filter((s) => s.draft?.status === 'done').length
  const finals = finalsCost(plan)
  const totals = planTotals(plan)
  const cover = plan.shots.map(shotPreview).find(Boolean)
  const finalsRunning = !!plan.finalsRequestedAt && phase === 'finalizing'

  const status =
    phase === 'planned'
      ? 'Not rendered yet'
      : phase === 'drafting'
        ? `Drafting · ${drafted} of ${plan.shots.length} ready`
        : phase === 'review'
          ? `Drafts complete · ${approved} of ${plan.shots.length} approved`
          : phase === 'finalizing'
            ? 'Rendering finals…'
            : 'Assembled on the timeline'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="flex flex-wrap items-center gap-4 border-b border-border px-6 py-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
          {cover?.kind === 'image' && <img src={cover.url} alt="" className="h-full w-full object-cover" />}
          {cover?.kind === 'video' && (
            <video src={cover.url} muted preload="metadata" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">{plan.title}</h2>
          <p className="text-sm text-muted-foreground">
            {plan.shots.length} shots · {clock(totalSeconds(plan))} · {plan.aspectRatio} ·{' '}
            {phase === 'review' ? 'Drafts ready' : phase === 'assembled' ? 'Final cut' : phase === 'planned' ? 'Planned' : 'Rendering'}
          </p>
        </div>

        <div className="flex items-center gap-6 rounded-xl border border-border bg-card px-5 py-3">
          <p className="flex items-center gap-2 text-sm">
            {phase === 'drafting' || finalsRunning ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-success" />
            )}
            {status}
          </p>
          <div>
            <p className="text-xs text-muted-foreground">
              {phase === 'planned' ? 'Estimated drafts' : 'Estimated final render cost'}
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {formatUsd(phase === 'planned' ? totals.draftUsd : finals)}
            </p>
          </div>
        </div>

        {phase === 'planned' ? (
          <Button size="lg" onClick={() => production.render.mutate('drafts')} disabled={production.render.isPending}>
            Render drafts <ArrowRight />
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => production.render.mutate('finals')}
            disabled={approved === 0 || production.render.isPending || phase === 'drafting' || (finalsRunning && finals === 0)}
            title={approved === 0 ? 'Keep or promote at least one shot' : undefined}
          >
            {production.render.isPending && <Loader2 className="animate-spin" />}
            {phase === 'assembled' && finals === 0 ? 'Finals rendered' : 'Render finals'} <ArrowRight />
          </Button>
        )}
      </div>

      {(plan.stopped || plan.notice) && (
        <p className="flex items-center gap-2 border-b border-border px-6 py-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {plan.stopped ?? plan.notice}
        </p>
      )}

      {/* shots */}
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <div className="flex min-w-max gap-3 p-4">
          {plan.shots.map((shot, i) => (
            <ShotColumn key={shot.id} shot={shot} index={i} plan={plan} production={production} />
          ))}
        </div>
      </div>

      {/* cut preview */}
      <div className="flex items-center gap-4 border-t border-border px-6 py-3">
        <div className="shrink-0">
          <p className="text-sm font-medium">Timeline preview</p>
          <p className="text-xs text-muted-foreground">{clock(totalSeconds(plan))} total</p>
        </div>
        <div className="flex h-14 min-w-0 flex-1 overflow-hidden rounded-md border border-border">
          {plan.shots.map((shot, i) => (
            <div
              key={shot.id}
              className={cn('h-full min-w-0 border-r border-background last:border-r-0', shot.decision === null && phase !== 'planned' && 'opacity-40')}
              style={{ flexGrow: shot.durationSec, flexBasis: 0 }}
              title={`${i + 1} · ${shot.title}`}
            >
              <ShotThumb shot={shot} index={i} className="h-full w-full rounded-none" />
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={onOpenEditor} disabled={!plan.assembly}>
          Open in editor
        </Button>
      </div>
    </div>
  )
}

function ShotColumn({
  shot,
  index,
  plan,
  production,
}: {
  shot: PlanShot
  index: number
  plan: ProductionPlan
  production: Production
}) {
  const st = shotStatus(shot, plan)
  const busy = shotBusy(shot)
  const hasDraft = shot.draft?.status === 'done'
  const price = priceShot(shot, plan.models, plan.aspectRatio)
  const pending = production.review.isPending && production.review.variables?.shotId === shot.id
  const act = (action: 'keep' | 'promote' | 'clear' | 'retry' | 'retryFinal') =>
    production.review.mutate({ shotId: shot.id, action })

  return (
    <article
      className={cn(
        'flex w-[240px] shrink-0 flex-col rounded-xl border bg-card',
        shot.decision ? 'border-primary/60' : 'border-border',
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide">
          <span className="mr-1.5 text-muted-foreground">{index + 1}</span>
          {shot.title}
        </p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{clock(shot.durationSec)}</span>
      </header>

      <div className="relative">
        <ShotThumb
          shot={shot}
          index={index}
          play
          className={cn('w-full rounded-none', plan.aspectRatio === '9:16' ? 'aspect-[9/16]' : plan.aspectRatio === '1:1' ? 'aspect-square' : 'aspect-video')}
        />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
            {st.label}
          </div>
        )}
        {shot.final?.status === 'done' && shot.wantFinal && (
          <span className="absolute left-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Final
          </span>
        )}
      </div>

      <p className="px-3 pt-2.5 text-sm leading-snug">{shot.description}</p>

      <div className="mx-3 mt-3 min-h-[76px] rounded-lg border border-border bg-background p-2.5">
        <Verdict shot={shot} failedLabel={st.failed ? st.label : undefined} />
      </div>

      <div className="mt-auto space-y-2 p-3">
        <Button
          className="w-full"
          variant={shot.decision === 'keep' ? 'default' : 'secondary'}
          size="sm"
          disabled={busy || pending || (!hasDraft && shot.still?.status !== 'done')}
          onClick={() => act(shot.decision === 'keep' ? 'clear' : 'keep')}
          title={`Re-render on ${modelName(plan.models.final.model)} · ${formatUsd(price.finalUsd)}`}
        >
          {shot.decision === 'keep' ? 'Kept' : 'Keep'}
          <span className="font-normal opacity-70">· {formatUsd(price.finalUsd)}</span>
        </Button>
        <Button
          className="w-full"
          variant="secondary"
          size="sm"
          disabled={busy || pending || (!shot.wantDraft && !shot.wantFinal)}
          onClick={() => act(st.failed && shot.final?.status === 'failed' ? 'retryFinal' : 'retry')}
          title={`New still and draft · ${formatUsd(price.stillUsd + price.draftUsd)}`}
        >
          <RotateCcw /> Retry
        </Button>
        <Button
          className="w-full"
          variant={shot.decision === 'promote' ? 'default' : 'secondary'}
          size="sm"
          disabled={busy || pending || !hasDraft}
          onClick={() => act(shot.decision === 'promote' ? 'clear' : 'promote')}
          title="Use this draft as the final, no re-render"
        >
          <Upload /> {shot.decision === 'promote' ? 'Promoted' : 'Promote to final'}
        </Button>
      </div>
    </article>
  )
}

function Verdict({ shot, failedLabel }: { shot: PlanShot; failedLabel?: string }) {
  if (failedLabel) {
    return (
      <div className="flex gap-2 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{failedLabel}</p>
      </div>
    )
  }
  const c = shot.check
  if (!c || c.status === 'running') {
    return (
      <p className="text-xs text-muted-foreground">
        {c?.status === 'running' ? 'Checking the draft against the brief…' : shot.draft ? 'Waiting for the draft…' : 'The draft gets an AI check here.'}
      </p>
    )
  }
  if (c.ok) {
    return (
      <div className="flex gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <div>
          <p className="text-sm font-medium">Matches brief</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-2">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div>
        <p className="text-sm font-medium text-warning">
          {c.ok === false ? 'Retry suggested' : 'Check unavailable'}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>
      </div>
    </div>
  )
}
