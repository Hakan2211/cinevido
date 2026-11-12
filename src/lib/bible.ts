/**
 * Director v2 — the Project Bible.
 *
 * What stays the same across every shot of a production: the visual style,
 * the narrator's voice, and the cast (characters, products, places), each
 * with an optional reference image.
 *
 * A shot names its cast (`PlanShot.cast`, entry ids). When any of them has a
 * reference image, the shot's still is rendered by a multi-reference edit
 * model (`DIRECTOR_MODELS.referenceStill`) from those images instead of from
 * text alone, so the same face and the same product appear in every shot.
 * Draft and final then animate that still, as before.
 *
 * Stored as JSON on `Project.bible`. Shared by client and server.
 */

import { z } from 'zod'
import { editJobCost, imageJobCost } from './job-cost'
import {
  DEFAULT_MODELS,
  DIRECTOR_MODELS,
  EDIT_MODELS,
  TTS_VOICES,
} from '@/server/services/types'
import type { PlanStep } from './production'

export type BibleKind = 'character' | 'product' | 'place'

export const BIBLE_KINDS: ReadonlyArray<{ id: BibleKind; label: string }> = [
  { id: 'character', label: 'Character' },
  { id: 'product', label: 'Product' },
  { id: 'place', label: 'Place' },
]

export interface BibleEntry {
  id: string
  kind: BibleKind
  /** how shots refer to it: "Mara", "The bottle" */
  name: string
  /** the look in words, repeated into every still that features it */
  description: string
  /** the reference image fal sees */
  imageUrl?: string
  assetId?: string
  /** a reference portrait being generated (Bible tab → Generate) */
  pending?: PlanStep
  /** `pending` is a cut-out of the current image, not a new portrait */
  pendingCutout?: boolean
  /** the image is a transparent cut-out (background removed) */
  cutout?: boolean
  /** what the image was before it was cut out — "Undo cut-out" puts it back */
  uncut?: { imageUrl: string; assetId?: string }
}

export interface ProjectBible {
  version: 1
  /** one visual style for every still: "35mm film, warm grade, shallow focus" */
  style: string
  /** ElevenLabs voice name for the voiceover (TTS_VOICES) */
  voice?: string
  entries: Array<BibleEntry>
}

export const MAX_BIBLE_ENTRIES = 8

/** References one still may use — the edit model's limit, kept small */
export const MAX_SHOT_REFS = Math.min(
  4,
  EDIT_MODELS.find((m) => m.id === DIRECTOR_MODELS.referenceStill)?.maxImages ??
    4,
)

export function emptyBible(): ProjectBible {
  return { version: 1, style: '', entries: [] }
}

export function parseBible(json: string | null | undefined): ProjectBible {
  if (!json) return emptyBible()
  try {
    const bible = JSON.parse(json) as ProjectBible
    if (bible.version !== 1 || !Array.isArray(bible.entries))
      return emptyBible()
    return { ...emptyBible(), ...bible }
  } catch {
    return emptyBible()
  }
}

export function isVoice(name: string | undefined): name is string {
  return !!name && TTS_VOICES.some((v) => v.name === name)
}

export function newEntryId(): string {
  return `ref-${Math.random().toString(36).slice(2, 9)}`
}

const norm = (s: string) => s.trim().toLowerCase()

export function findEntry(
  bible: ProjectBible,
  name: string,
): BibleEntry | undefined {
  const n = norm(name)
  return bible.entries.find((e) => norm(e.name) === n)
}

export interface BibleEntryInput {
  name: string
  kind?: BibleKind
  description?: string
}

/**
 * Add or update entries by name (case-insensitive). Never touches a
 * reference image — only the user picks those.
 */
export function upsertEntries(
  bible: ProjectBible,
  inputs: Array<BibleEntryInput>,
): ProjectBible {
  const entries = bible.entries.map((e) => ({ ...e }))
  for (const input of inputs) {
    const name = input.name.trim().slice(0, 60)
    if (!name) continue
    const existing = entries.find((e) => norm(e.name) === norm(name))
    if (existing) {
      if (input.kind) existing.kind = input.kind
      if (input.description?.trim()) {
        existing.description = input.description.trim().slice(0, 400)
      }
      continue
    }
    if (entries.length >= MAX_BIBLE_ENTRIES) continue
    entries.push({
      id: newEntryId(),
      kind: input.kind ?? 'character',
      name,
      description: input.description?.trim().slice(0, 400) ?? '',
    })
  }
  return { ...bible, entries }
}

