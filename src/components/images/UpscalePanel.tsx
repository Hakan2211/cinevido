/**
 * UpscalePanel - Bottom panel for image upscaling
 *
 * Adaptive UI based on selected model:
 * - SeedVR2: Target resolution mode OR factor mode (up to 10x), noise scale
 * - Topaz: Multiple model types, face enhancement, subject detection
 */

import { ArrowUpCircle, Loader2, Sparkles, User } from 'lucide-react'
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
    <div className={cn('space-y-3', className)}>
      {/* Main controls row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Model selector */}
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UPSCALE_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="flex items-center gap-2">
                  {m.name}
                  <span className="text-xs text-muted-foreground">
                    {m.credits}cr
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* SeedVR Controls */}
        {isSeedVR && (
          <>
            {/* Mode toggle: Factor / Target */}
            <div className="flex items-center rounded-md border">
              <button
                onClick={() => onUpscaleModeChange('factor')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors rounded-l-md',
                  upscaleMode === 'factor'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                Factor
              </button>
              <button
                onClick={() => onUpscaleModeChange('target')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors rounded-r-md',
                  upscaleMode === 'target'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                Target
              </button>
            </div>

            {upscaleMode === 'factor' ? (
              /* Scale selector for factor mode */
              <div className="flex items-center rounded-md border">
                {SEEDVR_SCALE_OPTIONS.map((s, idx) => (
                  <button
                    key={s}
                    onClick={() => onScaleChange(s)}
                    className={cn(
                      'px-2.5 py-1.5 text-sm font-medium transition-colors',
                      idx === 0 && 'rounded-l-md',
                      idx === SEEDVR_SCALE_OPTIONS.length - 1 && 'rounded-r-md',
                      scale === s
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted',
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            ) : (
              /* Target resolution dropdown */
              <Select
                value={targetResolution}
                onValueChange={(v) =>
                  onTargetResolutionChange(v as SeedvrTargetResolution)
                }
              >
                <SelectTrigger className="h-9 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEEDVR_TARGET_RESOLUTIONS.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Noise scale slider */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
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
              <span className="text-sm text-muted-foreground w-8">
                {Math.round(noiseScale * 100)}%
              </span>
            </div>
          </>
        )}

        {/* Topaz Controls */}
        {isTopaz && (
          <>
            {/* Topaz model type selector */}
            <Select
              value={topazModel}
              onValueChange={(v) => onTopazModelChange(v as TopazModelType)}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOPAZ_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex flex-col">
                      <span>{m.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Scale selector for Topaz (1-4x) */}
            <div className="flex items-center rounded-md border">
              {TOPAZ_SCALE_OPTIONS.map((s, idx) => (
                <button
                  key={s}
                  onClick={() => onScaleChange(s)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-colors',
                    idx === 0 && 'rounded-l-md',
                    idx === TOPAZ_SCALE_OPTIONS.length - 1 && 'rounded-r-md',
                    scale === s
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted',
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Subject detection */}
            <Select
              value={subjectDetection}
              onValueChange={(v) =>
                onSubjectDetectionChange(
                  v as 'All' | 'Foreground' | 'Background',
                )
              }
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Foreground">Foreground</SelectItem>
                <SelectItem value="Background">Background</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {/* Upscale button */}
        <Button className="ml-auto" onClick={onUpscale} disabled={!canUpscale}>
          {isUpscaling ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ArrowUpCircle className="mr-1.5 h-4 w-4" />
          )}
          {getUpscaleButtonText()}
        </Button>
      </div>

      {/* Topaz Face Enhancement Row */}
      {isTopaz && (
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <div className="flex items-center gap-2">
            <Switch
              id="face-enhancement"
              checked={faceEnhancement}
              onCheckedChange={onFaceEnhancementChange}
            />
            <Label
              htmlFor="face-enhancement"
              className="flex items-center gap-1.5 text-sm cursor-pointer"
            >
              <User className="h-4 w-4" />
              Face Enhancement
            </Label>
          </div>

          {faceEnhancement && (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
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
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground w-8">
                  {Math.round(faceEnhancementStrength * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Creativity
                </span>
                <Slider
                  value={[faceEnhancementCreativity * 100]}
                  onValueChange={([value]) =>
                    onFaceEnhancementCreativityChange(value / 100)
                  }
                  min={0}
                  max={100}
                  step={5}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground w-8">
                  {Math.round(faceEnhancementCreativity * 100)}%
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Info row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
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
        <span>{selectedModel?.credits || 2} credits</span>
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
