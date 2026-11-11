/**
 * The Voice tab of the Audio lab: text-to-speech on ElevenLabs v4. Clips land
 * on a project's Voice lane.
 */

import { useEffect, useState } from 'react'
import { Mic } from 'lucide-react'
import { estimateCost, formatEstimate } from '@/lib/pricing'
import {
  Field,
  FieldError,
  GenerateButton,
  LabPanel,
  ModelRadioList,
  PromptBox,
} from '@/components/generate'
import { cn } from '@/lib/utils'
import { Slider } from '../ui/slider'
import type { ModelConfig } from '../../server/services/types'
import type { AudioPanelTabs } from './panel-tabs'

export interface VoiceFormValues {
  text: string
  model: string
  voice: string
  stability: number
}

const TEXT_MAX = 5000
const AUDIO_TAGS = ['[excited]', '[whispering]', '[sighs]', '[laughs]']

interface VoicePanelProps extends AudioPanelTabs {
  models: ReadonlyArray<ModelConfig>
  voices: ReadonlyArray<{ name: string; description: string }>
  busy: boolean
  error?: string | null
  onGenerate: (values: VoiceFormValues) => void
}

export function VoicePanel({
  models,
  voices,
  busy,
  error,
  onGenerate,
  ...tabs
}: VoicePanelProps) {
  const [text, setText] = useState('')
  const [modelId, setModelId] = useState('')
  const [voice, setVoice] = useState('Rachel')
  const [stability, setStability] = useState(0.5)

  useEffect(() => {
    if (!modelId && models[0]) setModelId(models[0].id)
  }, [models, modelId])

  const model = models.find((m) => m.id === modelId) ?? models[0]
  const canGenerate = !busy && text.trim().length > 0 && !!model
  const costLabel = text.trim()
    ? formatEstimate(estimateCost(model?.pricing, { chars: text.length }))
    : null

  const submit = () => {
    if (!canGenerate || !model) return
    onGenerate({ text: text.trim(), model: model.id, voice, stability })
  }

  return (
    <LabPanel
      title="Generate Voice"
      subtitle="Narration and dialogue with word timings."
      {...tabs}
      footer={
        <GenerateButton
          label="Generate voice"
          icon={Mic}
          busy={busy}
          busyLabel="Speaking…"
          costLabel={costLabel}
          disabled={!canGenerate}
          onClick={submit}
          hint="Billed to your fal account"
        />
      }
    >
      <Field
        label="Script"
        aside={
          <span className="text-xs tabular-nums text-muted-foreground">
            {text.length.toLocaleString()} chars
          </span>
        }
      >
        <PromptBox
          value={text}
          onChange={setText}
          max={TEXT_MAX}
          rows={6}
          placeholder="Every great film starts with a single frame…"
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {AUDIO_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() =>
                setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}${tag} `)
              }
              className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              {tag}
            </button>
          ))}
          <span className="text-[11px] text-muted-foreground">
            audio tags steer the delivery
          </span>
        </div>
      </Field>

      <Field label="Model">
        <ModelRadioList
          models={models}
          value={model?.id ?? ''}
          onChange={setModelId}
          footnote="Billed per 1,000 characters of script."
        />
      </Field>

      <Field label="Voice">
        <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
          {voices.map((v) => {
            const selected = v.name === voice
            return (
              <button
                key={v.name}
                type="button"
                aria-pressed={selected}
                onClick={() => setVoice(v.name)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-colors',
                  selected
                    ? 'border-primary/60 bg-primary/10'
                    : 'border-border hover:border-muted-foreground/60',
                )}
              >
                <span
                  className={cn(
                    'block text-sm font-medium',
                    selected && 'text-primary',
                  )}
                >
                  {v.name}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {v.description}
                </span>
              </button>
            )
          })}
        </div>
      </Field>

      <Field
        label="Stability"
        aside={
          <span className="text-sm tabular-nums text-muted-foreground">
            {stability.toFixed(2)}
          </span>
        }
      >
        <Slider
          value={[stability]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={([v]) => setStability(v)}
        />
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>Expressive</span>
          <span>Consistent</span>
        </div>
      </Field>

      {error && <FieldError>{error}</FieldError>}
    </LabPanel>
  )
}
