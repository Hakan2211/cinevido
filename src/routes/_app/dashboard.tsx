/**
 * Home — "What are we making today?"
 *
 * One prompt box that starts a production: it creates a project, hands the
 * brief to the Director and opens the Studio. Recipe chips open a short form
 * instead (src/lib/recipes.ts): the project then starts with the recipe's
 * format, budget and a seeded Project Bible (a product or artist photo
 * becomes the reference image), and the Director gets a structured brief.
 * Below sit recent projects and recent single creations.
 */

import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowRight,
  Clapperboard,
  Film,
  Loader2,
  Monitor,
  Music2,
  Play,
  ShoppingBag,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GalleryItem } from '@/components/dashboard'
import { BRIEF_STORAGE_PREFIX } from '@/components/studio/ChatPanel'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FrameSlot } from '@/components/generate/FrameSlot'
import { ImagePickerDialog } from '@/components/generate/ImagePickerDialog'
import { cn } from '@/lib/utils'
import {
  RECIPES,
  recipeBible,
  recipeProjectName,
  recipeReady,
} from '@/lib/recipes'
import type { Recipe, RecipeValues } from '@/lib/recipes'
import type { SlotImage } from '@/components/generate/FrameSlot'

export const Route = createFileRoute('/_app/dashboard')({
  component: HomePage,
})

const FORMATS = [
  { id: '16:9', label: '16:9', width: 1920, height: 1080 },
  { id: '9:16', label: '9:16', width: 1080, height: 1920 },
  { id: '1:1', label: '1:1', width: 1080, height: 1080 },
] as const
type FormatId = (typeof FORMATS)[number]['id']

const RECIPE_ICONS: Record<string, typeof ShoppingBag> = {
  'product-ad': ShoppingBag,
  explainer: Monitor,
  'music-video': Music2,
  'social-short': Smartphone,
  trailer: Clapperboard,
}

/** "a 30-second ad for a coffee brand…" → "30-second ad for a coffee brand" */
function projectNameFrom(brief: string): string {
  const words = brief
    .replace(/\[[^\]]*\]/g, '')
    .replace(/^(an?|the|make|create)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ')
    .replace(/[.,:;!?]+$/, '')
  return (
    (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, 80) ||
    'Untitled project'
  )
}

