/**
 * Admin → Price drift: every catalog price next to fal's pricing API.
 *
 * Read-only. A "Drift" row means the catalog (src/server/services/types.ts)
 * needs a look — fal's base price is none of the prices the rule charges.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsCard, InlineMessage } from '@/components/settings/SettingsCard'
import { cn } from '@/lib/utils'
import type { DriftStatus } from '@/lib/price-drift'
import type { PriceDriftReport } from '@/server/price-drift.server'

const STATUS: Record<DriftStatus, { label: string; className: string }> = {
  drift: { label: 'Drift', className: 'bg-destructive/15 text-destructive' },
  missing: {
    label: 'Not on fal',
    className: 'bg-destructive/15 text-destructive',
  },
  unit: { label: 'Check unit', className: 'bg-primary/15 text-primary' },
  unpriced: { label: 'No price', className: 'bg-primary/15 text-primary' },
  ok: { label: 'Match', className: 'bg-success/15 text-success' },
}

const RULE_UNIT: Record<string, string> = {
  perImage: '/image',
  perMegapixel: '/MP',
  perSecond: '/s',
  perKChars: '/1k chars',
  perMinute: '/min',
  flat: '/run',
  range: '',
}

function usd(n: number) {
  return `$${n < 0.1 ? Number(n.toPrecision(3)) : n.toFixed(2)}`
}

export function PriceDriftCard() {
  const [showAll, setShowAll] = useState(false)
  const check = useMutation({
    mutationFn: async (): Promise<PriceDriftReport> => {
      const { checkPriceDriftFn } = await import('@/server/price-drift.server')
      return checkPriceDriftFn()
    },
  })
  const report = check.data
  const rows = report
    ? showAll
      ? report.rows
      : report.rows.filter((r) => r.status !== 'ok')
    : []
  const counts = report?.rows.reduce<Partial<Record<DriftStatus, number>>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {},
  )

  return (
    <SettingsCard
      icon={Scale}
      title="Price drift"
      description="Compares every catalog price to fal's pricing API. fal quotes one base price, usually the cheapest resolution, so a match against any resolution or quality in our rule counts. Free to run."
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => check.mutate()}
          disabled={check.isPending}
        >
          {check.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {report ? 'Check again' : 'Check prices'}
        </Button>
      }
    >
      {check.error && (
        <InlineMessage tone="error">{check.error.message}</InlineMessage>
      )}
      {report && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(Object.keys(STATUS) as Array<DriftStatus>)
              .filter((s) => counts?.[s])
              .map((s) => (
                <span
                  key={s}
                  className={cn(
                    'rounded-full px-2 py-0.5',
                    STATUS[s].className,
                  )}
                >
                  {counts?.[s]} {STATUS[s].label.toLowerCase()}
                </span>
              ))}
            <span className="text-muted-foreground">
              · checked {new Date(report.checkedAt).toLocaleTimeString()}
            </span>
            <button
              onClick={() => setShowAll((v) => !v)}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              {showAll ? 'Hide matches' : 'Show all'}
            </button>
          </div>
          {report.errors.map((e) => (
            <InlineMessage key={e} tone="error">
              {e}
            </InlineMessage>
          ))}
          {rows.length === 0 ? (
            <InlineMessage tone="ok">
              Every catalog price matches fal.
            </InlineMessage>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 font-medium">Catalog</th>
                    <th className="px-3 py-2 font-medium">fal</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.endpoint}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2">
                        <div>{r.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {r.category} · {r.endpoint}
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {r.rule
                          ? r.rule.kind === 'range'
                            ? `${usd(r.ours[0])}–${usd(r.ours[r.ours.length - 1])}`
                            : r.ours.map(usd).join(' · ') +
                              RULE_UNIT[r.rule.kind]
                          : '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {r.fal
                          ? `${usd(r.fal.unit_price)} / ${r.fal.unit}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'whitespace-nowrap rounded-full px-2 py-0.5 text-xs',
                            STATUS[r.status].className,
                          )}
                        >
                          {STATUS[r.status].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </SettingsCard>
  )
}
