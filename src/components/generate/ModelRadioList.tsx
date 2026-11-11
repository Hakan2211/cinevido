/**
 * ModelRadioList — the labs' model picker: models grouped Draft / Workhorse /
 * Hero (then specialists), each with its provider mark and fal rate.
 */

import { Info } from 'lucide-react'
import { TIER_LABELS, formatRate } from '@/lib/pricing'
import type { ModelTier, PriceRule } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { ModelIcon } from '@/lib/model-icons'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface RadioModel {
  id: string
  name: string
  description?: string
  tier?: ModelTier
  pricing?: PriceRule
}

const TIER_ORDER: Array<ModelTier | 'other'> = [
  'draft',
  'standard',
  'hero',
  'other',
]
const TIER_HINTS: Record<ModelTier | 'other', string> = {
  draft: 'Best for quick tests',
  standard: 'Great balance of quality and cost',
  hero: 'Highest quality for final results',
  other: '',
}

export function ModelRadioList<M extends RadioModel>({
  models,
  value,
  onChange,
  badge,
  otherLabel = 'Specialists',
  footnote = "Rates are fal's prices at the model's default resolution.",
}: {
  models: ReadonlyArray<M>
  value: string
  onChange: (id: string) => void
  /** A small tag after the name ("audio", "10 refs") */
  badge?: (model: M) => React.ReactNode
  /** Heading for models without a tier */
  otherLabel?: string
  footnote?: string | null
}) {
  if (models.length === 0) {
    return <Skeleton className="h-48 rounded-xl" />
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {TIER_ORDER.map((tier) => {
        const group = models.filter((m) => (m.tier ?? 'other') === tier)
        if (group.length === 0) return null
        return (
          <div key={tier} className="border-b border-border last:border-b-0">
            <p className="flex items-baseline gap-2 bg-muted/40 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tier === 'other' ? otherLabel : TIER_LABELS[tier]}
              <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
                {TIER_HINTS[tier]}
              </span>
            </p>
            {group.map((m) => {
              const checked = m.id === value
              const tag = badge?.(m)
              return (
                <TooltipProvider key={m.id} delayDuration={500}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => onChange(m.id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors',
                          checked ? 'bg-primary/[0.08]' : 'hover:bg-accent/50',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                            checked ? 'border-primary' : 'border-border',
                          )}
                        >
                          {checked && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </span>
                        <ModelIcon
                          modelId={m.id}
                          className={cn(
                            'size-3.5',
                            checked
                              ? 'text-foreground'
                              : 'text-muted-foreground',
                          )}
                        />
                        <span
                          className={cn(
                            'flex-1 truncate',
                            checked && 'font-medium',
                          )}
                        >
                          {m.name}
                        </span>
                        {tag && (
                          <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                            {tag}
                          </span>
                        )}
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatRate(m.pricing)}
                        </span>
                      </button>
                    </TooltipTrigger>
                    {m.description && (
                      <TooltipContent side="right" className="max-w-xs">
                        {m.description}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </div>
        )
      })}
      {footnote && (
        <p className="flex items-center gap-1.5 border-t border-border px-3.5 py-2 text-[11px] text-muted-foreground">
          <Info className="h-3 w-3" />
          {footnote}
        </p>
      )}
    </div>
  )
}
