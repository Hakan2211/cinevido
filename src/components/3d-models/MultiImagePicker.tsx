'use client'

import { useState, useRef } from 'react'
import { Plus, X, Image as ImageIcon, Upload, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

export interface SelectedImage {
  url: string
  source: 'gallery' | 'upload'
  label?: string
}

interface MultiImagePickerProps {
  images: SelectedImage[]
  onChange: (images: SelectedImage[]) => void
  maxImages: number
  labels?: string[] // Optional labels like ['Front', 'Back', 'Left', 'Right']
  galleryImages?: Array<{ id: string; url: string; thumbnailUrl?: string }>
  onUpload?: (file: File) => Promise<string> // Returns uploaded URL
  className?: string
}

export function MultiImagePicker({
  images,
  onChange,
  maxImages,
  labels,
  galleryImages = [],
  onUpload,
  className,
}: MultiImagePickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const slots = Array.from({ length: maxImages }, (_, i) => ({
    index: i,
    image: images[i] || null,
    label: labels?.[i],
  }))

  const handleAddClick = (slotIndex: number) => {
    setActiveSlot(slotIndex)
    setDialogOpen(true)
  }

  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    onChange(newImages)
  }

  const handleSelectFromGallery = (galleryImage: {
    id: string
    url: string
  }) => {
    if (activeSlot === null) return

    const newImages = [...images]
    newImages[activeSlot] = {
      url: galleryImage.url,
      source: 'gallery',
      label: labels?.[activeSlot],
    }
    onChange(newImages)
    setDialogOpen(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || activeSlot === null || !onUpload) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB')
      return
    }

    setUploading(true)
    try {
      const url = await onUpload(file)
      const newImages = [...images]
      newImages[activeSlot] = {
        url,
        source: 'upload',
        label: labels?.[activeSlot],
      }
      onChange(newImages)
      setDialogOpen(false)
    } catch (err) {
      console.error('Upload failed:', err)
      toast.error('Failed to upload image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-2">
        {slots.map(({ index, image, label }) => (
          <div
            key={index}
            className={cn(
              'relative w-20 h-20 rounded-lg border-2 border-dashed',
              'flex items-center justify-center',
              'transition-colors',
              image
                ? 'border-primary/50 bg-muted'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50 bg-muted/30',
            )}
          >
            {image ? (
              <>
                <img
                  src={image.url}
                  alt={label || `Image ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={() => handleRemove(index)}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
                {label && (
                  <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center bg-black/60 text-white py-0.5 rounded-b-lg">
                    {label}
                  </span>
                )}
              </>
            ) : (
              <button
                onClick={() => handleAddClick(index)}
                className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-5 w-5" />
                {label && <span className="text-[10px]">{label}</span>}
              </button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Select Image
              {activeSlot !== null && labels?.[activeSlot] && (
                <span className="text-muted-foreground font-normal">
                  {' '}
                  - {labels[activeSlot]}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="gallery">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="gallery" className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Gallery
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gallery" className="mt-4">
              {galleryImages.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto p-1">
                  {galleryImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => handleSelectFromGallery(img)}
                      className={cn(
                        'aspect-square rounded-lg overflow-hidden border-2 border-transparent',
                        'hover:border-primary focus:border-primary focus:outline-none',
                        'transition-all',
                      )}
                    >
                      <img
                        src={img.thumbnailUrl || img.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mb-2" />
                  <p>No images in gallery</p>
                  <p className="text-sm">Generate or upload images first</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="image-upload"
                />
                <ImageIcon className="h-12 w-12 mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Upload an image from your device
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !onUpload}
                >
                  {uploading ? 'Uploading...' : 'Choose File'}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  PNG, JPG, WebP up to 10MB
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
