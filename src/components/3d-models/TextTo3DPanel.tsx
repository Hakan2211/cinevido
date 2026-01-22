'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Model3DModelSelect } from './Model3DModelSelect'
import { MeshSettingsPanel, type MeshSettings } from './MeshSettingsPanel'
import { generate3DModelFn } from '@/server/model3d.fn'
import { get3DModelById, TEXT_TO_3D_MODELS } from '@/server/services/types'

interface TextTo3DPanelProps {
  className?: string
}

export function TextTo3DPanel({ className }: TextTo3DPanelProps) {
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

  return (
    <div className={cn('space-y-4', className)}>
      {/* Premium Textarea with Floating Generate Button */}
      <div className="relative">
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your 3D model... e.g., A rustic wooden treasure chest with metal bands and ornate lock"
          className="min-h-[80px] resize-none pr-28 text-base rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60"
          rows={2}
          maxLength={isMeshy ? 600 : 1024}
        />
        <Button
          size="default"
          className="absolute bottom-3 right-3 rounded-xl bg-primary hover:bg-primary/90 btn-primary-glow transition-all duration-200"
          onClick={handleGenerate}
          disabled={!prompt.trim() || generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </>
          )}
        </Button>
      </div>

      {/* Settings Row - Premium Styling */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Model Selector */}
        <Model3DModelSelect
          mode="text-to-3d"
          value={modelId}
          onChange={setModelId}
        />

        {/* Meshy-specific options */}
        {isMeshy && (
          <>
            <Select
              value={meshyMode}
              onValueChange={(v) => setMeshyMode(v as 'preview' | 'full')}
            >
              <SelectTrigger className="h-9 w-28 rounded-xl border-border/50 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="preview">Preview</SelectItem>
                <SelectItem value="full">Full</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={artStyle}
              onValueChange={(v) => setArtStyle(v as 'realistic' | 'sculpture')}
            >
              <SelectTrigger className="h-9 w-28 rounded-xl border-border/50 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="realistic">Realistic</SelectItem>
                <SelectItem value="sculpture">Sculpture</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                id="prompt-expansion"
                checked={enablePromptExpansion}
                onCheckedChange={setEnablePromptExpansion}
              />
              <Label
                htmlFor="prompt-expansion"
                className="text-xs text-muted-foreground"
              >
                AI Enhance
              </Label>
            </div>
          </>
        )}

        {/* Advanced Settings Toggle */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                'text-xs font-medium transition-colors rounded-lg px-3 py-1.5',
                showAdvanced
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {showAdvanced ? '- Advanced' : '+ Advanced'}
            </button>
          </CollapsibleTrigger>
        </Collapsible>

        {/* Credits Display - Premium Badge */}
        {modelConfig && (
          <div className="ml-auto flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-medium text-primary">
              {isMeshy && meshyMode === 'preview' ? 20 : modelConfig.credits}{' '}
              credits
            </span>
          </div>
        )}
      </div>

      {/* Advanced settings content */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleContent className="pt-2">
          <MeshSettingsPanel
            settings={meshSettings}
            onChange={setMeshSettings}
            modelType={isHunyuan ? 'hunyuan' : isMeshy ? 'meshy' : 'generic'}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
