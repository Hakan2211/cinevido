/**
 * UpscalePanel - Bottom panel for image upscaling
 *
 * Contains:
 * - Scale factor selector (2x, 4x)
 * - Creativity slider
 * - Model selector
 * - Upscale button
 */

import { ArrowUpCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UPSCALE_MODELS } from '@/server/services/types'
import { cn } from '@/lib/utils'

interface UpscalePanelProps {
  scale: number
  onScaleChange: (scale: number) => void
  creativity: number
  onCreativityChange: (creativity: number) => void
  model: string
  onModelChange: (model: string) => void
  onUpscale: () => void
  isUpscaling: boolean
  hasImage: boolean
  error?: string | null
  className?: string
}

export function UpscalePanel({
  scale,
  onScaleChange,
  creativity,
  onCreativityChange,
  model,
  onModelChange,
  onUpscale,
  isUpscaling,
  hasImage,
  error,
  className,
}: UpscalePanelProps) {
  const selectedModel = UPSCALE_MODELS.find((m) => m.id === model)
  const canUpscale = hasImage && !isUpscaling

  return (
    <div className={cn('space-y-3', className)}>
      {/* Main controls row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Model selector */}
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="h-9 w-44">
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

        {/* Scale selector */}
        <div className="flex items-center rounded-md border">
          <button
            onClick={() => onScaleChange(2)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors rounded-l-md',
              scale === 2
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            2x
          </button>
          <button
            onClick={() => onScaleChange(4)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors rounded-r-md',
              scale === 4
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            4x
          </button>
        </div>

        {/* Creativity slider */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Creativity
          </span>
          <Slider
            value={[creativity * 100]}
            onValueChange={([value]) => onCreativityChange(value / 100)}
            min={0}
            max={100}
            step={5}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground w-8">
            {Math.round(creativity * 100)}%
          </span>
        </div>

        {/* Upscale button */}
        <Button className="ml-auto" onClick={onUpscale} disabled={!canUpscale}>
          {isUpscaling ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ArrowUpCircle className="mr-1.5 h-4 w-4" />
          )}
          Upscale {scale}x
        </Button>
      </div>

      {/* Info row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {creativity < 0.3
            ? 'Low creativity: Preserves original details'
            : creativity > 0.7
              ? 'High creativity: Adds AI-generated details'
              : 'Balanced: Enhances while preserving original'}
        </span>
        <span>{selectedModel?.credits || 4} credits</span>
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
