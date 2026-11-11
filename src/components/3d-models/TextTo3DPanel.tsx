import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { MeshSettingsPanel } from './MeshSettingsPanel'
import type { MeshSettings } from './MeshSettingsPanel'
import { Switch } from '@/components/ui/switch'
import {
  Field,
  GenerateButton,
  LabPanel,
  ModelRadioList,
  PromptBox,
  Segmented,
} from '@/components/generate'
import { TEXT_TO_3D_MODELS, get3DModelById } from '@/server/services/types'
import { format3DCost } from './cost'
import type { Model3DPanelTabs } from './tabs'

// NOTE: Server functions are dynamically imported in mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions

export function TextTo3DPanel(tabs: Model3DPanelTabs) {
  const queryClient = useQueryClient()

  // Form state
  const [prompt, setPrompt] = useState('')
  const [modelId, setModelId] = useState(TEXT_TO_3D_MODELS[0].id)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Mesh settings
  const [meshSettings, setMeshSettings] = useState<MeshSettings>({
    enablePbr: false,
    faceCount: 500000,
    generateType: 'Normal',
    topology: 'triangle',
    targetPolycount: 30000,
    symmetryMode: 'auto',
    shouldRemesh: true,
  })

  // Meshy-specific settings
  const [meshyMode, setMeshyMode] = useState<'preview' | 'full'>('full')
  const [artStyle, setArtStyle] = useState<'realistic' | 'sculpture'>(
    'realistic',
  )
  const [enablePromptExpansion, setEnablePromptExpansion] = useState(false)

  const modelConfig = get3DModelById(modelId)
  const isMeshy = modelConfig?.id.includes('meshy')
  const isHunyuan = modelConfig?.id.includes('hunyuan')

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!prompt.trim()) {
        throw new Error('Please enter a prompt')
      }

      const { generate3DModelFn } = await import('@/server/model3d.server')
      return generate3DModelFn({
        data: {
          modelId,
          mode: 'text-to-3d',
          prompt: prompt.trim(),
          enablePbr: meshSettings.enablePbr,
          faceCount: isHunyuan ? meshSettings.faceCount : undefined,
          generateType: isHunyuan ? meshSettings.generateType : undefined,
          topology: isMeshy ? meshSettings.topology : undefined,
          targetPolycount: isMeshy ? meshSettings.targetPolycount : undefined,
          symmetryMode: isMeshy ? meshSettings.symmetryMode : undefined,
          shouldRemesh: isMeshy ? meshSettings.shouldRemesh : undefined,
          meshyMode: isMeshy ? meshyMode : undefined,
          artStyle: isMeshy ? artStyle : undefined,
          enablePromptExpansion: isMeshy ? enablePromptExpansion : undefined,
          isATpose: meshSettings.isATpose,
        },
      })
    },
    onSuccess: () => {
      toast.success('3D model generation started!')
      queryClient.invalidateQueries({ queryKey: ['3d-models'] })
      setPrompt('')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Generation failed')
    },
  })

  const handleGenerate = () => {
    generateMutation.mutate()
  }

  const costLabel = format3DCost(modelConfig, {
    mesh: meshSettings,
    meshyMode: isMeshy ? meshyMode : undefined,
  })

  return (
    <LabPanel
      title="Text to 3D"
      subtitle="Describe an object, get a textured mesh."
      {...tabs}
      footer={
        <GenerateButton
          label="Generate"
          icon={Sparkles}
          busy={generateMutation.isPending}
          busyLabel="Starting…"
          costLabel={costLabel}
          disabled={!prompt.trim() || generateMutation.isPending}
          onClick={handleGenerate}
          hint="Billed to your fal account · models take 1–5 minutes"
        />
      }
    >
      <Field label="Prompt">
        <PromptBox
          value={prompt}
          onChange={setPrompt}
          max={isMeshy ? 600 : 1024}
          rows={4}
          placeholder="A rustic wooden treasure chest with metal bands and an ornate lock"
        />
      </Field>

      <Field label="Model">
        <ModelRadioList
          models={TEXT_TO_3D_MODELS}
          value={modelId}
          onChange={setModelId}
          footnote="Rates are fal's prices per model at default settings."
        />
      </Field>

      {isMeshy && (
        <>
          <Field label="Quality">
            <Segmented
              options={[
                { value: 'preview', label: 'Preview · untextured' },
                { value: 'full', label: 'Full · textured' },
              ]}
              value={meshyMode}
              onChange={setMeshyMode}
            />
          </Field>
          <Field label="Style">
            <Segmented
              options={[
                { value: 'realistic', label: 'Realistic' },
                { value: 'sculpture', label: 'Sculpture' },
              ]}
              value={artStyle}
              onChange={setArtStyle}
            />
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Enhance prompt</p>
              <p className="text-xs text-muted-foreground">
                Let Meshy expand a short prompt into a detailed one
              </p>
            </div>
            <Switch
              checked={enablePromptExpansion}
              onCheckedChange={setEnablePromptExpansion}
            />
          </div>
        </>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? '− Mesh settings' : '+ Mesh settings'}
        </button>
        {showAdvanced && (
          <MeshSettingsPanel
            className="mt-4"
            settings={meshSettings}
            onChange={setMeshSettings}
            modelType={isHunyuan ? 'hunyuan' : 'meshy'}
          />
        )}
      </div>
    </LabPanel>
  )
}
