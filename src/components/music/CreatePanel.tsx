/**
 * The Create rail of the Music lab.
 *
 * Order is engine → description → arrangement → lyrics → style → duration,
 * not description → style → duration → arrangement → lyrics: the words are the
 * second-most creative thing on the screen, and Arrangement is the switch that
 * reveals them, so the branch that decides what the rest of the rail contains
 * sits at the top and the sticky settings you set once sink below the thing you
 * retype every run.
 */

import { useState } from 'react'
import { Dices, Loader2, Music2, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Slider } from '../ui/slider'
import { ModelSelect } from '../ui/model-select'
import type { MusicModelConfig } from '../../server/services/types'

export interface MusicFormValues {
  model: string
  prompt: string
  lyrics: string
  instrumental: boolean
  /** omitted for engines that choose their own length */
  durationSec?: number
  seed?: number
  negativePrompt?: string
  title?: string
}

const LYRIC_TAGS = ['[verse]', '[chorus]', '[bridge]']
const DUET_SKELETON = '[verse - male]\n\n[verse - female]\n\n[chorus - both]\n'
const DURATION_PRESETS = [30, 60, 90, 180]

/** one click each — the styles people actually reach for */
const STYLE_CHIPS = [
  'cinematic',
  'lo-fi',
  'orchestral',
  'synthwave',
  'ambient',
  'hip hop',
  'rock',
  'jazz',
  'folk',
  'trailer',
  'upbeat',
  'melancholic',
]

interface CreatePanelProps {
  models: Array<MusicModelConfig>
  busy: boolean
  onGenerate: (values: MusicFormValues) => void
}

