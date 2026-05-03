/**
 * EditPanel - Premium bottom panel for prompt-based image editing
 *
 * Contains:
 * - Premium prompt input with floating edit button
 * - Model selector with icons and image count badges
 * - Status showing selected images vs model max
 */

import { Loader2, Paintbrush } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelect } from '@/components/ui/model-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  EDIT_MODELS,
  GPT_IMAGE_OUTPUT_FORMATS,
  GPT_IMAGE_QUALITY_TIERS,
} from '@/server/services/types'
import type {
  GptImageOutputFormat,
  GptImageQuality,
} from '@/server/services/types'
import { cn } from '@/lib/utils'

interface EditPanelProps {
  prompt: string
  onPromptChange: (prompt: string) => void
  model: string
  onModelChange: (model: string) => void
  onGenerate: () => void
  isGenerating: boolean
  selectedCount: number // Number of images currently selected
  maxImages: number // Max images for current model
  error?: string | null
  className?: string
  // GPT Image 2 edit specific options
  gptEditQuality?: GptImageQuality
  onGptEditQualityChange?: (v: GptImageQuality) => void
  gptEditOutputFormat?: GptImageOutputFormat
  onGptEditOutputFormatChange?: (v: GptImageOutputFormat) => void
}

export function EditPanel({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  onGenerate,
  isGenerating,
  selectedCount,
  maxImages,
  error,
  className,
  gptEditQuality,
  onGptEditQualityChange,
  gptEditOutputFormat,
  onGptEditOutputFormatChange,
}: EditPanelProps) {
  const isGptImage2Edit = model === 'fal-ai/gpt-image-2/edit'
  const canGenerate = selectedCount > 0 && prompt.trim() && !isGenerating

  // Status message based on selection state
  const getStatusMessage = () => {
    if (selectedCount === 0) {
      return 'Select an image to edit'
    }
    if (maxImages === 1) {
      return '1 image selected'
    }
    return `${selectedCount} of ${maxImages} images selected`
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Premium Prompt Input */}
      <div className="relative">
        <Textarea
          placeholder="Describe what to change... (e.g., 'Change the background to a sunset')"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="min-h-[80px] resize-none pr-28 text-base rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60 disabled:opacity-50"
          rows={2}
          disabled={selectedCount === 0}
        />
        <Button
          size="default"
          className="absolute bottom-3 right-3 rounded-xl bg-primary hover:bg-primary/90 btn-primary-glow transition-all duration-200 disabled:opacity-50 disabled:shadow-none"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Paintbrush className="mr-2 h-4 w-4" />
              Edit
            </>
          )}
        </Button>
      </div>

      {/* Settings Row - Premium Styling */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Model Selector with Icons */}
        <ModelSelect
          value={model}
          onValueChange={onModelChange}
          models={EDIT_MODELS}
          showDescription={true}
          showProvider={true}
        />

        {/* GPT Image 2 Edit: Quality + Output Format */}
        {isGptImage2Edit &&
          gptEditQuality &&
          onGptEditQualityChange &&
          gptEditOutputFormat &&
          onGptEditOutputFormatChange && (
            <>
              <Select
                value={gptEditQuality}
                onValueChange={onGptEditQualityChange}
              >
                <SelectTrigger className="h-9 w-32 rounded-xl border-border/50 bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {GPT_IMAGE_QUALITY_TIERS.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      <span className="flex items-center gap-2">
                        {tier.name}
                        <span className="text-xs text-muted-foreground">
                          {tier.description}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={gptEditOutputFormat}
                onValueChange={onGptEditOutputFormatChange}
              >
                <SelectTrigger className="h-9 w-28 rounded-xl border-border/50 bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {GPT_IMAGE_OUTPUT_FORMATS.map((fmt) => (
                    <SelectItem key={fmt.id} value={fmt.id}>
                      <span className="flex items-center gap-2">
                        {fmt.name}
                        <span className="text-xs text-muted-foreground">
                          {fmt.description}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

        {/* Status indicator - Premium Badge */}
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-1.5">
          <span
            className={cn(
              'text-xs font-medium',
              selectedCount > 0 ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {getStatusMessage()}
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
