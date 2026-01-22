'use client'

import { useState } from 'react'
import {
  Box,
  Download,
  Loader2,
  MoreVertical,
  Trash2,
  AlertCircle,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { get3DModelById } from '@/server/services/types'

interface Model3DCardProps {
  asset: {
    id: string
    modelId: string
    mode: string
    prompt?: string | null
    status: string
    modelGlbUrl?: string | null
    thumbnailUrl?: string | null
    modelUrls?: Record<string, string> | null
    error?: string | null
    progress?: number | null
    createdAt: Date | string
  }
  onView?: () => void
  onDelete?: () => void
  className?: string
}

export function Model3DCard({
  asset,
  onView,
  onDelete,
  className,
}: Model3DCardProps) {
  const [imageError, setImageError] = useState(false)

  const modelConfig = get3DModelById(asset.modelId)
  const isProcessing =
    asset.status === 'pending' || asset.status === 'processing'
  const isFailed = asset.status === 'failed'
  const isCompleted = asset.status === 'completed'

  const handleDownload = (url: string, format: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `model-${asset.id}.${format}`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const availableFormats = asset.modelUrls
    ? Object.entries(asset.modelUrls).filter(([_, url]) => url)
    : []

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card overflow-hidden',
        'transition-all hover:border-primary/50 hover:shadow-md',
        className,
      )}
    >
      {/* Thumbnail / Preview */}
      <div
        className="relative aspect-square bg-muted cursor-pointer"
        onClick={onView}
      >
        {asset.thumbnailUrl && !imageError ? (
          <img
            src={asset.thumbnailUrl}
            alt={asset.prompt || 'Generated 3D model'}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Box className="h-12 w-12 text-muted-foreground" />
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <span className="text-white text-sm">
              {asset.progress ? `${asset.progress}%` : 'Processing...'}
            </span>
          </div>
        )}

        {/* Failed overlay */}
        {isFailed && (
          <div className="absolute inset-0 bg-destructive/20 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <span className="text-destructive text-sm">Failed</span>
          </div>
        )}

        {/* Hover overlay for completed */}
        {isCompleted && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Button variant="secondary" size="sm" onClick={onView}>
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </div>
        )}

        {/* Status badge */}
        <Badge
          variant={
            isCompleted ? 'default' : isFailed ? 'destructive' : 'secondary'
          }
          className="absolute top-2 left-2 text-[10px]"
        >
          {asset.status}
        </Badge>
      </div>

      {/* Info footer */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {modelConfig?.name || asset.modelId}
            </p>
            {asset.prompt && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {asset.prompt}
              </p>
            )}
          </div>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isCompleted && onView && (
                <DropdownMenuItem onClick={onView}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Model
                </DropdownMenuItem>
              )}

              {availableFormats.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {availableFormats.map(([format, url]) => (
                    <DropdownMenuItem
                      key={format}
                      onClick={() => handleDownload(url, format)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download .{format.toUpperCase()}
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
