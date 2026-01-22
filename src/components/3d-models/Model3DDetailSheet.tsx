'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Calendar,
  Copy,
  Download,
  ExternalLink,
  Hash,
  Loader2,
  MessageSquare,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Model3DViewer } from './Model3DViewer'
import { get3DModelFn } from '@/server/model3d.fn'
import { get3DModelById } from '@/server/services/types'

interface Model3DDetailSheetProps {
  assetId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete?: (assetId: string) => void
}

export function Model3DDetailSheet({
  assetId,
  open,
  onOpenChange,
  onDelete,
}: Model3DDetailSheetProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  const { data: asset, isLoading } = useQuery({
    queryKey: ['3d-model', assetId],
    queryFn: () => get3DModelFn({ data: { assetId: assetId! } }),
    enabled: !!assetId && open,
  })

  const modelConfig = asset?.modelId ? get3DModelById(asset.modelId) : null

  const handleCopyPrompt = async () => {
    if (!asset?.prompt) return
    await navigator.clipboard.writeText(asset.prompt)
    setCopiedPrompt(true)
    toast.success('Prompt copied to clipboard')
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  const handleDownload = (url: string, format: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `model-${assetId}.${format}`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDelete = () => {
    if (!assetId) return
    if (confirm('Are you sure you want to delete this 3D model?')) {
      onDelete?.(assetId)
      onOpenChange(false)
    }
  }

  const availableFormats = asset?.modelUrls
    ? Object.entries(asset.modelUrls).filter(([_, url]) => url)
    : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/30">
          <SheetTitle className="flex items-center gap-2">
            <Box className="h-5 w-5" />
            3D Model Details
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !asset ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <Box className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Model not found</p>
          </div>
        ) : (
          <div className="space-y-6 px-6 pb-6 pt-4">
            {/* 3D Viewer */}
            <div className="overflow-hidden rounded-2xl border border-border/30 bg-muted/30">
              <Model3DViewer
                url={asset.modelGlbUrl || ''}
                className="aspect-square"
                autoRotate={false}
                showControls={true}
              />
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  asset.status === 'completed'
                    ? 'default'
                    : asset.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {asset.status}
              </Badge>
              {asset.status === 'processing' && asset.progress && (
                <span className="text-sm text-muted-foreground">
                  {asset.progress}%
                </span>
              )}
            </div>

            {/* Prompt Card */}
            {asset.prompt && (
              <div className="rounded-xl border border-border/30 bg-card/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm font-medium">Prompt</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs hover:bg-primary/10 hover:text-primary"
                    onClick={handleCopyPrompt}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    {copiedPrompt ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <p className="text-sm leading-relaxed">{asset.prompt}</p>
              </div>
            )}

            {/* Metadata Card */}
            <div className="rounded-xl border border-border/30 bg-card/50 p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Model */}
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Model</span>
                    <p className="text-sm font-medium">
                      {modelConfig?.name || asset.modelId}
                    </p>
                  </div>
                </div>

                {/* Mode */}
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Box className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Mode</span>
                    <p className="text-sm font-medium capitalize">
                      {asset.mode.replace(/-/g, ' ')}
                    </p>
                  </div>
                </div>

                {/* Created */}
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Created
                    </span>
                    <p className="text-sm font-medium">
                      {new Date(asset.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Seed */}
                {asset.seed && (
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Hash className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Seed
                      </span>
                      <p className="text-sm font-medium">{asset.seed}</p>
                    </div>
                  </div>
                )}

                {/* Credits Used */}
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Credits Used
                    </span>
                    <p className="text-sm font-medium">{asset.creditsUsed}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Source Images */}
            {asset.sourceImageUrls && asset.sourceImageUrls.length > 0 && (
              <div className="rounded-xl border border-border/30 bg-card/50 p-4">
                <span className="text-sm font-medium text-muted-foreground mb-3 block">
                  Source Images
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {asset.sourceImageUrls.map((url: string, index: number) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Source ${index + 1}`}
                      className="rounded-lg object-cover aspect-square"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Download Buttons */}
            {availableFormats.length > 0 && (
              <div className="space-y-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Download Formats
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {availableFormats.map(([format, url]) => (
                    <Button
                      key={format}
                      variant="outline"
                      className="rounded-xl border-border/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                      onClick={() => handleDownload(url as string, format)}
                    >
                      <Download className="mr-2 h-4 w-4" />.
                      {format.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* World File (for Hunyuan World) */}
            {asset.worldFileUrl && (
              <Button
                variant="outline"
                className="w-full rounded-xl border-border/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                onClick={() => handleDownload(asset.worldFileUrl!, 'world')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Download World File
              </Button>
            )}

            {/* Gaussian Splat (for SAM 3D) */}
            {asset.gaussianSplatUrl && (
              <Button
                variant="outline"
                className="w-full rounded-xl border-border/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                onClick={() =>
                  handleDownload(asset.gaussianSplatUrl!, 'splat.ply')
                }
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Download Gaussian Splat
              </Button>
            )}

            <Separator className="my-2" />

            {/* Delete Button */}
            {onDelete && (
              <Button
                variant="ghost"
                className="w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Model
              </Button>
            )}

            {/* Error Display */}
            {asset.error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                <p className="text-sm text-destructive">{asset.error}</p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
