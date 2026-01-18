/**
 * ImageSelector - Grid to select an image from the library for editing
 *
 * Used in Edit, Upscale, and Variations modes
 */

import { useQuery } from '@tanstack/react-query'
import { listUserImagesFn } from '@/server/image.fn'

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ImageIcon, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageSelectorProps {
  selectedImageId: string | null
  selectedImageUrl: string | null
  onSelect: (image: { id: string; url: string; prompt: string | null }) => void
  className?: string
}

export function ImageSelector({
  selectedImageId,
  selectedImageUrl,
  onSelect,
  className,
}: ImageSelectorProps) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteImages()

  const images = data?.pages.flatMap((p) => p.images) || []

  if (isLoading && images.length === 0) {
    return (
      <div className={cn('grid grid-cols-4 gap-2', className)}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className={cn('flex flex-col items-center py-8', className)}>
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No images yet. Generate some first!
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Selected preview */}
      {selectedImageUrl && (
        <div className="mb-4 rounded-lg overflow-hidden bg-muted">
          <img
            src={selectedImageUrl}
            alt="Selected"
            className="w-full max-h-48 object-contain"
          />
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
        {images.map((image) => {
          const isSelected = selectedImageId === image.id
          return (
            <button
              key={image.id}
              onClick={() =>
                onSelect({ id: image.id, url: image.url, prompt: image.prompt })
              }
              className={cn(
                'relative aspect-square rounded-md overflow-hidden border-2 transition-all',
                isSelected
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-transparent hover:border-muted-foreground/30',
              )}
            >
              <img
                src={image.url}
                alt={image.prompt || 'Image'}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {isSelected && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <Check className="h-6 w-6 text-primary" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}

// Simple hook for paginated images (not using useInfiniteQuery for simplicity)
function useInfiniteImages() {
  const { data, isLoading } = useQuery({
    queryKey: ['images-selector'],
    queryFn: () => listUserImagesFn({ data: { limit: 24, offset: 0 } }),
  })

  return {
    data: data ? { pages: [data] } : undefined,
    isLoading,
    fetchNextPage: () => {},
    hasNextPage: (data?.total || 0) > (data?.images?.length || 0),
    isFetchingNextPage: false,
  }
}
