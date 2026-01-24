/**
 * VideoUpscalePanel - Premium bottom panel for video upscaling
 *
 * Adaptive UI based on selected model:
 * - SeedVR2: Target resolution mode OR factor mode (up to 10x), noise scale, output format/quality
 * - Topaz: Scale factor (up to 8x), frame interpolation (target FPS), H.264 output
 * - Bytedance: Simple resolution targeting (1080p/2k/4k), FPS selection (30/60)
 */

import { ArrowUpCircle, Film, Loader2, Upload, Wand2 } from 'lucide-react'
import type {
  BytedanceVideoTargetFps,
  BytedanceVideoTargetResolution,
  SeedvrTargetResolution,
  SeedvrVideoOutputFormat,
  SeedvrVideoOutputQuality,
} from '@/server/services/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModelSelect } from '@/components/ui/model-select'
import {
  BYTEDANCE_VIDEO_TARGET_FPS,
  BYTEDANCE_VIDEO_TARGET_RESOLUTIONS,
  SEEDVR_TARGET_RESOLUTIONS,
  SEEDVR_VIDEO_OUTPUT_FORMATS,
  SEEDVR_VIDEO_OUTPUT_QUALITIES,
  VIDEO_UPSCALE_MODELS,
} from '@/server/services/types'
import { cn } from '@/lib/utils'

// SeedVR scale options (1-10)
const SEEDVR_SCALE_OPTIONS = [2, 3, 4, 6, 8, 10] as const

// Topaz scale options (1-8)
const TOPAZ_SCALE_OPTIONS = [2, 4, 8] as const

interface VideoUpscalePanelProps {
  // Model selection
  model: string
  onModelChange: (model: string) => void

  // Video source
  videoUrl: string
  onVideoUrlChange: (url: string) => void
  onSelectFromLibrary: () => void
  selectedVideoName?: string

  // Common options
  upscaleFactor: number
  onUpscaleFactorChange: (factor: number) => void

  // Topaz specific
  targetFps?: number
  onTargetFpsChange: (fps: number | undefined) => void
  h264Output: boolean
  onH264OutputChange: (enabled: boolean) => void

  // SeedVR specific
  upscaleMode: 'factor' | 'target'
  onUpscaleModeChange: (mode: 'factor' | 'target') => void
  seedvrTargetResolution: SeedvrTargetResolution
  onSeedvrTargetResolutionChange: (resolution: SeedvrTargetResolution) => void
  noiseScale: number
  onNoiseScaleChange: (noise: number) => void
  outputFormat: SeedvrVideoOutputFormat
  onOutputFormatChange: (format: SeedvrVideoOutputFormat) => void
  outputQuality: SeedvrVideoOutputQuality
  onOutputQualityChange: (quality: SeedvrVideoOutputQuality) => void

  // Bytedance specific
  bytedanceTargetResolution: BytedanceVideoTargetResolution
  onBytedanceTargetResolutionChange: (
    resolution: BytedanceVideoTargetResolution,
  ) => void
  bytedanceTargetFps: BytedanceVideoTargetFps
  onBytedanceTargetFpsChange: (fps: BytedanceVideoTargetFps) => void

  // Actions
  onUpscale: () => void
  isUpscaling: boolean
  hasVideo: boolean
  error?: string | null
  className?: string
}

