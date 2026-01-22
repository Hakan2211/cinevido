/**
 * UpscalePanel - Premium bottom panel for image upscaling
 *
 * Adaptive UI based on selected model:
 * - SeedVR2: Target resolution mode OR factor mode (up to 10x), noise scale
 * - Topaz: Multiple model types, face enhancement, subject detection
 */

import { ArrowUpCircle, Loader2, Sparkles, User, Wand2 } from 'lucide-react'
import type {
  SeedvrTargetResolution,
  TopazModelType,
} from '@/server/services/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModelSelect } from '@/components/ui/model-select'
import {
  SEEDVR_TARGET_RESOLUTIONS,
  TOPAZ_MODELS,
  UPSCALE_MODELS,
} from '@/server/services/types'
import { cn } from '@/lib/utils'

// SeedVR scale options (1-10)
const SEEDVR_SCALE_OPTIONS = [2, 3, 4, 6, 8, 10] as const

// Topaz scale options (1-4)
const TOPAZ_SCALE_OPTIONS = [1, 2, 3, 4] as const

interface UpscalePanelProps {
  // Model selection
  model: string
  onModelChange: (model: string) => void

  // Common options
  scale: number
  onScaleChange: (scale: number) => void

  // SeedVR specific
  upscaleMode: 'factor' | 'target'
  onUpscaleModeChange: (mode: 'factor' | 'target') => void
  targetResolution: SeedvrTargetResolution
  onTargetResolutionChange: (resolution: SeedvrTargetResolution) => void
  noiseScale: number
  onNoiseScaleChange: (noise: number) => void

  // Topaz specific
  topazModel: TopazModelType
  onTopazModelChange: (model: TopazModelType) => void
  subjectDetection: 'All' | 'Foreground' | 'Background'
  onSubjectDetectionChange: (
    detection: 'All' | 'Foreground' | 'Background',
  ) => void
  faceEnhancement: boolean
  onFaceEnhancementChange: (enabled: boolean) => void
  faceEnhancementStrength: number
  onFaceEnhancementStrengthChange: (strength: number) => void
  faceEnhancementCreativity: number
  onFaceEnhancementCreativityChange: (creativity: number) => void

  // Actions
  onUpscale: () => void
  isUpscaling: boolean
  hasImage: boolean
  error?: string | null
  className?: string

  // Legacy - kept for compatibility but not used in new UI
  creativity?: number
  onCreativityChange?: (creativity: number) => void
}

