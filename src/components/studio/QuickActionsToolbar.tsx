/**
 * Quick Actions Toolbar Component
 *
 * Floating toolbar with common actions for the video workspace.
 * Shows undo/redo, playback controls, and export shortcuts.
 */

import {
  Download,
  Pause,
  Play,
  Redo2,
  SkipBack,
  SkipForward,
  Undo2,
} from 'lucide-react'
import { Button } from '../ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import { cn } from '@/lib/utils'

interface QuickActionsToolbarProps {
  isPlaying: boolean
  onTogglePlay: () => void
  onSkipBack: () => void
  onSkipForward: () => void
  onUndo?: () => void
  onRedo?: () => void
  onExport?: () => void
  canUndo?: boolean
  canRedo?: boolean
  className?: string
}

export function QuickActionsToolbar({
  isPlaying,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
  onUndo,
  onRedo,
  onExport,
  canUndo = false,
  canRedo = false,
  className,
}: QuickActionsToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-lg backdrop-blur',
          className,
        )}
      >
        {/* Undo/Redo */}
        {(onUndo || onRedo) && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onUndo}
                  disabled={!canUndo}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Undo (Ctrl+Z)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onRedo}
                  disabled={!canRedo}
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Redo (Ctrl+Shift+Z)</p>
              </TooltipContent>
            </Tooltip>

            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}

        {/* Playback Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onSkipBack}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Skip Back (J)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9"
              onClick={onTogglePlay}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isPlaying ? 'Pause (K/Space)' : 'Play (K/Space)'}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onSkipForward}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Skip Forward (L)</p>
          </TooltipContent>
        </Tooltip>

        {/* Export */}
        {onExport && (
          <>
            <div className="mx-1 h-4 w-px bg-border" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onExport}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export Video</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
