/**
 * Recipes — Home's starting points as real workflows.
 *
 * A recipe is a short form (what the product is, who it's for, a photo…)
 * that turns into a ready project: the right format and budget, a Project
 * Bible seeded with the subject (and its photo as the reference image), and
 * a structured brief that tells the Director the shot pattern to follow.
 * The Director then plans it; nothing renders until the user approves.
 *
 * Pure data + string building; shared by client and server.
 */

import type { BibleEntryInput, BibleKind } from './bible'

export type RecipeFormat = '16:9' | '9:16' | '1:1'

export interface RecipeField {
  id: string
  label: string
  placeholder: string
  kind: 'text' | 'textarea' | 'image'
  required?: boolean
  /** for image fields: which Bible entry the photo becomes */
  bible?: {
    kind: BibleKind
    /** text field that names the entry */
    nameFrom: string
    fallbackName: string
    /** text field that describes its look */
    describeFrom?: string
  }
}

export interface Recipe {
  id: string
  label: string
  /** one line under the form title */
  summary: string
  format: RecipeFormat
  lengthSec: number
  budgetUsd: number
  fields: Array<RecipeField>
  /** visual style seeded into the Bible */
  style: (v: RecipeValues) => string
  /** the brief handed to the Director */
  brief: (v: RecipeValues) => string
}

export type RecipeValues = Record<string, string>

const val = (v: RecipeValues, id: string) => v[id]?.trim() ?? ''
const opt = (label: string, value: string) =>
  value ? `${label}: ${value}.` : ''
const lines = (...parts: Array<string>) => parts.filter(Boolean).join('\n')

export const RECIPES: Array<Recipe> = [
  {
    id: 'product-ad',
    label: 'Product ad',
    summary: '30s · 6 shots · voiceover and music',
    format: '16:9',
    lengthSec: 30,
    budgetUsd: 10,
    fields: [
      {
        id: 'product',
        label: 'Product',
        placeholder: 'Ember, a small-batch cold brew',
        kind: 'text',
        required: true,
      },
      {
        id: 'photo',
        label: 'Product photo',
        placeholder: 'Keeps the product the same in every shot',
        kind: 'image',
        bible: {
          kind: 'product',
          nameFrom: 'product',
          fallbackName: 'The product',
          describeFrom: 'look',
        },
      },
      {
        id: 'look',
        label: 'What it looks like',
        placeholder: 'Matte black can, copper ring, white serif logo',
        kind: 'text',
      },
      {
        id: 'mood',
        label: 'Mood',
        placeholder: 'Warm, slow mornings',
        kind: 'text',
      },
      {
        id: 'tagline',
        label: 'Tagline',
        placeholder: 'Wake up slower.',
        kind: 'text',
      },
    ],
    style: (v) =>
      `Premium commercial photography, ${val(v, 'mood') || 'warm natural light'}, shallow depth of field, clean uncluttered sets`,
    brief: (v) =>
      lines(
        `A 30-second product ad for ${val(v, 'product')}.`,
        opt('Mood', val(v, 'mood')),
        'Six shots of 5 seconds: 1 a hook that sets the world, 2 the moment of need, 3 and 4 the product in use, 5 a macro detail of the product, 6 a clean hero packshot with space for the tagline.',
        'The product is in the Project Bible — put it in the cast of every shot it appears in.',
        val(v, 'tagline')
          ? `A short voiceover that ends on the tagline "${val(v, 'tagline')}". Music that fits the mood.`
          : 'A short voiceover and music that fits the mood.',
      ),
  },
  {
    id: 'explainer',
    label: 'Explainer',
    summary: '60s · one idea per shot · calm narration',
    format: '16:9',
    lengthSec: 60,
    budgetUsd: 15,
    fields: [
      {
        id: 'topic',
        label: 'Topic',
        placeholder: 'How heat pumps warm a home',
        kind: 'text',
        required: true,
      },
      {
        id: 'audience',
        label: 'For',
        placeholder: 'Homeowners, no jargon',
        kind: 'text',
      },
      {
        id: 'points',
        label: 'Key points',
        placeholder: 'One per line',
        kind: 'textarea',
      },
    ],
    style: () =>
      'Clean editorial illustration look, soft daylight, simple shapes, generous negative space, consistent muted palette',
    brief: (v) =>
      lines(
        `A 60-second explainer about ${val(v, 'topic')}.`,
        opt('Audience', val(v, 'audience')),
        val(v, 'points')
          ? `Cover these points in order:\n${val(v, 'points')}`
          : '',
        'One idea per shot, each a simple visual metaphor; no text in frame. A calm, clear voiceover carries the explanation; light background music.',
      ),
  },
  {
    id: 'music-video',
    label: 'Music video',
    summary: '30s · cuts on the beat · instrumental score',
    format: '16:9',
    lengthSec: 30,
    budgetUsd: 10,
    fields: [
      {
        id: 'genre',
        label: 'Genre',
        placeholder: 'Dreamy synth-pop, 100 BPM',
        kind: 'text',
        required: true,
      },
      {
        id: 'theme',
        label: 'About',
        placeholder: 'Driving home through a neon city',
        kind: 'text',
      },
      {
        id: 'artist',
        label: 'Artist photo',
        placeholder: 'Keeps the performer the same in every shot',
        kind: 'image',
        bible: {
          kind: 'character',
          nameFrom: 'artistName',
          fallbackName: 'The artist',
        },
      },
      {
        id: 'artistName',
        label: 'Artist name',
        placeholder: 'Nova',
        kind: 'text',
      },
    ],
    style: (v) =>
      `Cinematic music video, ${val(v, 'theme') ? 'moody night palette' : 'dreamlike colour grade'}, anamorphic lens flares, rich contrast`,
    brief: (v) =>
      lines(
        `A 30-second music video, ${val(v, 'genre')}.`,
        opt('About', val(v, 'theme')),
        'Short shots that cut on the beat, dreamlike and cinematic; mix performance and story moments.',
        val(v, 'artistName') || val(v, 'artist')
          ? 'The artist is in the Project Bible — put them in the cast of every performance shot.'
          : '',
        `Music: an instrumental ${val(v, 'genre')} track. No voiceover.`,
      ),
  },
  {
    id: 'social-short',
    label: 'Social short',
    summary: '15s vertical · hook in the first second',
    format: '9:16',
    lengthSec: 15,
    budgetUsd: 5,
    fields: [
      {
        id: 'subject',
        label: 'Subject',
        placeholder: 'Our new pistachio croissant',
        kind: 'text',
        required: true,
      },
      {
        id: 'hook',
        label: 'Hook',
        placeholder: 'The flakiest thing in town',
        kind: 'text',
      },
      {
        id: 'photo',
        label: 'Photo of it',
        placeholder: 'Optional — keeps it the same in every shot',
        kind: 'image',
        bible: {
          kind: 'product',
          nameFrom: 'subject',
          fallbackName: 'The subject',
        },
      },
    ],
    style: () =>
      'Bold, punchy social video look, bright saturated colour, close framing, crisp detail',
    brief: (v) =>
      lines(
        `A 15-second vertical short about ${val(v, 'subject')}.`,
        opt('Hook', val(v, 'hook')),
        'Three 5-second shots: a striking hook in the first second, the payoff, a strong closing image. Fast camera moves, punchy pacing. Upbeat music, no voiceover.',
        val(v, 'photo')
          ? 'The subject is in the Project Bible — put it in the cast of every shot.'
          : '',
      ),
  },
  {
    id: 'trailer',
    label: 'Trailer',
    summary: '45s · slow build · dramatic reveal',
    format: '16:9',
    lengthSec: 45,
    budgetUsd: 15,
    fields: [
      {
        id: 'story',
        label: 'Story',
        placeholder: 'A lighthouse keeper finds a signal from the deep',
        kind: 'textarea',
        required: true,
      },
      {
        id: 'hero',
        label: 'Main character',
        placeholder: 'Ines, 60s, weathered, yellow oilskin coat',
        kind: 'text',
      },
      {
        id: 'heroPhoto',
        label: 'Character reference',
        placeholder: 'Optional — the same face in every shot',
        kind: 'image',
        bible: {
          kind: 'character',
          nameFrom: 'heroName',
          fallbackName: 'The hero',
          describeFrom: 'hero',
        },
      },
      {
        id: 'heroName',
        label: 'Character name',
        placeholder: 'Ines',
        kind: 'text',
      },
      { id: 'title', label: 'Title', placeholder: 'Deep Signal', kind: 'text' },
    ],
    style: () =>
      'Cinematic film still, anamorphic 2.39 framing feel, desaturated teal and amber grade, atmospheric haze, film grain',
    brief: (v) =>
      lines(
        `A 45-second trailer for: ${val(v, 'story')}`,
        opt('Title', val(v, 'title')),
        'Slow build, rising tension, a dramatic reveal near the end, close on the title.',
        val(v, 'hero') || val(v, 'heroPhoto')
          ? 'The main character is in the Project Bible — put them in the cast of every shot they appear in.'
          : '',
        'A sparse, dramatic voiceover and a cinematic score.',
      ),
  },
]

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id)
}

