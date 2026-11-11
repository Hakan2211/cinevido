import { TIER_LABELS, formatRate } from '@/lib/pricing'
import { ModelIcon } from '@/lib/model-icons'
import { cn } from '@/lib/utils'
import { CATALOG_GROUPS, CATALOG_MODEL_COUNT } from './catalog-summary'

/**
 * The live catalog: every model the labs offer, its tier and fal's rate.
 * Rates are what fal bills your key — Cinevido adds nothing.
 */
export function ModelsSection() {
  return (
    <section id="models" className="border-t border-border py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
            The catalog
          </p>
          <h2 className="mt-4 text-3xl font-medium tracking-tight md:text-4xl">
            {CATALOG_MODEL_COUNT} models, each with its price on the button
          </h2>
          <p className="mt-4 text-muted-foreground">
            A Draft, a Workhorse and a Hero for every job, plus a few
            specialists. Rates below are fal's own, at each model's default
            settings — they bill your key directly.
          </p>
        </div>

        <div className="gap-5 md:columns-2 lg:columns-3">
          {CATALOG_GROUPS.map((group) => (
            <div
              key={group.title}
              className="mb-5 break-inside-avoid rounded-xl border border-border bg-card"
            >
              <h3 className="border-b border-border px-4 py-3 text-sm font-semibold">
                {group.title}
              </h3>
              <ul>
                {group.models.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 text-sm last:border-b-0"
                  >
                    <ModelIcon
                      modelId={m.id}
                      className="size-3.5 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    {m.tier && (
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                          m.tier === 'hero'
                            ? 'bg-primary/15 text-primary'
                            : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {TIER_LABELS[m.tier]}
                      </span>
                    )}
                    <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {formatRate(m.pricing) ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
