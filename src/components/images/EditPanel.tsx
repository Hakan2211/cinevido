/**
 * EditPanel - Premium bottom panel for prompt-based image editing
 *
 * Contains:
 * - Premium prompt input with floating edit button
 * - Model selector with icons and image count badges
 * - Status showing selected images vs model max
 */

import { Loader2, Paintbrush, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelect } from '@/components/ui/model-select'
import { EDIT_MODELS } from '@/server/services/types'
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
}: EditPanelProps) {
  const selectedModel = EDIT_MODELS.find((m) => m.id === model)
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

        {/* Credits Display - Premium Badge */}
        <div className="ml-auto flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-medium text-primary">
            {selectedModel?.credits || 4} credits
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