export function recipeReady(recipe: Recipe, values: RecipeValues): boolean {
  return recipe.fields.every((f) => !f.required || val(values, f.id))
}

/**
 * The Bible a recipe starts with. Image fields become entries with the
 * photo as reference; a description comes from the matching text field
 * (the product's look, the hero's description) when there is one.
 */
export function recipeBible(
  recipe: Recipe,
  values: RecipeValues,
  images: Record<string, { url: string; assetId?: string } | undefined>,
): {
  style: string
  entries: Array<BibleEntryInput & { imageUrl?: string; assetId?: string }>
} {
  const entries: Array<
    BibleEntryInput & { imageUrl?: string; assetId?: string }
  > = []
  for (const f of recipe.fields) {
    if (f.kind !== 'image' || !f.bible) continue
    const image = images[f.id]
    const name = val(values, f.bible.nameFrom) || f.bible.fallbackName
    const description = f.bible.describeFrom
      ? val(values, f.bible.describeFrom)
      : ''
    // an entry is worth having with a photo, or with words to draw from
    if (!image && !description) continue
    entries.push({
      name: name.slice(0, 60),
      kind: f.bible.kind,
      description,
      ...(image ? { imageUrl: image.url, assetId: image.assetId } : {}),
    })
  }
  return { style: recipe.style(values), entries }
}

/** "Ember, a small-batch cold brew" → "Product ad · Ember" */
export function recipeProjectName(
  recipe: Recipe,
  values: RecipeValues,
): string {
  const first = recipe.fields.find((f) => f.required)
  const subject = first
    ? val(values, first.id)
        .split(/[,.\n]/)[0]
        .trim()
    : ''
  return `${recipe.label}${subject ? ` · ${subject}` : ''}`.slice(0, 80)
}
