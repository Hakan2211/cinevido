/**
 * The Music tab of the Audio lab's settings panel.
 *
 * Order is engine → description → arrangement → lyrics → length: the engine
 * decides which of the rest exist (a model that cannot sing shows no lyrics
 * box, one with a fixed length no slider), so it sits at the top.
 */

import { useEffect, useState } from 'react'
import { Dices, Sparkles } from 'lucide-react'
import { estimateCost, formatEstimate } from '@/lib/pricing'
import {
  Field,
  FieldError,
  GenerateButton,
  LabPanel,
  ModelRadioList,
  PromptBox,
  Segmented,
} from '@/components/generate'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Slider } from '../ui/slider'
import type { MusicModelConfig } from '../../server/services/types'
import type { AudioPanelTabs } from './panel-tabs'

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
  'trailer',
  'upbeat',
  'melancholic',
]

const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

interface CreatePanelProps extends AudioPanelTabs {
  models: Array<MusicModelConfig>
  busy: boolean
  error?: string | null
  onGenerate: (values: MusicFormValues) => void
}

export function CreatePanel({
  models,
  busy,
  error,
  onGenerate,
  ...tabs
}: CreatePanelProps) {
  const [modelId, setModelId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [instrumentalPref, setInstrumental] = useState(true)
  const [duration, setDuration] = useState(60)
  const [seed, setSeed] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [title, setTitle] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // models arrive after the first render
  useEffect(() => {
    if (!modelId && models[0]) setModelId(models[0].id)
  }, [models, modelId])

  const model = models.find((m) => m.id === modelId) ?? models[0]
  const tagStyle = model?.promptStyle === 'tags'
  const canSing = model?.supportsLyrics ?? false
  /** MiniMax will not run without words, so the switch has nothing to offer */
  const mustSing = model?.requiresLyrics ?? false
  const canBeInstrumental = model?.supportsInstrumental ?? false
  const instrumental = mustSing ? false : instrumentalPref
  const showArrangement = (canSing || canBeInstrumental) && !mustSing
  const showLyrics = canSing && !instrumental

  const durationMode = model?.durationMode ?? 'slider'
  const minDuration = model?.minDurationSec ?? 10
  const maxDuration = model?.maxDurationSec ?? 240
  /** the engine you switched *to* may not reach the length you left behind */
  const boundedDuration = Math.min(maxDuration, Math.max(minDuration, duration))

  const lyricsMissing = mustSing && lyrics.trim().length === 0
  const canGenerate =
    !busy && prompt.trim().length > 0 && !!model && !lyricsMissing

  const costLabel = formatEstimate(
    estimateCost(model?.pricing, {
      durationSec:
        durationMode === 'model'
          ? (model?.defaultDurationSec ?? 60)
          : boundedDuration,
    }),
  )

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
    <LabPanel
      title="Generate Music"
      subtitle="Score a scene or lay a bed under a voiceover."
      {...tabs}
      footer={
        <GenerateButton
          label="Generate track"
          icon={Sparkles}
          busy={busy}
          busyLabel="Starting…"
          costLabel={costLabel}
          disabled={!canGenerate}
          onClick={submit}
          hint={
            durationMode === 'cap'
              ? 'Priced at the full length — it may finish earlier'
              : 'Billed to your fal account'
          }
        />
      }
    >
      <Field label="Engine">
        <ModelRadioList
          models={models}
          value={model?.id ?? ''}
          onChange={setModelId}
          footnote="Rates are fal's prices; length-billed engines scale with duration."
        />
      </Field>

      <Field label={tagStyle ? 'Genre tags' : 'Description'}>
        <PromptBox
          value={prompt}
          onChange={setPrompt}
          max={2000}
          rows={4}
          placeholder={
            tagStyle
              ? 'synthwave, driving bass, analog pads, 110 BPM'
              : 'A warm cinematic theme that swells into strings, hopeful and wide'
          }
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STYLE_CHIPS.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => appendStyle(style)}
              className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:text-foreground"
            >
              {style}
            </button>
          ))}
        </div>
      </Field>

      {showArrangement && (
        <Field label="Arrangement">
          <Segmented
            options={[
              {
                value: 'instrumental',
                label: 'Instrumental',
              },
              { value: 'vocals', label: 'Vocals' },
            ]}
            value={instrumental ? 'instrumental' : 'vocals'}
            onChange={(v) =>
              setInstrumental(v === 'instrumental' && canBeInstrumental)
            }
          />
          {!canSing && !instrumental && (
            <p className="mt-2 text-xs text-muted-foreground">
              {model?.name} writes its own vocal line — there is no lyrics box
              for it.
            </p>
          )}
        </Field>
      )}

      {showLyrics && (
        <Field label="Lyrics" hint={mustSing ? 'required' : undefined}>
          <Textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={'[verse]\nthe city hums awake\n\n[chorus]\n…'}
            className="min-h-[120px] resize-none font-mono text-xs"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...LYRIC_TAGS, 'duet'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  tag === 'duet'
                    ? setLyrics(DUET_SKELETON)
                    : insertLyricTag(tag)
                }
                className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
              >
                {tag}
              </button>
            ))}
          </div>
          {lyricsMissing && (
            <p className="mt-2 text-xs text-muted-foreground">
              {model?.name} needs words before it will run.
            </p>
          )}
        </Field>
      )}

      <Field
        label="Length"
        aside={
          durationMode !== 'model' && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {durationMode === 'cap' && 'up to '}
              {fmt(boundedDuration)}
            </span>
          )
        }
      >
        {durationMode === 'model' ? (
          <p className="text-sm text-muted-foreground">
            {model?.name} chooses the length itself — up to {fmt(maxDuration)}.
          </p>
        ) : (
          <>
            <Segmented
              size="sm"
              className="mb-3"
              options={DURATION_PRESETS.filter(
                (p) => p >= minDuration && p <= maxDuration,
              ).map((p) => ({ value: p, label: fmt(p) }))}
              value={boundedDuration}
              onChange={setDuration}
            />
            <Slider
              value={[boundedDuration]}
              min={minDuration}
              max={maxDuration}
              step={5}
              onValueChange={(v) => setDuration(v[0])}
            />
          </>
        )}
      </Field>

      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {advancedOpen ? '− Advanced' : '+ Advanced'}
        </button>
        {advancedOpen && (
          <div className="mt-3 space-y-4">
            <Field label="Title" hint="optional">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Main theme"
              />
            </Field>

            {model?.supportsSeed && (
              <Field label="Seed">
                <div className="flex gap-2">
                  <Input
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="random"
                    className="tabular-nums"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() =>
                      setSeed(String(Math.floor(Math.random() * 1_000_000)))
                    }
                    title="Roll a seed"
                  >
                    <Dices className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
            )}

            {model?.supportsNegativePrompt && (
              <Field label="Negative prompt">
                <Input
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="low quality, distortion"
                />
              </Field>
            )}
          </div>
        )}
      </div>

      {error && <FieldError>{error}</FieldError>}
    </LabPanel>
  )
}
