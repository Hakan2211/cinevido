import { useState } from 'react'
import { AlertCircle, Box, Download, Eye, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { downloadFile } from '@/lib/download'
import { PendingCard, ResultCard } from '@/components/generate'
import type { CardAction } from '@/components/generate'
import { format3DCost } from './cost'
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

export function Model3DCard({ asset, onView, onDelete }: Model3DCardProps) {
  const [imageError, setImageError] = useState(false)
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(
    null,
  )

  const modelConfig = get3DModelById(asset.modelId)
  const isProcessing =
    asset.status === 'pending' || asset.status === 'processing'
  const isFailed = asset.status === 'failed'
  const isCompleted = asset.status === 'completed'

  const handleDownload = async (url: string, format: string) => {
    const filename = `model-${asset.id}.${format}`

    await downloadFile(url, filename, {
      onStart: () => {
        setDownloadingFormat(format)
        toast.info(`Starting download: ${filename}`)
      },
      onComplete: () => {
        setDownloadingFormat(null)
        toast.success('Download complete!')
      },
      onError: (error) => {
        setDownloadingFormat(null)
        toast.error(`Download failed: ${error.message}`)
      },
    })
  }

  const availableFormats = asset.modelUrls
    ? Object.entries(asset.modelUrls).filter(([, url]) => url)
    : []

  const title = modelConfig?.name || asset.modelId
  // the default-settings price: we do not store which options a run used
  const cost = format3DCost(modelConfig)?.replace('≈ ', '')

  if (isProcessing) {
    return (
      <PendingCard
        aspect="square"
        status={asset.status === 'processing' ? 'Building mesh…' : 'Queued…'}
        eta="Usually 1–5 minutes"
        progress={asset.progress ?? 0}
        title={title}
        cost={cost}
      />
    )
  }

  const menuActions: Array<CardAction> = [
    ...(isCompleted && onView
      ? [{ label: 'View model', icon: Eye, onClick: onView }]
      : []),
    ...availableFormats.map(([format, url]) => ({
      label:
        downloadingFormat === format
          ? `Downloading .${format.toUpperCase()}…`
          : `Download .${format.toUpperCase()}`,
      icon: downloadingFormat === format ? Loader2 : Download,
      disabled: downloadingFormat === format,
      onClick: () => void handleDownload(url, format),
    })),
    ...(onDelete
      ? [
          {
            label: 'Delete',
            icon: Trash2,
            onClick: onDelete,
            destructive: true,
          },
        ]
      : []),
  ]

  return (
    <ResultCard
      aspect="square"
      title={title}
      cost={cost}
      onSelect={() => onView?.()}
      menuLabel="Model actions"
      menuActions={menuActions}
      media={
        <>
          {asset.thumbnailUrl && !imageError ? (
            <img
              src={asset.thumbnailUrl}
              alt={asset.prompt || 'Generated 3D model'}
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Box className="h-10 w-10 text-muted-foreground/60" />
            </div>
          )}
          {isFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 p-4 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <span className="text-sm text-destructive">Failed</span>
              {asset.error && (
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {asset.error}
                </span>
              )}
            </div>
          )}
        </>
      }
    />
  )
}
