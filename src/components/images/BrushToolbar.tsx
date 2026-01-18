/**
 * BrushToolbar - Controls for mask drawing
 *
 * Features:
 * - Brush size slider
 * - Draw/Erase mode toggle
 * - Clear mask button
 */

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { Paintbrush, Eraser, Trash2 } from 'lucide-react'

interface BrushToolbarProps {
  brushSize: number
  onBrushSizeChange: (size: number) => void
  brushMode: 'draw' | 'erase'
  onBrushModeChange: (mode: 'draw' | 'erase') => void
  onClearMask: () => void
  className?: string
}

export function BrushToolbar({
  brushSize,
  onBrushSizeChange,
  brushMode,
  onBrushModeChange,
  onClearMask,
  className,
}: BrushToolbarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg border bg-background p-2',
        className,
      )}
    >
      {/* Brush/Erase mode toggle */}
      <div className="flex items-center gap-1 rounded-md border p-0.5">
        <Button
          variant={brushMode === 'draw' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 px-3"
          onClick={() => onBrushModeChange('draw')}
        >
          <Paintbrush className="mr-1.5 h-4 w-4" />
          Brush
        </Button>
        <Button
          variant={brushMode === 'erase' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 px-3"
          onClick={() => onBrushModeChange('erase')}
        >
          <Eraser className="mr-1.5 h-4 w-4" />
          Erase
        </Button>
      </div>

      {/* Brush size slider */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Size
        </span>
        <Slider
          value={[brushSize]}
          onValueChange={([value]) => onBrushSizeChange(value)}
          min={5}
          max={100}
          step={1}
          className="w-32"
        />
        <span className="text-sm text-muted-foreground w-8">{brushSize}px</span>
      </div>

      {/* Clear mask button */}
      <Button variant="outline" size="sm" className="h-8" onClick={onClearMask}>
        <Trash2 className="mr-1.5 h-4 w-4" />
        Clear
      </Button>

      {/* Instructions */}
      <span className="ml-auto text-xs text-muted-foreground hidden md:inline">
        Paint over areas you want to {brushMode === 'draw' ? 'replace' : 'keep'}
      </span>
    </div>
  )
}
