/**
 * VideoUpscalePanel — the video lab's Upscale tab (its fields; the Upscale
 * button with the run's cost sits in the panel footer, see videos/index.tsx).
 *
 * Adaptive to the model:
 * - SeedVR2: factor (up to 10×) or target resolution, noise, output format/quality
 * - Topaz: factor (up to 8×), frame interpolation, H.264 output
 * - Bytedance: target resolution (1080p/2K/4K), 30/60 fps
 *
 * The source clip is measured here (size, length) so the cost can be estimated.
 */

import { Library } from 'lucide-react'
import type {
  BytedanceVideoTargetFps,
  BytedanceVideoTargetResolution,
  SeedvrTargetResolution,
  SeedvrVideoOutputFormat,
  SeedvrVideoOutputQuality,
} from '@/server/services/types'
import type { UpscaleSource } from '@/lib/video-upscale-cost'
import {
  Field,
  FieldError,
  ModelRadioList,
  Segmented,
} from '@/components/generate'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BYTEDANCE_VIDEO_TARGET_FPS,
  BYTEDANCE_VIDEO_TARGET_RESOLUTIONS,
  SEEDVR_TARGET_RESOLUTIONS,
  SEEDVR_VIDEO_OUTPUT_FORMATS,
  SEEDVR_VIDEO_OUTPUT_QUALITIES,
  VIDEO_UPSCALE_MODELS,
} from '@/server/services/types'

const SEEDVR_SCALE_OPTIONS = [2, 3, 4, 6, 8, 10] as const
const TOPAZ_SCALE_OPTIONS = [2, 4, 8] as const

interface VideoUpscalePanelProps {
  model: string
  onModelChange: (model: string) => void

  videoUrl: string
  onVideoUrlChange: (url: string) => void
  onSelectFromLibrary: () => void
  /** the measured source clip, for the cost estimate */
  onSourceChange: (source: UpscaleSource | null) => void
  source: UpscaleSource | null

  upscaleFactor: number
  onUpscaleFactorChange: (factor: number) => void

  // Topaz
  targetFps?: number
  onTargetFpsChange: (fps: number | undefined) => void
  h264Output: boolean
  onH264OutputChange: (enabled: boolean) => void

  // SeedVR
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

  // Bytedance
  bytedanceTargetResolution: BytedanceVideoTargetResolution
  onBytedanceTargetResolutionChange: (
    resolution: BytedanceVideoTargetResolution,
  ) => void
  bytedanceTargetFps: BytedanceVideoTargetFps
  onBytedanceTargetFpsChange: (fps: BytedanceVideoTargetFps) => void

  error?: string | null
}