export function VideoUpscalePanel({
  model,
  onModelChange,
  videoUrl,
  onVideoUrlChange,
  onSelectFromLibrary,
  selectedVideoName,
  upscaleFactor,
  onUpscaleFactorChange,
  targetFps,
  onTargetFpsChange,
  h264Output,
  onH264OutputChange,
  upscaleMode,
  onUpscaleModeChange,
  seedvrTargetResolution,
  onSeedvrTargetResolutionChange,
  noiseScale,
  onNoiseScaleChange,
  outputFormat,
  onOutputFormatChange,
  outputQuality,
  onOutputQualityChange,
  bytedanceTargetResolution,
  onBytedanceTargetResolutionChange,
  bytedanceTargetFps,
  onBytedanceTargetFpsChange,
  onUpscale,
  isUpscaling,
  hasVideo,
  error,
  className,
}: VideoUpscalePanelProps) {
  const selectedModel = VIDEO_UPSCALE_MODELS.find((m) => m.id === model)
  const canUpscale = hasVideo && !isUpscaling

  const isSeedVR = model.includes('seedvr')
  const isTopaz = model.includes('topaz')
  const isBytedance = model.includes('bytedance')

  // Get the display text for the upscale button
  const getUpscaleButtonText = () => {
    if (isSeedVR && upscaleMode === 'target') {
      return `Upscale to ${seedvrTargetResolution}`
    }
    if (isBytedance) {
      return `Upscale to ${bytedanceTargetResolution}`
    }
    return `Upscale ${upscaleFactor}x`
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Video Source Row */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Enter video URL or select from library..."
            value={videoUrl}
            onChange={(e) => onVideoUrlChange(e.target.value)}
            className="rounded-xl border-border/50 bg-background/50"
          />
        </div>
        <Button
          variant="outline"
          onClick={onSelectFromLibrary}
          className="rounded-xl border-border/50"
        >
          <Upload className="mr-2 h-4 w-4" />
          Library
        </Button>
        {selectedVideoName && (
          <span className="text-sm text-muted-foreground truncate max-w-[200px]">
            {selectedVideoName}
          </span>
        )}
      </div>

      {/* Main controls row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Model selector */}
        <ModelSelect
          value={model}
          onValueChange={onModelChange}
          models={VIDEO_UPSCALE_MODELS}
          showDescription={true}
          showProvider={true}
        />

        {/* SeedVR Controls */}
        {isSeedVR && (
          <>
            {/* Mode toggle: Factor / Target */}
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
              /* Scale selector for factor mode */
              <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
                {SEEDVR_SCALE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => onUpscaleFactorChange(s)}
                    className={cn(
                      'px-2.5 py-1.5 text-sm font-medium transition-all duration-200 rounded-lg',
                      upscaleFactor === s
                        ? 'bg-primary text-primary-foreground active-glow'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            ) : (
              /* Target resolution dropdown */
              <Select
                value={seedvrTargetResolution}
                onValueChange={(v) =>
                  onSeedvrTargetResolutionChange(v as SeedvrTargetResolution)
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

            {/* Noise scale slider */}
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

        {/* Topaz Controls */}
        {isTopaz && (
          <>
            {/* Scale selector (2-8x) */}
            <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
              {TOPAZ_SCALE_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onUpscaleFactorChange(s)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-all duration-200 rounded-lg',
                    upscaleFactor === s
                      ? 'bg-primary text-primary-foreground active-glow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Frame interpolation (target FPS) */}
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
              <Film className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Target FPS
              </span>
              <Input
                type="number"
                placeholder="Auto"
                value={targetFps || ''}
                onChange={(e) =>
                  onTargetFpsChange(
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                min={24}
                max={120}
                className="h-7 w-16 rounded-lg border-0 bg-transparent text-center text-sm"
              />
            </div>

            {/* H.264 output toggle */}
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
              <Switch
                id="h264-output"
                checked={h264Output}
                onCheckedChange={onH264OutputChange}
              />
              <Label
                htmlFor="h264-output"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                H.264 (more compatible)
              </Label>
            </div>
          </>
        )}

        {/* Bytedance Controls */}
        {isBytedance && (
          <>
            {/* Target resolution pills */}
            <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
              {BYTEDANCE_VIDEO_TARGET_RESOLUTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onBytedanceTargetResolutionChange(r.id)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-all duration-200 rounded-lg',
                    bytedanceTargetResolution === r.id
                      ? 'bg-primary text-primary-foreground active-glow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {r.name}
                </button>
              ))}
            </div>

            {/* Target FPS toggle */}
            <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
              {BYTEDANCE_VIDEO_TARGET_FPS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onBytedanceTargetFpsChange(f.id)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-all duration-200 rounded-lg',
                    bytedanceTargetFps === f.id
                      ? 'bg-primary text-primary-foreground active-glow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Upscale button */}
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

      {/* SeedVR Output Options Row */}
      {isSeedVR && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/50 bg-background/30 p-3">
          {/* Output format */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Format:</span>
            <Select
              value={outputFormat}
              onValueChange={(v) =>
                onOutputFormatChange(v as SeedvrVideoOutputFormat)
              }
            >
              <SelectTrigger className="h-8 w-36 rounded-lg border-border/50 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {SEEDVR_VIDEO_OUTPUT_FORMATS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Output quality */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Quality:</span>
            <Select
              value={outputQuality}
              onValueChange={(v) =>
                onOutputQualityChange(v as SeedvrVideoOutputQuality)
              }
            >
              <SelectTrigger className="h-8 w-28 rounded-lg border-border/50 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {SEEDVR_VIDEO_OUTPUT_QUALITIES.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Info row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isSeedVR &&
            (upscaleMode === 'target'
              ? `Will upscale to ${seedvrTargetResolution} resolution with temporal consistency`
              : noiseScale < 0.2
                ? 'Low noise: Cleaner output, preserves original frames'
                : noiseScale > 0.5
                  ? 'High noise: More AI enhancement, may alter details'
                  : 'Balanced noise level for video upscaling')}
          {isTopaz &&
            (targetFps
              ? `Frame interpolation enabled: Output at ${targetFps} FPS`
              : 'Professional-grade video upscaling with optional frame interpolation')}
          {isBytedance &&
            `Simple ${bytedanceTargetResolution} upscaling at ${bytedanceTargetFps === '30fps' ? '30' : '60'} FPS`}
        </span>
        {/* Credits Display */}
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-medium text-primary">
            {selectedModel?.credits || 10} credits
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}
