import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Box, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Model3DCard } from './Model3DCard'
import type { Model3DMode } from '@/server/services/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// NOTE: Server functions are dynamically imported in queryFn/mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions

interface Model3DGalleryProps {
  mode?: Model3DMode
  onSelectAsset?: (assetId: string) => void
  className?: string
}

export function Model3DGallery({
  mode,
  onSelectAsset,
  className,
}: Model3DGalleryProps) {
  const queryClient = useQueryClient()
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    assetId: string | null
  }>({ open: false, assetId: null })

  // Fetch models
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['3d-models', mode],
    queryFn: async () => {
      const { listUser3DModelsFn } = await import('@/server/model3d.server')
      return listUser3DModelsFn({ data: { limit: 50, mode } })
    },
    refetchInterval: (query) => {
      // Poll more frequently if there are pending jobs
      const assets = query.state.data?.assets || []
      const hasPending = assets.some(
        (a: { status: string }) =>
          a.status === 'pending' || a.status === 'processing',
      )
      return hasPending ? 3000 : false
    },
  })

  const assets = data?.assets || []

  // Poll status for pending/processing assets
  const pendingAssets = assets.filter(
    (a: { status: string }) =>
      a.status === 'pending' || a.status === 'processing',
  )

  useEffect(() => {
    if (pendingAssets.length === 0) return

    const pollStatuses = async () => {
      const { get3DModelStatusFn } = await import('@/server/model3d.server')
      for (const asset of pendingAssets) {
        try {
          const status = await get3DModelStatusFn({
            data: { assetId: asset.id },
          })
          if (status.status === 'completed' || status.status === 'failed') {
            queryClient.invalidateQueries({ queryKey: ['3d-models'] })
            if (status.status === 'completed') {
              toast.success('3D model generation complete!')
            }
          }
        } catch (err) {
          console.error('Failed to poll status:', err)
        }
      }
    }

    const interval = setInterval(pollStatuses, 5000)
    return () => clearInterval(interval)
  }, [pendingAssets.length, queryClient])

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const { delete3DModelFn } = await import('@/server/model3d.server')
      return delete3DModelFn({ data: { assetId } })
    },
    onSuccess: () => {
      toast.success('Model deleted')
      queryClient.invalidateQueries({ queryKey: ['3d-models'] })
    },
    onError: () => {
      toast.error('Failed to delete model')
    },
  })

  const handleDelete = (assetId: string) => {
    setDeleteDialog({ open: true, assetId })
  }

  const handleConfirmDelete = () => {
    if (!deleteDialog.assetId) return
    deleteMutation.mutate(deleteDialog.assetId)
  }

  // Shared delete dialog component for all render paths
  const DeleteDialogComponent = (
    <ConfirmDialog
      open={deleteDialog.open}
      onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
      title="Delete 3D Model?"
      description="This action cannot be undone. The 3D model will be permanently removed from your library."
      confirmText="Delete"
      variant="destructive"
      onConfirm={handleConfirmDelete}
      isLoading={deleteMutation.isPending}
    />
  )

  // Helper function for mode-specific messaging
  const getModeLabel = () => {
    switch (mode) {
      case 'text-to-3d':
        return 'text-to-3D'
      case 'image-to-3d':
        return 'image-to-3D'
      case 'image-to-world':
        return 'image-to-world'
      default:
        return '3D'
    }
  }

  // Empty state component
  const EmptyState = () => (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-28 text-center',
        className,
      )}
    >
      <Box className="h-10 w-10 text-muted-foreground/50" />
      <h3 className="mt-5 text-lg font-medium">
        No {getModeLabel()} models yet
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Set up your first {getModeLabel()} model on the left.
      </p>
    </div>
  )

  // If loading AND we have no previous data, show empty state immediately
  // This prevents jarring loading → error flow for new users
  if (isLoading && !data) {
    return (
      <>
        <EmptyState />
        {DeleteDialogComponent}
      </>
    )
  }

  // If loading but we have cached data, show skeletons while refreshing
  if (isLoading && data && assets.length > 0) {
    return (
      <>
        <div
          className={cn(
            'grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3',
            className,
          )}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
        {DeleteDialogComponent}
      </>
    )
  }

  // Only show error state if we had data before and now failed (genuine error)
  if (error && data && assets.length > 0) {
    return (
      <>
        <div
          className={cn(
            'flex flex-col items-center justify-center py-24',
            className,
          )}
        >
          <AlertCircle className="h-10 w-10 text-destructive/70" />
          <h3 className="mt-8 text-xl font-semibold">Something went wrong</h3>
          <p className="mt-3 text-muted-foreground text-center max-w-md">
            We couldn't load your 3D models. Please try again.
          </p>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="mt-6 rounded-xl"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
        {DeleteDialogComponent}
      </>
    )
  }

  // If error on first load OR no assets, show empty state (graceful fallback)
  if (assets.length === 0) {
    return (
      <>
        <EmptyState />
        {DeleteDialogComponent}
      </>
    )
  }

  return (
    <>
      <div
        className={cn(
          'grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3',
          className,
        )}
      >
        {assets.map(
          (asset: {
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
          }) => (
            <Model3DCard
              key={asset.id}
              asset={asset}
              onView={() => onSelectAsset?.(asset.id)}
              onDelete={() => handleDelete(asset.id)}
            />
          ),
        )}
      </div>
      {DeleteDialogComponent}
    </>
  )
}