/** Names the Director wrote → entry ids; names it made up are dropped */
export function resolveCast(
  bible: ProjectBible,
  names: ReadonlyArray<string> | undefined,
): Array<string> {
  if (!names) return []
  const ids: Array<string> = []
  for (const name of names) {
    const entry = findEntry(bible, name)
    if (entry && !ids.includes(entry.id)) ids.push(entry.id)
  }
  return ids
}

/** The cast members of a shot that have a reference image, in cast order */
export function shotReferences(
  bible: ProjectBible,
  cast: ReadonlyArray<string> | undefined,
): Array<BibleEntry> {
  if (!cast?.length) return []
  return cast
    .map((id) => bible.entries.find((e) => e.id === id))
    .filter((e): e is BibleEntry => !!e?.imageUrl)
    .slice(0, MAX_SHOT_REFS)
}

function withStyle(prompt: string, style: string): string {
  const s = style.trim()
  if (!s) return prompt
  return `${prompt.replace(/[.\s]+$/, '')}. Style: ${s}`
}

/** The Director names a packshot subject; it must be a cast entry, not a place */
export function resolvePackshot(
  bible: ProjectBible,
  name: string,
): { id?: string; warning?: string } {
  const entry = findEntry(bible, name)
  if (!entry) {
    return {
      warning: `“${name}” is not in the Bible, so no packshot. Add it with updateBible first.`,
    }
  }
  if (entry.kind === 'place') {
    return {
      warning: `“${entry.name}” is a place — packshots place a product.`,
    }
  }
  if (!entry.cutout) {
    return {
      id: entry.id,
      warning: `“${entry.name}” has no cut-out yet, so that shot renders as a normal reference shot until the user presses Cut out on the Bible tab.`,
    }
  }
  return { id: entry.id }
}

/** The packshot's cut-out, when the shot has one and it is ready */
export function packshotEntry(
  bible: ProjectBible,
  shot: { packshot?: string },
): BibleEntry | undefined {
  if (!shot.packshot) return undefined
  const entry = bible.entries.find((e) => e.id === shot.packshot)
  return entry?.cutout && entry.imageUrl ? entry : undefined
}

/** A cut-out the still has to wait for (it is being made right now) */
export function waitingForCutout(
  bible: ProjectBible,
  shot: { cast?: Array<string>; packshot?: string },
): boolean {
  const ids = new Set([...(shot.cast ?? []), shot.packshot].filter(Boolean))
  return bible.entries.some(
    (e) => ids.has(e.id) && e.pendingCutout && e.pending?.status === 'running',
  )
}

export type StillRequest =
  | { mode: 'text'; prompt: string }
  | { mode: 'reference'; prompt: string; imageUrls: Array<string> }
  | { mode: 'packshot'; prompt: string; cutoutUrl: string }

/**
 * How a shot's still is made: text-to-image with the Bible's style, or —
 * when its cast has reference images — an edit of those references into
 * the shot, naming which image is who. A packshot generates only the set
 * and places the cut-out on it afterwards, untouched.
 */
export function stillRequest(
  bible: ProjectBible,
  shot: { prompt: string; cast?: Array<string>; packshot?: string },
): StillRequest {
  const pack = packshotEntry(bible, shot)
  if (pack) {
    return {
      mode: 'packshot',
      cutoutUrl: pack.imageUrl!,
      prompt: withStyle(
        `${shot.prompt.replace(/[.\s]+$/, '')}. Leave the centre of the frame empty: a clear surface where a product will stand. Do not show ${pack.name} or any other product, bottle, can or package`,
        bible.style,
      ),
    }
  }
  const refs = shotReferences(bible, shot.cast)
  const prompt = withStyle(shot.prompt, bible.style)
  if (refs.length === 0) return { mode: 'text', prompt }
  const who = refs
    .map((e, i) => {
      const what = e.description.trim() ? ` (${e.description.trim()})` : ''
      return `image ${i + 1} is ${e.name}${what}`
    })
    .join('; ')
  return {
    mode: 'reference',
    imageUrls: refs.map((e) => e.imageUrl!),
    prompt: `Reference images: ${who}. Keep ${refs.length > 1 ? 'their' : 'its'} exact appearance — face, build, clothing, shape, colours, labels. Compose a new frame, not a collage: ${prompt}`,
  }
}

/** Prompt for a reference portrait generated from an entry's description */
export function referencePrompt(
  bible: ProjectBible,
  entry: BibleEntry,
): string {
  const subject = entry.description.trim() || entry.name
  const framing =
    entry.kind === 'character'
      ? 'Character reference: one person, three-quarter view, head to waist, neutral expression, plain mid-grey studio background, soft even light'
      : entry.kind === 'product'
        ? 'Product reference: the product alone, centred, three-quarter view, plain light-grey seamless background, soft studio light, labels sharp'
        : 'Location reference: a wide establishing view, no people'
  return withStyle(`${framing}. ${subject}`, bible.style)
}