export function VideoUpscalePanel(props: VideoUpscalePanelProps) {
  const { model, videoUrl, source } = props
  const isSeedVR = model.includes('seedvr')
  const isTopaz = model.includes('topaz')
  const isBytedance = model.includes('bytedance')

  return (
    <>
      <Field
        label="Source clip"
        aside={
          source && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {source.width}×{source.height} · {source.durationSec.toFixed(1)}s
            </span>
          )
        }
      >
        {videoUrl ? (
          <div className="overflow-hidden rounded-xl border border-border bg-black">
            <video
              key={videoUrl}
              src={videoUrl}
              className="aspect-video w-full object-contain"
              muted
              loop
              autoPlay
              playsInline
              onLoadedMetadata={(e) => {
                const v = e.currentTarget
                props.onSourceChange(
                  v.videoWidth && Number.isFinite(v.duration)
                    ? {
                        width: v.videoWidth,
                        height: v.videoHeight,
                        durationSec: v.duration,
                      }
                    : null,
                )
              }}
              onError={() => props.onSourceChange(null)}
            />
          </div>
        ) : null}
        <div className="mt-2 flex gap-2">
          <Input
            placeholder="Paste a video URL…"
            value={videoUrl}
            onChange={(e) => props.onVideoUrlChange(e.target.value)}
          />
          <Button variant="secondary" onClick={props.onSelectFromLibrary}>
            <Library className="h-4 w-4" />
            Library
          </Button>
        </div>
      </Field>

      <Field label="Model">
        <ModelRadioList
          models={VIDEO_UPSCALE_MODELS}
          value={model}
          onChange={props.onModelChange}
          footnote="Billed on the output: its size, length and frame rate."
        />
      </Field>

      {isSeedVR && (
        <>
          <Field label="Scale">
            <Segmented
              className="mb-2"
              options={[
                { value: 'factor', label: 'By factor' },
                { value: 'target', label: 'To resolution' },
              ]}
              value={props.upscaleMode}
              onChange={props.onUpscaleModeChange}
            />
            {props.upscaleMode === 'factor' ? (
              <Segmented
                size="sm"
                options={SEEDVR_SCALE_OPTIONS.map((s) => ({
                  value: s,
                  label: `${s}×`,
                }))}
                value={props.upscaleFactor}
                onChange={props.onUpscaleFactorChange}
              />
            ) : (
              <Segmented
                size="sm"
                options={SEEDVR_TARGET_RESOLUTIONS.map((r) => ({
                  value: r.id,
                  label: r.id === '2160p' ? '4K' : r.name,
                }))}
                value={props.seedvrTargetResolution}
                onChange={props.onSeedvrTargetResolutionChange}
              />
            )}
          </Field>
          <Field
            label="Noise"
            aside={
              <span className="text-sm tabular-nums text-muted-foreground">
                {Math.round(props.noiseScale * 100)}%
              </span>
            }
          >
            <Slider
              value={[props.noiseScale * 100]}
              onValueChange={([v]) => props.onNoiseScaleChange(v / 100)}
              min={0}
              max={100}
              step={5}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Format">
              <Select
                value={props.outputFormat}
                onValueChange={(v) =>
                  props.onOutputFormatChange(v as SeedvrVideoOutputFormat)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEEDVR_VIDEO_OUTPUT_FORMATS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Quality">
              <Select
                value={props.outputQuality}
                onValueChange={(v) =>
                  props.onOutputQualityChange(v as SeedvrVideoOutputQuality)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEEDVR_VIDEO_OUTPUT_QUALITIES.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </>
      )}

      {isTopaz && (
        <>
          <Field label="Scale">
            <Segmented
              options={TOPAZ_SCALE_OPTIONS.map((s) => ({
                value: s,
                label: `${s}×`,
              }))}
              value={props.upscaleFactor}
              onChange={props.onUpscaleFactorChange}
            />
          </Field>
          <Field label="Frame rate">
            <Segmented
              options={[
                { value: 0, label: 'Original' },
                { value: 30, label: '30 fps' },
                { value: 60, label: '60 fps · ×2' },
              ]}
              value={props.targetFps ?? 0}
              onChange={(v) => props.onTargetFpsChange(v || undefined)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Higher rates interpolate new frames; 60 fps doubles the price.
            </p>
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">H.264 output</p>
              <p className="text-xs text-muted-foreground">
                Plays everywhere; slightly larger files
              </p>
            </div>
            <Switch
              checked={props.h264Output}
              onCheckedChange={props.onH264OutputChange}
            />
          </div>
        </>
      )}

      {isBytedance && (
        <>
          <Field label="Target resolution">
            <Segmented
              options={BYTEDANCE_VIDEO_TARGET_RESOLUTIONS.map((r) => ({
                value: r.id,
                label: r.name,
              }))}
              value={props.bytedanceTargetResolution}
              onChange={props.onBytedanceTargetResolutionChange}
            />
          </Field>
          <Field label="Frame rate">
            <Segmented
              options={BYTEDANCE_VIDEO_TARGET_FPS.map((f) => ({
                value: f.id,
                label: f.id === '60fps' ? '60 fps · ×2' : '30 fps',
              }))}
              value={props.bytedanceTargetFps}
              onChange={props.onBytedanceTargetFpsChange}
            />
          </Field>
        </>
      )}

      {props.error && <FieldError>{props.error}</FieldError>}
    </>
  )
}
