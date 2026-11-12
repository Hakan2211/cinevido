/**
 * Edit plan: change, reorder, add or remove shots and pick the final model.
 * Totals update as you type (same price math as the server); the server
 * re-prices on save and keeps renders whose inputs did not change.
 */

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatUsd } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { MAX_SHOT_REFS } from '@/lib/bible'
import { useBible } from './useBible'
import {
  MAX_SHOTS,
  finalModelOptions,
  planTotals,
  shotDuration,
} from '@/lib/production'
import type { FinalChoice, ProductionPlan, ShotEdit } from '@/lib/production'
import type { Production } from './types'

const keyOf = (c: FinalChoice) => `${c.model}@${c.resolution ?? ''}`

export function PlanEditor({
  open,
  onOpenChange,
  plan,
  production,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: ProductionPlan
  production: Production
}) {
  const options = useMemo(() => finalModelOptions(), [])
  const cast = useBible(production.projectId).bible?.entries ?? []
  const [title, setTitle] = useState(plan.title)
  const [shots, setShots] = useState<Array<ShotEdit>>([])
  const [final, setFinal] = useState<FinalChoice>(plan.models.final)

  // start from the saved plan every time the dialog opens
  useEffect(() => {
    if (!open) return
    setTitle(plan.title)
    setFinal(plan.models.final)
    setShots(
      plan.shots.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        durationSec: s.durationSec,
        prompt: s.prompt,
        motion: s.motion,
        cast: s.cast ?? [],
        packshot: s.packshot ?? null,
      })),
    )
  }, [open, plan])

  const models = { ...plan.models, final }
  const totals = planTotals({
    ...plan,
    models,
    shots: shots.map((s) => ({
      ...(plan.shots[0] ?? {}),
      ...s,
      id: s.id ?? '',
      packshot: s.packshot ?? undefined,
      durationSec: shotDuration(s.durationSec, models),
      decision: null,
      wantDraft: false,
      wantFinal: false,
    })),
  })

  const patch = (i: number, p: Partial<ShotEdit>) =>
    setShots((prev) => prev.map((s, j) => (j === i ? { ...s, ...p } : s)))
  const move = (i: number, d: -1 | 1) =>
    setShots((prev) => {
      const next = [...prev]
      const j = i + d
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const valid =
    shots.length > 0 && shots.every((s) => s.prompt.trim().length > 0)

  const save = () => {
    production.updatePlan.mutate(
      {
        title,
        shots,
        final: keyOf(final) === keyOf(plan.models.final) ? undefined : final,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>Edit plan</DialogTitle>
            <DialogDescription>
              Changing a shot's picture prompt or cast re-renders its still;
              changing motion or length re-renders its clips. Everything else
              keeps.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground">Title</span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground">Final model</span>
                <Select
                  value={keyOf(final)}
                  onValueChange={(v) => {
                    const o = options.find((x) => keyOf(x) === v)
                    if (o)
                      setFinal({ model: o.model, resolution: o.resolution })
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={keyOf(o)} value={keyOf(o)}>
                        {o.label}{' '}
                        <span className="text-muted-foreground">
                          · {o.tier}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            {shots.map((shot, i) => (
              <div
                key={shot.id ?? `new-${i}`}
                className="space-y-2 rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 text-sm text-muted-foreground">
                    {i + 1}
                  </span>
                  <Input
                    value={shot.title}
                    onChange={(e) => patch(i, { title: e.target.value })}
                    placeholder="Shot title"
                    className="h-8 flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={shot.durationSec}
                    onChange={(e) =>
                      patch(i, { durationSec: Number(e.target.value) || 5 })
                    }
                    className="h-8 w-20"
                    aria-label="Seconds"
                  />
                  <span className="text-xs text-muted-foreground">
                    → {shotDuration(shot.durationSec, models)}s
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(i, 1)}
                    disabled={i === shots.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShots((p) => p.filter((_, j) => j !== i))}
                    disabled={shots.length === 1}
                    aria-label="Remove shot"
                  >
                    <Trash2 />
                  </Button>
                </div>
                <Input
                  value={shot.description}
                  onChange={(e) => patch(i, { description: e.target.value })}
                  placeholder="One line for the card"
                  className="h-8"
                />
                <Textarea
                  value={shot.prompt}
                  onChange={(e) => patch(i, { prompt: e.target.value })}
                  placeholder="First frame: subject, framing, light, style"
                  rows={2}
                  className="text-sm"
                />
                <Input
                  value={shot.motion}
                  onChange={(e) => patch(i, { motion: e.target.value })}
                  placeholder="Motion: camera move and action"
                  className="h-8"
                />
                {cast.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-muted-foreground">
                      Cast
                    </span>
                    {cast.map((entry) => {
                      const on = shot.cast?.includes(entry.id) ?? false
                      const full = (shot.cast?.length ?? 0) >= MAX_SHOT_REFS
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          aria-pressed={on}
                          disabled={!on && full}
                          onClick={() =>
                            patch(i, {
                              cast: on
                                ? shot.cast?.filter((id) => id !== entry.id)
                                : [...(shot.cast ?? []), entry.id],
                              // leaving the cast ends a packshot of it
                              ...(on &&
                                shot.packshot === entry.id && {
                                  packshot: null,
                                }),
                            })
                          }
                          className={cn(
                            'flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs transition-colors disabled:opacity-40',
                            on
                              ? 'border-primary/60 bg-primary/10 text-foreground'
                              : 'border-border text-muted-foreground hover:text-foreground',
                          )}
                          title={
                            entry.imageUrl
                              ? 'Has a reference image'
                              : 'No reference image — text only'
                          }
                        >
                          {entry.imageUrl ? (
                            <img
                              src={entry.imageUrl}
                              alt=""
                              className="h-5 w-5 rounded-full object-cover"
                            />
                          ) : (
                            <span className="h-5 w-5 rounded-full bg-muted" />
                          )}
                          {entry.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                {(() => {
                  // products already cut out can be placed as they are
                  const cutouts = cast.filter(
                    (e) => e.kind === 'product' && e.cutout && e.imageUrl,
                  )
                  if (cutouts.length === 0) return null
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs text-muted-foreground">
                        Packshot
                      </span>
                      {cutouts.map((entry) => {
                        const on = shot.packshot === entry.id
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              patch(i, {
                                packshot: on ? null : entry.id,
                                cast: on
                                  ? shot.cast
                                  : shot.cast?.includes(entry.id)
                                    ? shot.cast
                                    : [entry.id, ...(shot.cast ?? [])],
                              })
                            }
                            className={cn(
                              'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                              on
                                ? 'border-primary/60 bg-primary/10 text-foreground'
                                : 'border-border text-muted-foreground hover:text-foreground',
                            )}
                            title="Place the cut-out exactly as it is on a set generated from this shot's prompt"
                          >
                            {entry.name} on set
                          </button>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            ))}

            {shots.length < MAX_SHOTS && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setShots((p) => [
                    ...p,
                    {
                      title: `Shot ${p.length + 1}`,
                      description: '',
                      durationSec: 5,
                      prompt: '',
                      motion: '',
                      cast: [],
                    },
                  ])
                }
              >
                <Plus /> Add shot
              </Button>
            )}
          </div>

          <DialogFooter className="items-center border-t border-border px-6 py-4 sm:justify-between">
            <p className="text-xs text-muted-foreground">
              est. {formatUsd(totals.draftUsd)} draft /{' '}
              {formatUsd(totals.finalUsd)} final
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={!valid || production.updatePlan.isPending}
              >
                Save plan
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
