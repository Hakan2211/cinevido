/**
 * EditPanel - Bottom panel for prompt-based image editing
 *
 * Contains:
 * - Prompt input describing what to change
 * - Model selector with image count badges
 * - Status showing selected images vs model max
 * - Edit button
 */

import { Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    <div className={cn('space-y-3', className)}>
      {/* Prompt Input */}
      <div className="relative">
        <Textarea
          placeholder="Describe what to change... (e.g., 'Change the background to a sunset', 'Add a hat to the person')"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="min-h-[52px] resize-none pr-24 text-base"
          rows={1}
          disabled={selectedCount === 0}
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
              <Wand2 className="mr-1.5 h-4 w-4" />
              Edit
            </>
          )}
        </Button>
      </div>

      {/* Settings Row */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="h-8 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EDIT_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="flex items-center gap-2">
                  {m.name}
                  <span className="text-xs text-muted-foreground">
                    {m.credits}cr
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {m.maxImages === 1 ? '1 img' : `${m.maxImages} img`}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status indicator */}
        <span className="text-xs text-muted-foreground">
          {getStatusMessage()}
        </span>

        <div className="ml-auto text-xs text-muted-foreground">
          {selectedModel?.credits || 4} credits
        </div>
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
