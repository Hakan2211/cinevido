/**
 * The Director's plan as shot cards in the chat (mockup 4): every shot with
 * its length, model and price, the draft / final totals, and the next action.
 */

import { useState } from 'react'
import { AlertTriangle, LayoutGrid, Loader2, Pencil, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatUsd } from '@/lib/pricing'
import {
  modelName,
  planPhase,
  planTotals,
  priceShot,
  totalSeconds,
} from '@/lib/production'
import { PlanEditor } from './PlanEditor'
import { ShotThumb } from './shot-ui'
import type { ProductionPlan } from '@/lib/production'
import type { Production } from './types'

export function PlanCard({
  plan,
  production,
  mode,
  onOpenStoryboard,
}: {
  plan: ProductionPlan
  production: Production
  mode: 'draft' | 'final'
  onOpenStoryboard: () => void
}) {
  const [editing, setEditing] = useState(false)
  const totals = planTotals(plan)
  const phase = planPhase(plan)
  const finalLabel = `${modelName(plan.models.final.model)}${plan.models.final.resolution ? ` ${plan.models.final.resolution}` : ''}`
  const busy = production.render.isPending

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{plan.title}</p>
          <p className="text-xs text-muted-foreground">
            {plan.shots.length} shots · {plan.format}
          </p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">
          Drafts {modelName(plan.models.draft)} · Finals {finalLabel}
        </p>
      </div>

      <ol className="divide-y divide-border">
        {plan.shots.map((shot, i) => {
          const price = priceShot(shot, plan.models, plan.aspectRatio)
          return (
            <li key={shot.id} className="flex items-center gap-3 px-3 py-2">
              <ShotThumb shot={shot} index={i} className="h-11 w-[72px] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  <span className="mr-2 text-muted-foreground">{i + 1}</span>
                  {shot.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {shot.description}
                </p>
              </div>
              <Chip>{shot.durationSec}s</Chip>
              <Chip className="hidden xl:inline-flex">{modelName(plan.models.final.model)}</Chip>
              <Chip title={`Draft ${formatUsd(price.stillUsd + price.draftUsd)} · Final ${formatUsd(price.finalUsd)}`}>
                {formatUsd(mode === 'final' ? price.stillUsd + price.finalUsd : price.stillUsd + price.draftUsd)}
              </Chip>
            </li>
          )
        })}
      </ol>

      {(plan.voiceover || plan.music) && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {[plan.voiceover && 'Voiceover', plan.music && `Music: ${plan.music.prompt}`]
            .filter(Boolean)
            .join(' · ')}
          {' '}· {formatUsd(totals.audioUsd)}
        </p>
      )}

      {(plan.stopped || plan.notice) && (
        <p className="flex items-start gap-2 border-t border-border px-4 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {plan.stopped ?? plan.notice}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {plan.shots.length} shots · {totalSeconds(plan)}s · est.{' '}
          {formatUsd(totals.draftUsd)} draft / {formatUsd(totals.finalUsd)} final
          {plan.spentUsd > 0 && <> · spent {formatUsd(plan.spentUsd)}</>}
        </p>
        <div className="flex gap-2">
          {phase === 'planned' && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil /> Edit plan
            </Button>
          )}
          {phase === 'planned' ? (
            mode === 'final' ? (
              <Button size="sm" disabled={busy} onClick={() => production.render.mutate('direct')}>
                {busy ? <Loader2 className="animate-spin" /> : <Play />}
                Render finals · ≈ {formatUsd(totals.directUsd)}
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => production.render.mutate('drafts')}>
                {busy ? <Loader2 className="animate-spin" /> : <Play />}
                Render drafts · ≈ {formatUsd(totals.draftUsd)}
              </Button>
            )
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil /> Edit plan
              </Button>
              <Button size="sm" onClick={onOpenStoryboard}>
                <LayoutGrid />
                {phase === 'review' ? 'Review drafts' : 'Open storyboard'}
              </Button>
            </>
          )}
        </div>
      </div>

      <PlanEditor
        open={editing}
        onOpenChange={setEditing}
        plan={plan}
        production={production}
      />
    </div>
  )
}

function Chip({
  children,
  className,
  title,
}: {
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums text-muted-foreground ${className ?? ''}`}
    >
      {children}
    </span>
  )
}
