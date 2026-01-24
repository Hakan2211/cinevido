'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { MultiImagePicker  } from './MultiImagePicker'
import type {SelectedImage} from './MultiImagePicker';
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { generate3DModelFn } from '@/server/model3d.fn'
import { IMAGE_TO_WORLD_MODELS } from '@/server/services/types'
import { listUserImagesFn, uploadUserImageFn } from '@/server/image.fn'

interface ImageToWorldPanelProps {
  className?: string
}

export function ImageToWorldPanel({ className }: ImageToWorldPanelProps) {
  const queryClient = useQueryClient()

  // Form state - Hunyuan World is the only model
  const modelConfig = IMAGE_TO_WORLD_MODELS[0]
  const [images, setImages] = useState<Array<SelectedImage>>([])
  const [labelsFg1, setLabelsFg1] = useState('')
  const [labelsFg2, setLabelsFg2] = useState('')
  const [classes, setClasses] = useState('')

  // Fetch user's images for gallery
  const { data: galleryData } = useQuery({
    queryKey: ['images', 'gallery'],
    queryFn: () => listUserImagesFn({ data: { limit: 50 } }),
  })

  const galleryImages =
    galleryData?.images.map((img: { id: string; url: string }) => ({
      id: img.id,
      url: img.url,
      thumbnailUrl: img.url,
    })) || []

  // Handle image upload
  const handleUpload = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1]
          const result = await uploadUserImageFn({
            data: {
              imageData: base64,
              filename: file.name,
              contentType: file.type as
                | 'image/jpeg'
                | 'image/png'
                | 'image/webp'
                | 'image/gif',
            },
          })
          queryClient.invalidateQueries({ queryKey: ['images'] })
          resolve(result.image.url)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (images.length === 0) {
        throw new Error('Please select an image')
      }

      if (!labelsFg1.trim() || !labelsFg2.trim() || !classes.trim()) {
        throw new Error('Please fill in all label fields')
      }

      return generate3DModelFn({
        data: {
          modelId: modelConfig.id,
          mode: 'image-to-world',
          imageUrl: images[0].url,
          labelsFg1: labelsFg1.trim(),
          labelsFg2: labelsFg2.trim(),
          classes: classes.trim(),
        },
      })
    },
    onSuccess: () => {
      toast.success('World generation started!')
      queryClient.invalidateQueries({ queryKey: ['3d-models'] })
      setImages([])
      setLabelsFg1('')
      setLabelsFg2('')
      setClasses('')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Generation failed')
    },
  })

  const handleGenerate = () => {
    generateMutation.mutate()
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Image picker and labels side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Image picker */}
        <div className="space-y-2">
          <MultiImagePicker
            images={images}
            onChange={setImages}
            maxImages={1}
            galleryImages={galleryImages}
            onUpload={handleUpload}
          />
        </div>

        {/* Labels */}
        <div className="space-y-3">
          <Input
            id="labels-fg1"
            value={labelsFg1}
            onChange={(e) => setLabelsFg1(e.target.value)}
            placeholder="Foreground 1: tree, grass, sky"
            className="rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60"
          />
          <Input
            id="labels-fg2"
            value={labelsFg2}
            onChange={(e) => setLabelsFg2(e.target.value)}
            placeholder="Foreground 2: mountain, water"
            className="rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60"
          />
          <Input
            id="classes"
            value={classes}
            onChange={(e) => setClasses(e.target.value)}
            placeholder="Scene classes: nature, landscape"
            className="rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Settings Row - Premium Styling */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Info text */}
        <p className="text-xs text-muted-foreground">
          Transform images into explorable 3D panoramas
        </p>

        {/* Credits Display - Premium Badge */}
        <div className="ml-auto flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-medium text-primary">
            {modelConfig.credits} credits
          </span>
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={
            generateMutation.isPending ||
            images.length === 0 ||
            !labelsFg1.trim() ||
            !labelsFg2.trim() ||
            !classes.trim()
          }
          className="rounded-xl bg-primary hover:bg-primary/90 btn-primary-glow transition-all duration-200"
          size="default"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Globe className="mr-2 h-4 w-4" />
              Generate World
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