function HomePage() {
  const navigate = useNavigate()
  const [brief, setBrief] = useState('')
  const [format, setFormat] = useState<FormatId>('16:9')
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [values, setValues] = useState<RecipeValues>({})
  const [images, setImages] = useState<Record<string, SlotImage | undefined>>({})
  const [picking, setPicking] = useState<string | null>(null)

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'recent'],
    queryFn: async () => {
      const { listProjectsFn } = await import('@/server/project.server')
      return listProjectsFn({ data: { limit: 4 } })
    },
  })

  const { data: creations, isLoading: creationsLoading } = useQuery({
    queryKey: ['dashboard', 'recentCreations'],
    queryFn: async () => {
      const { getRecentCreationsFn } = await import('@/server/dashboard.server')
      return getRecentCreationsFn()
    },
    staleTime: 1000 * 60 * 2,
  })

  const create = useMutation({
    mutationFn: async (input: {
      text: string
      name: string
      format: FormatId
      budgetUsd?: number
      bible?: ReturnType<typeof recipeBible>
    }) => {
      const size = FORMATS.find((f) => f.id === input.format) ?? FORMATS[0]
      const { createProjectFn } = await import('@/server/project.server')
      return createProjectFn({
        data: {
          name: input.name,
          width: size.width,
          height: size.height,
          budgetUsd: input.budgetUsd,
          bible: input.bible && {
            style: input.bible.style,
            entries: input.bible.entries.map((e) => ({
              kind: e.kind ?? 'character',
              name: e.name,
              description: e.description ?? '',
              imageUrl: e.imageUrl,
              assetId: e.assetId,
            })),
          },
        },
      })
    },
    onSuccess: (project, { text }) => {
      sessionStorage.setItem(`${BRIEF_STORAGE_PREFIX}${project.id}`, text)
      navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = () => {
    if (create.isPending) return
    if (recipe) {
      if (!recipeReady(recipe, values)) return
      create.mutate({
        text: recipe.brief(values),
        name: recipeProjectName(recipe, values),
        format: recipe.format,
        budgetUsd: recipe.budgetUsd,
        bible: recipeBible(recipe, values, images),
      })
      return
    }
    const text = brief.trim()
    if (!text) return
    create.mutate({ text, name: projectNameFrom(text), format })
  }

  const openRecipe = (r: Recipe) => {
    setRecipe(r)
    setValues({})
    setImages({})
  }
  const canCreate = recipe ? recipeReady(recipe, values) : !!brief.trim()

  const projects = projectsData?.projects ?? []

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Hero prompt */}
      <section className="mx-auto max-w-3xl pt-6 pb-14 md:pt-14">
        <h1 className="text-center text-4xl font-medium tracking-tight md:text-5xl">
          What are we making today?
        </h1>

        <div className="mt-10 rounded-2xl border border-border bg-card p-4 shadow-2xl shadow-black/40 focus-within:border-muted-foreground/50 transition-colors">
          {recipe ? (
            <RecipeForm
              recipe={recipe}
              values={values}
              images={images}
              onChange={(id, v) => setValues((prev) => ({ ...prev, [id]: v }))}
              onPick={setPicking}
              onClearImage={(id) => setImages((prev) => ({ ...prev, [id]: undefined }))}
              onClose={() => setRecipe(null)}
              onSubmit={handleCreate}
            />
          ) : (
          <div className="flex gap-3">
            <Sparkles className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
              placeholder="Describe your idea in a few words…"
              rows={3}
              className="min-h-[84px] w-full resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          )}
          <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
            {recipe ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {recipe.format} · {recipe.lengthSec}s · budget ${recipe.budgetUsd}
              </span>
            ) : (
            <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors',
                    format === f.id
                      ? 'bg-secondary text-foreground ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            )}
            <span className="hidden text-xs text-muted-foreground sm:block">
              The Director plans it — nothing renders until you approve.
            </span>
            <Button
              className="ml-auto"
              onClick={handleCreate}
              disabled={!canCreate || create.isPending}
            >
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              Create
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {RECIPES.map((r) => {
            const Icon = RECIPE_ICONS[r.id] ?? Sparkles
            const active = recipe?.id === r.id
            return (
              <button
                key={r.id}
                onClick={() => (active ? setRecipe(null) : openRecipe(r))}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm text-foreground/90 transition-colors hover:border-muted-foreground/60 hover:bg-accent',
                  active ? 'border-primary/70' : 'border-border',
                )}
              >
                <Icon className="h-4 w-4 text-primary" />
                {r.label}
              </button>
            )
          })}
        </div>

        <ImagePickerDialog
          open={!!picking}
          onOpenChange={(o) => !o && setPicking(null)}
          title="Reference photo"
          onPick={([img]) => {
            if (img && picking) setImages((prev) => ({ ...prev, [picking]: img }))
          }}
        />
      </section>

      {/* Recent projects */}
      {(projectsLoading || projects.length > 0) && (
        <section className="pb-12">
          <SectionHeader title="Recent projects" to="/projects" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {projectsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-video rounded-xl" />
                ))
              : projects.map((p) => (
                  <Link
                    key={p.id}
                    to="/projects/$projectId"
                    params={{ projectId: p.id }}
                    className="group"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-card">
                      {p.thumbnailUrl ? (
                        <img
                          src={p.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-secondary to-background">
                          <Film className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                      {p.duration > 0 && (
                        <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium tabular-nums">
                          {formatFrames(p.duration, p.fps)}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 truncate text-sm font-medium">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Edited{' '}
                      {formatDistanceToNow(new Date(p.updatedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </Link>
                ))}
          </div>
        </section>
      )}

      {/* Recent creations */}
      <section className="pb-12">
        <SectionHeader title="Recent creations" to="/library" />
        {creationsLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : creations && creations.items.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {creations.items.slice(0, 10).map((item) => (
              <GalleryItem key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            Nothing yet — describe an idea above, or open{' '}
            <Link
              to="/images"
              search={{ mode: 'generate' }}
              className="text-primary hover:underline"
            >
              Create
            </Link>{' '}
            to make a single image or clip.
          </p>
        )}
      </section>
    </div>
  )
}

function SectionHeader({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-medium">{title}</h2>
      <Link
        to={to}
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        View all
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

/** 900 frames at 30fps → "00:30" */
function formatFrames(frames: number, fps: number): string {
  const total = Math.round(frames / (fps || 30))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function RecipeForm({
  recipe,
  values,
  images,
  onChange,
  onPick,
  onClearImage,
  onClose,
  onSubmit,
}: {
  recipe: Recipe
  values: RecipeValues
  images: Record<string, SlotImage | undefined>
  onChange: (id: string, value: string) => void
  onPick: (fieldId: string) => void
  onClearImage: (fieldId: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const text = recipe.fields.filter((f) => f.kind !== 'image')
  const pics = recipe.fields.filter((f) => f.kind === 'image')
  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{recipe.label}</p>
          <p className="text-xs text-muted-foreground">{recipe.summary}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close recipe">
          <X />
        </Button>
      </div>
      <div className={cn('grid gap-4', pics.length > 0 && 'sm:grid-cols-[1fr_180px]')}>
        <div className="space-y-3">
          {text.map((f, i) => (
            <label key={f.id} className="block space-y-1">
              <span className="text-xs text-muted-foreground">
                {f.label}
                {f.required && <span className="text-primary"> *</span>}
              </span>
              {f.kind === 'textarea' ? (
                <Textarea
                  value={values[f.id] ?? ''}
                  onChange={(e) => onChange(f.id, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                  autoFocus={i === 0}
                  className="text-sm"
                />
              ) : (
                <Input
                  value={values[f.id] ?? ''}
                  onChange={(e) => onChange(f.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      onSubmit()
                    }
                  }}
                  placeholder={f.placeholder}
                  autoFocus={i === 0}
                  maxLength={200}
                />
              )}
            </label>
          ))}
        </div>
        {pics.length > 0 && (
          <div className="space-y-3">
            {pics.map((f) => (
              <div key={f.id} className="space-y-1">
                <FrameSlot
                  image={images[f.id] ?? null}
                  label={f.label}
                  optional
                  aspect="square"
                  onPick={() => onPick(f.id)}
                  onClear={() => onClearImage(f.id)}
                />
                <p className="text-xs text-muted-foreground">{f.placeholder}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