export function CreatePanel({ models, busy, onGenerate }: CreatePanelProps) {
  const [modelId, setModelId] = useState(models[0]?.id ?? '')
  const [prompt, setPrompt] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [instrumentalPref, setInstrumental] = useState(true)
  const [duration, setDuration] = useState(60)
  const [seed, setSeed] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [title, setTitle] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const model = models.find((m) => m.id === modelId) ?? models[0]
  const tagStyle = model?.promptStyle === 'tags'
  const canSing = model?.supportsLyrics ?? false
  /** MiniMax will not run without words, so the switch has nothing to offer */
  const mustSing = model?.requiresLyrics ?? false
  const canBeInstrumental = model?.supportsInstrumental ?? false
  const instrumental = mustSing ? false : instrumentalPref
  const vocals = !instrumental
  const showArrangement = (canSing || canBeInstrumental) && !mustSing
  const showLyrics = canSing && vocals

  const durationMode = model?.durationMode ?? 'slider'
  const minDuration = model?.minDurationSec ?? 10
  const maxDuration = model?.maxDurationSec ?? 240
  /** the engine you switched *to* may not reach the length you left behind */
  const boundedDuration = Math.min(maxDuration, Math.max(minDuration, duration))

  const lyricsMissing = mustSing && lyrics.trim().length === 0
  const canGenerate =
    !busy && prompt.trim().length > 0 && !!model && !lyricsMissing

  // the rail numbers what it actually shows, so hiding a step doesn't gap it
  let stepNo = 0
  const step = () => ++stepNo

  const fmt = (sec: number) =>
    `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

  const appendStyle = (style: string) => {
    setPrompt((p) => (p.trim() ? `${p.replace(/,\s*$/, '')}, ${style}` : style))
  }

  const insertLyricTag = (tag: string) => {
    setLyrics((l) => (l ? `${l}\n${tag}\n` : `${tag}\n`))
  }

  const submit = () => {
    if (!canGenerate || !model) return
    onGenerate({
      model: model.id,
      prompt: prompt.trim(),
      lyrics: showLyrics ? lyrics.trim() : '',
      instrumental,
      durationSec: durationMode === 'model' ? undefined : boundedDuration,
      seed:
        seed.trim() && !Number.isNaN(Number(seed)) ? Number(seed) : undefined,
      negativePrompt: negativePrompt.trim() || undefined,
      title: title.trim() || undefined,
    })
  }

  return (
    <aside className="flex w-[340px] shrink-0 flex-col gap-5 overflow-y-auto border-r p-4">
      <Step n={step()} label="Engine">
        <ModelSelect
          value={modelId}
          onValueChange={setModelId}
          models={models}
          showDescription
        />
        {model?.description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {model.description}
          </p>
        )}
      </Step>

      <Step n={step()} label={tagStyle ? 'Genre tags' : 'Description'}>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            tagStyle
              ? 'synthwave, driving bass, analog pads, 110 BPM'
              : 'A warm cinematic theme that swells into strings, hopeful and wide'
          }
          className="min-h-[92px] resize-none text-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {STYLE_CHIPS.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => appendStyle(style)}
              className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {style}
            </button>
          ))}
        </div>
      </Step>

      {showArrangement && (
        <Step n={step()} label="Arrangement">
          <div className="flex rounded-md border p-0.5">
            <SegButton
              active={instrumental}
              onClick={() => setInstrumental(true)}
              label="Instrumental"
              disabled={!canBeInstrumental}
            />
            <SegButton
              active={!instrumental}
              onClick={() => setInstrumental(false)}
              label="Vocals"
            />
          </div>
          {!canSing && vocals && (
            <p className="text-[11px] text-amber-500">
              {model?.name} writes its own vocal line — there is no lyrics box
              for it.
            </p>
          )}
        </Step>
      )}

      {showLyrics && (
        <Step n={step()} label={mustSing ? 'Lyrics (required)' : 'Lyrics'}>
          <Textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={'[verse]\nthe city hums awake\n\n[chorus]\n…'}
            className="min-h-[120px] resize-none font-mono text-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            {LYRIC_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertLyricTag(tag)}
                className="rounded border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {tag}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLyrics(DUET_SKELETON)}
              className="rounded border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              duet
            </button>
          </div>
          {lyricsMissing && (
            <p className="text-[11px] text-amber-500">
              {model?.name} needs words before it will run.
            </p>
          )}
        </Step>
      )}

      <Step n={step()} label="Length">
        {durationMode === 'model' ? (
          <p className="text-sm text-muted-foreground">
            {model?.name} chooses the length itself — up to {fmt(maxDuration)}.
          </p>
        ) : (
          <>
            <div className="flex gap-1.5">
              {DURATION_PRESETS.filter(
                (p) => p >= minDuration && p <= maxDuration,
              ).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDuration(preset)}
                  className={`flex-1 rounded border px-2 py-1 text-xs ${
                    boundedDuration === preset
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {fmt(preset)}
                </button>
              ))}
            </div>
            <Slider
              value={[boundedDuration]}
              min={minDuration}
              max={maxDuration}
              step={5}
              onValueChange={(v) => setDuration(v[0])}
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {fmt(boundedDuration)}
              {durationMode === 'cap' && (
                <span className="ml-1.5 normal-case">
                  at most — it may resolve the song earlier
                </span>
              )}
            </span>
          </>
        )}
      </Step>

      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {advancedOpen ? '− Advanced' : '+ Advanced'}
        </button>
        {advancedOpen && (
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Title (optional)</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Main theme"
                className="rounded border bg-background px-2 py-1 text-sm"
              />
            </label>

            {model?.supportsSeed && (
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Seed</span>
                <div className="flex gap-1">
                  <input
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="random"
                    className="flex-1 rounded border bg-background px-2 py-1 text-sm tabular-nums"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setSeed(String(Math.floor(Math.random() * 1_000_000)))
                    }
                    title="Roll a seed"
                  >
                    <Dices className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </label>
            )}

            {model?.supportsNegativePrompt && (
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Negative prompt</span>
                <input
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="low quality, distortion"
                  className="rounded border bg-background px-2 py-1 text-sm"
                />
              </label>
            )}
          </div>
        )}
      </div>

      <Button
        className="mt-auto w-full"
        onClick={submit}
        disabled={!canGenerate}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate track
          </>
        )}
      </Button>
    </aside>
  )
}

// =============================================================================
// Bits
// =============================================================================

function Step({
  n,
  label,
  children,
}: {
  n: number
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
          {n}
        </span>
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </h3>
      </div>
      {children}
    </section>
  )
}

function SegButton({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean
  onClick: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted disabled:opacity-40'
      }`}
    >
      <Music2 className="h-3 w-3" />
      {label}
    </button>
  )
}
