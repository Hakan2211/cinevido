/**
 * VariationsPanel - Bottom panel for creating image variations
 *
 * Contains:
 * - Optional prompt input to guide variation
 * - Variation strength slider
 * - Model selector
 * - Generate button
 */

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Copy } from 'lucide-react'
import { VARIATION_MODELS } from '@/server/services/types'
import { cn } from '@/lib/utils'

interface VariationsPanelProps {
  prompt: string
  onPromptChange: (prompt: string) => void
  strength: number
  onStrengthChange: (strength: number) => void
  model: string
  onModelChange: (model: string) => void
  onGenerate: () => void
  isGenerating: boolean
  hasImage: boolean
  error?: string | null
  className?: string
}

export function VariationsPanel({
  prompt,
  onPromptChange,
  strength,
  onStrengthChange,
  model,
  onModelChange,
  onGenerate,
  isGenerating,
  hasImage,
  error,
  className,
}: VariationsPanelProps) {
  const selectedModel = VARIATION_MODELS.find((m) => m.id === model)
  const canGenerate = hasImage && !isGenerating

  return (
    <div className={cn('space-y-3', className)}>
      {/* Prompt Input (optional) */}
      <div className="relative">
        <Textarea
          placeholder="Optional: describe the variation you want (leave empty for random variation)..."
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="min-h-[52px] resize-none pr-28 text-base"
          rows={1}
          disabled={!hasImage}
        />
        <Button
          size="sm"
          className="absolute bottom-2 right-2"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Copy className="mr-1.5 h-4 w-4" />
              Create
            </>
          )}
        </Button>
      </div>

      {/* Settings Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Model selector */}
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VARIATION_MODELS.map((m) => (
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

        {/* Strength slider */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Difference
          </span>
          <Slider
            value={[strength * 100]}
            onValueChange={([value]) => onStrengthChange(value / 100)}
            min={10}
            max={90}
            step={5}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground w-8">
            {Math.round(strength * 100)}%
          </span>
        </div>

        {/* Status text */}
        <span className="text-xs text-muted-foreground">
          {strength < 0.3
            ? 'Subtle variations'
            : strength > 0.6
              ? 'Major changes'
              : 'Moderate variations'}
        </span>

        <div className="ml-auto text-xs text-muted-foreground">
          {selectedModel?.credits || 5} credits
        </div>
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
