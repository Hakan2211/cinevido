/**
 * The SFX tab of the Audio lab: sound effects from a description. Clips land
 * on a project's SFX lane.
 */

import { useEffect, useState } from 'react'
import { AudioWaveform } from 'lucide-react'
import {
  estimateCost,
  formatEstimate,
  formatRate,
  formatUsd,
} from '@/lib/pricing'
import {
  Field,
  FieldError,
  GenerateButton,
  LabPanel,
  ModelRadioList,
  PromptBox,
} from '@/components/generate'
import { Slider } from '../ui/slider'
import { Switch } from '../ui/switch'
import type { SfxModelConfig } from '../../server/services/types'
import type { AudioPanelTabs } from './panel-tabs'

export interface SfxFormValues {
  prompt: string
  model: string
  durationSec?: number
  loop: boolean
  promptInfluence: number
}

interface SfxPanelProps extends AudioPanelTabs {
  models: ReadonlyArray<SfxModelConfig>
  busy: boolean
  error?: string | null
  onGenerate: (values: SfxFormValues) => void
}

export function SfxPanel({
  models,
  busy,
  error,
  onGenerate,
  ...tabs
}: SfxPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [modelId, setModelId] = useState('')
  const [autoLength, setAutoLength] = useState(true)
  const [duration, setDuration] = useState(4)
  const [loop, setLoop] = useState(false)
  const [influence, setInfluence] = useState(0.3)

  useEffect(() => {
    if (!modelId && models[0]) setModelId(models[0].id)
  }, [models, modelId])

  const model = models.find((m) => m.id === modelId) ?? models[0]
  const canGenerate = !busy && prompt.trim().length > 0 && !!model

  // With an automatic length we only know the ceiling
  const costLabel = autoLength
    ? model?.pricing
      ? `≤ ${formatUsd(estimateCost(model.pricing, { durationSec: model.maxDurationSec })!.max)}`
      : null
    : formatEstimate(estimateCost(model?.pricing, { durationSec: duration }))

  const submit = () => {
    if (!canGenerate || !model) return
    onGenerate({
      prompt: prompt.trim(),
      model: model.id,
      durationSec: autoLength ? undefined : duration,
      loop,
      promptInfluence: influence,
    })
  }

  return (
    <LabPanel
      title="Generate SFX"
      subtitle="Foley, ambience and hits for your cut."
      {...tabs}
      footer={
        <GenerateButton
          label="Generate sound"
          icon={AudioWaveform}
          busy={busy}
          busyLabel="Generating…"
          costLabel={costLabel}
          disabled={!canGenerate}
          onClick={submit}
          hint="Billed to your fal account"
        />
      }
    >
      <Field label="Describe the sound">
        <PromptBox
          value={prompt}
          onChange={setPrompt}
          max={model?.maxPromptChars ?? 450}
          rows={4}
          placeholder="A heavy wooden door creaks open, then slams in a stone hall"
        />
      </Field>

      {models.length > 1 && (
        <Field label="Model">
          <ModelRadioList
            models={models}
            value={model?.id ?? ''}
            onChange={setModelId}
          />
        </Field>
      )}

      <Field
        label="Length"
        aside={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Auto
            <Switch checked={autoLength} onCheckedChange={setAutoLength} />
          </label>
        }
      >
        {autoLength ? (
          <p className="text-sm text-muted-foreground">
            The model picks a length that fits the sound (up to{' '}
            {model?.maxDurationSec ?? 30}s).
          </p>
        ) : (
          <>
            <Slider
              value={[duration]}
              min={model?.minDurationSec ?? 0.5}
              max={model?.maxDurationSec ?? 30}
              step={0.5}
              onValueChange={([v]) => setDuration(v)}
            />
            <p className="mt-2 text-right text-sm tabular-nums text-muted-foreground">
              {duration.toFixed(1)} seconds
            </p>
          </>
        )}
      </Field>

      <Field
        label="Prompt influence"
        aside={
          <span className="text-sm tabular-nums text-muted-foreground">
            {influence.toFixed(2)}
          </span>
        }
      >
        <Slider
          value={[influence]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={([v]) => setInfluence(v)}
        />
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>More variation</span>
          <span>More literal</span>
        </div>
      </Field>

      {model?.supportsLoop && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Seamless loop</p>
            <p className="text-xs text-muted-foreground">
              For ambiences and room tone that run under a scene
            </p>
          </div>
          <Switch checked={loop} onCheckedChange={setLoop} />
        </div>
      )}

      {model?.pricing && (
        <p className="text-[11px] text-muted-foreground">
          {model.name} · {formatRate(model.pricing)}
        </p>
      )}

      {error && <FieldError>{error}</FieldError>}
    </LabPanel>
  )
}
