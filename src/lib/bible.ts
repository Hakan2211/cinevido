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
import { imageJobCost } from './job-cost'
import {
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

export type StillRequest =
  | { mode: 'text'; prompt: string }
  | { mode: 'reference'; prompt: string; imageUrls: Array<string> }

/**
 * How a shot's still is made: text-to-image with the Bible's style, or —
 * when its cast has reference images — an edit of those references into
 * the shot, naming which image is who.
 */
export function stillRequest(
  bible: ProjectBible,
  shot: { prompt: string; cast?: Array<string> },
): StillRequest {
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
    })),
  }
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
      return {
        id,
        kind: e.kind,
        name: e.name.trim(),
        description: e.description.trim(),
        ...(e.imageUrl ? { imageUrl: e.imageUrl, assetId: e.assetId } : {}),
        // a reference still generating keeps going unless an image was picked
        ...(old?.pending && !e.imageUrl ? { pending: old.pending } : {}),
      }
    }),
  }
}
