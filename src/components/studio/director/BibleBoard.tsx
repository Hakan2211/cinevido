/**
 * Project Bible tab: the style every still carries, the narrator voice, and
 * the cast — characters, products and places with reference images. Shots
 * that name a cast member with an image render their still from it, so the
 * same face and product appear in every shot.
 *
 * Edits are local until Save. Generate saves first, then makes a reference
 * portrait from the entry's description (priced on the button).
 */

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Segmented } from '@/components/generate/Field'
import { ImagePickerDialog } from '@/components/generate/ImagePickerDialog'
import { cn } from '@/lib/utils'
import { formatUsd } from '@/lib/pricing'
import {
  BIBLE_KINDS,
  MAX_BIBLE_ENTRIES,
  newEntryId,
  referenceCost,
} from '@/lib/bible'
import { TTS_VOICES } from '@/server/services/types'
import { bibleToInput } from './useBible'
import type { BibleEntry, ProjectBible } from '@/lib/bible'
import type { ProductionPlan } from '@/lib/production'
import type { BibleState } from './useBible'

const NO_VOICE = '__default'

export function BibleBoard({
  bible: state,
  plan,
}: {
  bible: BibleState
  plan: ProductionPlan | null
}) {
  const saved = state.bible
  const [draft, setDraft] = useState<ProjectBible | null>(saved)
  const [picking, setPicking] = useState<string | null>(null)

  // take the server's copy whenever it changes and nothing is unsaved here;
  // a reference finishing only touches `pending` / the image, so merge those
  const savedJson = JSON.stringify(saved)
  const [base, setBase] = useState(savedJson)
  useEffect(() => {
    if (!saved) return
    setDraft((prev) => {
      if (!prev || JSON.stringify(prev) === base) return saved
      return {
        ...prev,
        entries: prev.entries.map((e) => {
          const s = saved.entries.find((x) => x.id === e.id)
          return s
            ? {
                ...e,
                pending: s.pending,
                imageUrl: s.imageUrl ?? e.imageUrl,
                assetId: s.assetId ?? e.assetId,
              }
            : e
        }),
      }
    })
    setBase(savedJson)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedJson])

  const dirty = useMemo(
    () =>
      !!draft &&
      !!saved &&
      JSON.stringify(bibleToInput(draft)) !==
        JSON.stringify(bibleToInput(saved)),
    [draft, saved],
  )

  // how many shots each entry is in
  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of plan?.shots ?? [])
      for (const id of s.cast ?? []) m.set(id, (m.get(id) ?? 0) + 1)
    return m
  }, [plan])

  if (state.error && !draft) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-destructive">
        Couldn't load the Bible: {state.error.message}
      </div>
    )
  }

  if (state.isLoading || !draft) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const patch = (p: Partial<ProjectBible>) => setDraft({ ...draft, ...p })
  const patchEntry = (id: string, p: Partial<BibleEntry>) =>
    patch({
      entries: draft.entries.map((e) => (e.id === id ? { ...e, ...p } : e)),
    })

  const save = () => state.save.mutate(bibleToInput(draft))
  const generate = (id: string) => {
    if (!dirty) return state.generate.mutate(id)
    state.save.mutate(bibleToInput(draft), {
      onSuccess: () => state.generate.mutate(id),
    })
  }
  const valid = draft.entries.every((e) => e.name.trim())
  const refPrice = formatUsd(referenceCost())

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-4 border-b border-border px-6 py-4">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">Project Bible</h2>
          <p className="text-sm text-muted-foreground">
            What stays the same in every shot. Shots that feature someone with a
            reference image start from that image.
          </p>
        </div>
        <Button
          onClick={save}
          variant={dirty ? 'default' : 'secondary'}
          disabled={!dirty || !valid || state.save.isPending}
        >
          {state.save.isPending && <Loader2 className="animate-spin" />}
          {dirty ? 'Save Bible' : 'Saved'}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[320px_1fr]">
          {/* style + voice */}
          <section className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Visual style</span>
              <Textarea
                value={draft.style}
                onChange={(e) => patch({ style: e.target.value })}
                placeholder="35mm film, warm tungsten grade, shallow depth of field, soft haze"
                rows={4}
                maxLength={400}
                className="text-sm"
              />
              <span className="block text-xs text-muted-foreground">
                Added to every still the Director renders.
              </span>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Narrator voice</span>
              <Select
                value={draft.voice ?? NO_VOICE}
                onValueChange={(v) =>
                  patch({ voice: v === NO_VOICE ? undefined : v })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VOICE}>Default (Rachel)</SelectItem>
                  {TTS_VOICES.map((v) => (
                    <SelectItem key={v.name} value={v.name}>
                      {v.name}{' '}
                      <span className="text-muted-foreground">
                        · {v.description}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="block text-xs text-muted-foreground">
                Used for the plan's voiceover.
              </span>
            </label>
          </section>

          {/* cast */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">
                Cast{' '}
                <span className="text-muted-foreground">
                  · characters, products, places
                </span>
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={draft.entries.length >= MAX_BIBLE_ENTRIES}
                onClick={() =>
                  patch({
                    entries: [
                      ...draft.entries,
                      {
                        id: newEntryId(),
                        kind: 'character',
                        name: '',
                        description: '',
                      },
                    ],
                  })
                }
              >
                <Plus /> Add
              </Button>
            </div>

            {draft.entries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                No cast yet. Add the people, products or places that recur — or
                ask the Director, it fills this in from the brief.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {draft.entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    shots={usage.get(entry.id) ?? 0}
                    refPrice={refPrice}
                    generating={
                      entry.pending?.status === 'running' ||
                      (state.generate.isPending &&
                        state.generate.variables === entry.id)
                    }
                    onChange={(p) => patchEntry(entry.id, p)}
                    onPick={() => setPicking(entry.id)}
                    onGenerate={() => generate(entry.id)}
                    onRemove={() =>
                      patch({
                        entries: draft.entries.filter((e) => e.id !== entry.id),
                      })
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <ImagePickerDialog
        open={!!picking}
        onOpenChange={(o) => !o && setPicking(null)}
        title="Reference image"
        onPick={([img]) => {
          if (img && picking)
            patchEntry(picking, { imageUrl: img.url, assetId: img.id })
        }}
      />
    </div>
  )
}

function EntryCard({
  entry,
  shots,
  refPrice,
  generating,
  onChange,
  onPick,
  onGenerate,
  onRemove,
}: {
  entry: BibleEntry
  shots: number
  refPrice: string
  generating: boolean
  onChange: (p: Partial<BibleEntry>) => void
  onPick: () => void
  onGenerate: () => void
  onRemove: () => void
}) {
  const failed =
    entry.pending?.status === 'failed' ? entry.pending.error : undefined
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="group relative aspect-square bg-muted">
        {entry.imageUrl ? (
          <>
            <img
              src={entry.imageUrl}
              alt={entry.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex gap-1.5 bg-background/80 p-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={onPick}
              >
                Change
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() =>
                  onChange({ imageUrl: undefined, assetId: undefined })
                }
                aria-label="Remove reference image"
              >
                <X />
              </Button>
            </div>
          </>
        ) : generating ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Generating reference…
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
            <Button size="sm" variant="secondary" onClick={onPick}>
              <ImagePlus /> Pick or upload
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onGenerate}
              disabled={!entry.description.trim() || !entry.name.trim()}
              title={
                entry.description.trim() ? undefined : 'Describe the look first'
              }
            >
              <Sparkles /> Generate · ≈ {refPrice}
            </Button>
            {failed && (
              <p className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2">{failed}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <Input
            value={entry.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Name"
            maxLength={60}
            className={cn(
              'h-8 flex-1',
              !entry.name.trim() && 'border-destructive/60',
            )}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={`Remove ${entry.name || 'entry'}`}
          >
            <Trash2 />
          </Button>
        </div>
        <Segmented
          size="sm"
          options={BIBLE_KINDS.map((k) => ({ value: k.id, label: k.label }))}
          value={entry.kind}
          onChange={(kind) => onChange({ kind })}
        />
        <Textarea
          value={entry.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={
            entry.kind === 'character'
              ? 'Woman in her 30s, short black hair, rust linen shirt'
              : entry.kind === 'product'
                ? 'Matte black 250ml bottle, gold cap, white serif label'
                : 'Small corner café, tiled floor, morning light'
          }
          rows={3}
          maxLength={400}
          className="text-sm"
        />
        <p className="mt-auto text-xs text-muted-foreground">
          {shots > 0
            ? `In ${shots} shot${shots > 1 ? 's' : ''}`
            : 'Not in any shot yet'}
          {!entry.imageUrl && ' · no reference, text only'}
        </p>
      </div>
    </article>
  )
}