export function UpscalePanel({
  model,
  onModelChange,
  scale,
  onScaleChange,
  upscaleMode,
  onUpscaleModeChange,
  targetResolution,
  onTargetResolutionChange,
  noiseScale,
  onNoiseScaleChange,
  topazModel,
  onTopazModelChange,
  subjectDetection,
  onSubjectDetectionChange,
  faceEnhancement,
  onFaceEnhancementChange,
  faceEnhancementStrength,
  onFaceEnhancementStrengthChange,
  faceEnhancementCreativity,
  onFaceEnhancementCreativityChange,
  onUpscale,
  isUpscaling,
  hasImage,
  error,
  className,
}: UpscalePanelProps) {
  const selectedModel = UPSCALE_MODELS.find((m) => m.id === model)
  const canUpscale = hasImage && !isUpscaling

  const isSeedVR = model.includes('seedvr')
  const isTopaz = model.includes('topaz')

  // Get the display text for the upscale button
  const getUpscaleButtonText = () => {
    if (isSeedVR && upscaleMode === 'target') {
      return `Upscale to ${targetResolution}`
    }
    return `Upscale ${scale}x`
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main controls row - Premium Styling */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Model selector with Icons */}
        <ModelSelect
          value={model}
          onValueChange={onModelChange}
          models={UPSCALE_MODELS}
          showDescription={true}
          showProvider={true}
        />

        {/* SeedVR Controls - Premium */}
        {isSeedVR && (
          <>
            {/* Mode toggle: Factor / Target - Premium Pills */}
            <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
              <button
                onClick={() => onUpscaleModeChange('factor')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-all duration-200 rounded-lg',
                  upscaleMode === 'factor'
                    ? 'bg-primary text-primary-foreground active-glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                Factor
              </button>
              <button
                onClick={() => onUpscaleModeChange('target')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-all duration-200 rounded-lg',
                  upscaleMode === 'target'
                    ? 'bg-primary text-primary-foreground active-glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                Target
              </button>
            </div>

            {upscaleMode === 'factor' ? (
              /* Scale selector for factor mode - Premium Pills */
              <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
                {SEEDVR_SCALE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => onScaleChange(s)}
                    className={cn(
                      'px-2.5 py-1.5 text-sm font-medium transition-all duration-200 rounded-lg',
                      scale === s
                        ? 'bg-primary text-primary-foreground active-glow'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            ) : (
              /* Target resolution dropdown - Premium */
              <Select
                value={targetResolution}
                onValueChange={(v) =>
                  onTargetResolutionChange(v as SeedvrTargetResolution)
                }
              >
                <SelectTrigger className="h-9 w-32 rounded-xl border-border/50 bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {SEEDVR_TARGET_RESOLUTIONS.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Noise scale slider - Premium */}
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Noise
              </span>
              <Slider
                value={[noiseScale * 100]}
                onValueChange={([value]) => onNoiseScaleChange(value / 100)}
                min={0}
                max={100}
                step={5}
                className="w-20"
              />
              <span className="text-sm font-medium text-primary w-8">
                {Math.round(noiseScale * 100)}%
              </span>
            </div>
          </>
        )}

        {/* Topaz Controls - Premium */}
        {isTopaz && (
          <>
            {/* Topaz model type selector - Premium */}
            <Select
              value={topazModel}
              onValueChange={(v) => onTopazModelChange(v as TopazModelType)}
            >
              <SelectTrigger className="h-9 w-44 rounded-xl border-border/50 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {TOPAZ_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex flex-col">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Scale selector for Topaz (1-4x) - Premium Pills */}
            <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
              {TOPAZ_SCALE_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onScaleChange(s)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-all duration-200 rounded-lg',
                    scale === s
                      ? 'bg-primary text-primary-foreground active-glow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Subject detection - Premium */}
            <Select
              value={subjectDetection}
              onValueChange={(v) =>
                onSubjectDetectionChange(
                  v as 'All' | 'Foreground' | 'Background',
                )
              }
            >
              <SelectTrigger className="h-9 w-32 rounded-xl border-border/50 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Foreground">Foreground</SelectItem>
                <SelectItem value="Background">Background</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {/* Upscale button - Premium Glow */}
        <Button
          className="ml-auto rounded-xl bg-primary hover:bg-primary/90 btn-primary-glow transition-all duration-200"
          onClick={onUpscale}
          disabled={!canUpscale}
        >
          {isUpscaling ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowUpCircle className="mr-2 h-4 w-4" />
          )}
          {getUpscaleButtonText()}
        </Button>
      </div>

      {/* Topaz Face Enhancement Row - Premium */}
      {isTopaz && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/50 bg-background/30 p-3">
          <div className="flex items-center gap-2">
            <Switch
              id="face-enhancement"
              checked={faceEnhancement}
              onCheckedChange={onFaceEnhancementChange}
            />
            <Label
              htmlFor="face-enhancement"
              className="flex items-center gap-1.5 text-sm cursor-pointer font-medium"
            >
              <User className="h-4 w-4 text-primary" />
              Face Enhancement
            </Label>
          </div>

          {faceEnhancement && (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Strength
                </span>
                <Slider
                  value={[faceEnhancementStrength * 100]}
                  onValueChange={([value]) =>
                    onFaceEnhancementStrengthChange(value / 100)
                  }
                  min={0}
                  max={100}
                  step={5}
                  className="w-20"
                />
                <span className="text-sm font-medium text-primary w-8">
                  {Math.round(faceEnhancementStrength * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  Creative
                </span>
                <Slider
                  value={[faceEnhancementCreativity * 100]}
                  onValueChange={([value]) =>
                    onFaceEnhancementCreativityChange(value / 100)
                  }
                  min={0}
                  max={100}
                  step={5}
                  className="w-20"
                />
                <span className="text-sm font-medium text-primary w-8">
                  {Math.round(faceEnhancementCreativity * 100)}%
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Info row - Premium */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isSeedVR &&
            (upscaleMode === 'target'
              ? `Will upscale to ${targetResolution} resolution`
              : noiseScale < 0.2
                ? 'Low noise: Cleaner output, preserves original'
                : noiseScale > 0.5
                  ? 'High noise: More AI enhancement, may alter details'
                  : 'Balanced noise level')}
          {isTopaz && (
            <>
              {topazModel === 'Text Refine' &&
                'Optimized for images containing text'}
              {topazModel === 'High Fidelity V2' &&
                'Maximum detail preservation'}
              {topazModel === 'Low Resolution V2' &&
                'Best for very low quality sources'}
              {topazModel === 'CGI' && 'Optimized for 3D renders and CGI'}
              {topazModel === 'Recovery' &&
                'For heavily degraded/compressed images'}
              {topazModel === 'Recovery V2' &&
                'Improved recovery for degraded images'}
              {topazModel === 'Redefine' &&
                'Adds AI-generated details and enhancement'}
              {topazModel === 'Standard V2' && 'General purpose enhancement'}
            </>
          )}
        </span>
        {/* Credits Display - Premium Badge */}
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-medium text-primary">
            {selectedModel?.credits || 2} credits
          </span>
        </div>
      </div>

      {/* Error Display - Premium */}
      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}
