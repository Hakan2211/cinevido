/**
 * EditPanel - Bottom panel for inpainting/outpainting
 *
 * Contains:
 * - Prompt input for what to replace masked area with
 * - Model selector
 * - Generate button
 */

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Wand2 } from 'lucide-react'
import { EDIT_MODELS } from '@/server/services/types'
import { cn } from '@/lib/utils'

interface EditPanelProps {
  prompt: string
  onPromptChange: (prompt: string) => void
  model: string
  onModelChange: (model: string) => void
  onGenerate: () => void
  isGenerating: boolean
  hasMask: boolean
  hasImage: boolean
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
  hasMask,
  hasImage,
  error,
  className,
}: EditPanelProps) {
  const selectedModel = EDIT_MODELS.find((m) => m.id === model)
  const canGenerate = hasImage && hasMask && prompt.trim() && !isGenerating

  return (
    <div className={cn('space-y-3', className)}>
      {/* Prompt Input */}
      <div className="relative">
        <Textarea
          placeholder="Describe what should replace the masked area..."
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="min-h-[52px] resize-none pr-24 text-base"
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
              <Wand2 className="mr-1.5 h-4 w-4" />
              Edit
            </>
          )}
        </Button>
      </div>

      {/* Settings Row */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="h-8 w-44">
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
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status indicator */}
        {!hasImage && (
          <span className="text-xs text-muted-foreground">
            Select an image to edit
          </span>
        )}
        {hasImage && !hasMask && (
          <span className="text-xs text-muted-foreground">
            Paint a mask over areas to replace
          </span>
        )}
        {hasImage && hasMask && !prompt.trim() && (
          <span className="text-xs text-muted-foreground">
            Enter a prompt describing the replacement
          </span>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {selectedModel?.credits || 6} credits
        </div>
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