/** What the model sees of the Bible */
export function summarizeBible(bible: ProjectBible) {
  return {
    style: bible.style || undefined,
    voice: bible.voice,
    cast: bible.entries.map((e) => ({
      name: e.name,
      kind: e.kind,
      description: e.description,
      hasReferenceImage: !!e.imageUrl,
      ...(e.cutout && { cutOut: true }),
    })),
  }
}

// =============================================================================
// Cut-outs — the reference with its background removed
// =============================================================================

/** The model that cuts a reference out: Seedream 5.5 Edit, transparent PNG */
export const CUTOUT_MODEL = DEFAULT_MODELS.layerEdit

/** What "Cut out" costs: one output at the 2K rate plus one reference */
export function cutoutCost(): number {
  return editJobCost(CUTOUT_MODEL, { imageUrls: ['ref'] }) ?? 0
}

export function cutoutPrompt(entry: Pick<BibleEntry, 'kind' | 'name'>): string {
  const what =
    entry.kind === 'character'
      ? 'the person, head to toe as far as visible, including hair and clothing'
      : entry.kind === 'product'
        ? 'the product, including its cap, label and every printed detail'
        : 'the main subject'
  return `Cut out ${what} (${entry.name}). Remove the background completely so it is transparent. Keep the subject exactly as it is — shape, colours, text, lighting, size and position unchanged. No shadow, no new objects.`
}

/** Can this entry be cut out right now? */
export function canCutOut(entry: BibleEntry): boolean {
  return (
    !!entry.imageUrl &&
    !entry.cutout &&
    entry.kind !== 'place' &&
    entry.pending?.status !== 'running'
  )
}

export function bibleIsEmpty(bible: ProjectBible): boolean {
  return !bible.style.trim() && !bible.voice && bible.entries.length === 0
}

/** Size of a generated reference portrait */
export const REFERENCE_SIZE = { width: 1024, height: 1024 } as const

/** What Generate on a Bible entry costs (the Director's still model, 1MP) */
export function referenceCost(): number {
  return imageJobCost(DIRECTOR_MODELS.still, REFERENCE_SIZE) ?? 0
}

// =============================================================================
// Input from the client (Bible tab, recipes)
// =============================================================================

const voiceNames = TTS_VOICES.map((v) => v.name) as [string, ...Array<string>]

export const bibleEntrySchema = z.object({
  id: z.string().max(40).optional(),
  kind: z.enum(['character', 'product', 'place']),
  name: z.string().trim().min(1).max(60),
  description: z.string().max(400),
  imageUrl: z.string().url().max(2000).optional(),
  assetId: z.string().max(40).optional(),
})

export const bibleInputSchema = z.object({
  style: z.string().max(400),
  voice: z.enum(voiceNames).optional(),
  entries: z.array(bibleEntrySchema).max(MAX_BIBLE_ENTRIES),
})

export type BibleInput = z.infer<typeof bibleInputSchema>

const ENTRY_ID = /^ref-[a-z0-9]{3,12}$/

/** A Bible from client input; keeps ids and in-flight references of `prev` */
export function bibleFromInput(
  input: BibleInput,
  prev?: ProjectBible,
): ProjectBible {
  const byId = new Map((prev?.entries ?? []).map((e) => [e.id, e]))
  const used = new Set<string>()
  return {
    version: 1,
    style: input.style.trim(),
    voice: isVoice(input.voice) ? input.voice : undefined,
    entries: input.entries.map((e) => {
      const old = e.id ? byId.get(e.id) : undefined
      // a new entry may bring the id the client made for it (newEntryId)
      let id = old?.id ?? (e.id && ENTRY_ID.test(e.id) ? e.id : newEntryId())
      if (used.has(id)) id = newEntryId()
      used.add(id)
      // the cut-out state belongs to the image: a new image drops it
      const sameImage = !!e.imageUrl && e.imageUrl === old?.imageUrl
      // a cut-out belongs to the image it was asked for; a portrait keeps
      // going (or keeps its error) only while no image was picked
      const keepPending =
        !!old?.pending && (old.pendingCutout ? sameImage : !e.imageUrl)
      return {
        id,
        kind: e.kind,
        name: e.name.trim(),
        description: e.description.trim(),
        ...(e.imageUrl ? { imageUrl: e.imageUrl, assetId: e.assetId } : {}),
        ...(sameImage && old?.cutout ? { cutout: true } : {}),
        ...(sameImage && old?.uncut ? { uncut: old.uncut } : {}),
        ...(keepPending && {
          pending: old!.pending,
          ...(old!.pendingCutout && { pendingCutout: true }),
        }),
      }
    }),
  }
}
