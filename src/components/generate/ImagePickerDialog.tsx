/**
 * ImagePickerDialog — choose image(s) from the library or upload a new one.
 * Single mode picks on click; multiple mode toggles up to `max` and confirms.
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Image as ImageIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UploadDropZone } from '@/components/images/UploadDropZone'
import type { SlotImage } from './FrameSlot'

export function ImagePickerDialog({
  open,
  onOpenChange,
  title,
  multiple = false,
  max = 1,
  initial = [],
  onPick,
  emptyAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  multiple?: boolean
  max?: number
  /** Already chosen (multiple mode) — pre-selected when the dialog opens */
  initial?: ReadonlyArray<SlotImage>
  onPick: (images: Array<SlotImage>) => void
  /** Shown when the library is empty, under the upload zone */
  emptyAction?: React.ReactNode
}) {
  const [chosen, setChosen] = useState<Array<SlotImage>>([])

  useEffect(() => {
    if (open) setChosen(multiple ? [...initial] : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['images', 'picker'],
    queryFn: async () => {
      const { listUserImagesFn } = await import('@/server/image.server')
      return listUserImagesFn({ data: { limit: 60 } })
    },
    enabled: open,
  })
  const images: Array<SlotImage> = data?.images ?? []

  const toggle = (image: SlotImage) => {
    if (!multiple) {
      onPick([image])
      onOpenChange(false)
      return
    }
    setChosen((prev) =>
      prev.some((i) => i.id === image.id)
        ? prev.filter((i) => i.id !== image.id)
        : prev.length >= max
          ? prev
          : [...prev, image],
    )
  }

  const handleUploaded = async () => {
    const result = await refetch()
    const latest = result.data?.images?.[0]
    if (latest) toggle(latest)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <UploadDropZone onUploadComplete={handleUploaded} />
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No images yet — upload one above.
            </p>
            {emptyAction}
          </div>
        ) : (
          <div className="grid max-h-[50vh] gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
            {images.map((image) => {
              const index = chosen.findIndex((i) => i.id === image.id)
              const selected = index !== -1
              return (
                <button
                  type="button"
                  key={image.id}
                  className={cn(
                    'group relative aspect-square overflow-hidden rounded-xl border-2 transition-colors',
                    selected ? 'border-primary' : 'border-transparent',
                  )}
                  onClick={() => toggle(image)}
                >
                  <img
                    src={image.url}
                    alt={image.prompt || 'Image'}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {selected ? (
                    <span className="absolute top-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
                      {multiple ? index + 1 : <Check className="h-3.5 w-3.5" />}
                    </span>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Check className="h-7 w-7 text-white" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
        {multiple && (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground tabular-nums">
              {chosen.length} of {max} selected
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onPick(chosen)
                  onOpenChange(false)
                }}
              >
                Use {chosen.length === 1 ? 'image' : 'images'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
