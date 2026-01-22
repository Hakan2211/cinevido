'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Model3DCard } from './Model3DCard'
import {
  listUser3DModelsFn,
  get3DModelStatusFn,
  delete3DModelFn,
} from '@/server/model3d.fn'
import type { Model3DMode } from '@/server/services/types'

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

  // Fetch models
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['3d-models', mode],
    queryFn: () => listUser3DModelsFn({ data: { limit: 50, mode } }),
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
    mutationFn: (assetId: string) => delete3DModelFn({ data: { assetId } }),
    onSuccess: () => {
      toast.success('Model deleted')
      queryClient.invalidateQueries({ queryKey: ['3d-models'] })
    },
    onError: () => {
      toast.error('Failed to delete model')
    },
  })

  const handleDelete = (assetId: string) => {
    if (confirm('Are you sure you want to delete this model?')) {
      deleteMutation.mutate(assetId)
    }
  }

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
        'flex flex-col items-center justify-center py-24',
        className,
      )}
    >
      <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-8 border border-primary/10">
        <Box className="h-16 w-16 text-primary/70" />
      </div>
      <h3 className="mt-8 text-xl font-semibold">
        No {getModeLabel()} models yet
      </h3>
      <p className="mt-3 text-muted-foreground text-center max-w-md">
        Create your first {getModeLabel()} model using the panel below
      </p>
    </div>
  )

  // If loading AND we have no previous data, show empty state immediately
  // This prevents jarring loading → error flow for new users
  if (isLoading && !data) {
    return <EmptyState />
  }

  // If loading but we have cached data, show skeletons while refreshing
  if (isLoading && data && assets.length > 0) {
    return (
      <div
        className={cn(
          'grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 px-2',
          className,
        )}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    )
  }

  // Only show error state if we had data before and now failed (genuine error)
  if (error && data && assets.length > 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-24',
          className,
        )}
      >
        <div className="rounded-2xl bg-destructive/10 p-8 border border-destructive/20">
          <AlertCircle className="h-16 w-16 text-destructive/70" />
        </div>
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
    )
  }

  // If error on first load OR no assets, show empty state (graceful fallback)
  if (assets.length === 0) {
    return <EmptyState />
  }

  return (
    <div
      className={cn(
        'grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 px-2',
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
  )
}
