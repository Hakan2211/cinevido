import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe } from 'lucide-react'
import { toast } from 'sonner'
import { MultiImagePicker } from './MultiImagePicker'
import type { SelectedImage } from './MultiImagePicker'
import { Input } from '@/components/ui/input'
import { Field, GenerateButton, LabPanel } from '@/components/generate'
import { formatRate } from '@/lib/pricing'
import { IMAGE_TO_WORLD_MODELS } from '@/server/services/types'
import { format3DCost } from './cost'
import type { Model3DPanelTabs } from './tabs'

// NOTE: Server functions are dynamically imported in queryFn/mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions

export function ImageToWorldPanel(tabs: Model3DPanelTabs) {
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
    queryFn: async () => {
      const { listUserImagesFn } = await import('@/server/image.server')
      return listUserImagesFn({ data: { limit: 50 } })
    },
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
          const { uploadUserImageFn } = await import('@/server/image.server')
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

      const { generate3DModelFn } = await import('@/server/model3d.server')
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
    <LabPanel
      title="Image to World"
      subtitle="Turn a picture into an explorable 3D panorama."
      {...tabs}
      footer={
        <GenerateButton
          label="Generate world"
          icon={Globe}
          busy={generateMutation.isPending}
          busyLabel="Starting…"
          costLabel={format3DCost(modelConfig)}
          disabled={
            generateMutation.isPending ||
            images.length === 0 ||
            !labelsFg1.trim() ||
            !labelsFg2.trim() ||
            !classes.trim()
          }
          onClick={handleGenerate}
          hint="Billed to your fal account · worlds take a few minutes"
        />
      }
    >
      <Field label="Image">
        <MultiImagePicker
          images={images}
          onChange={setImages}
          maxImages={1}
          galleryImages={galleryImages}
          onUpload={handleUpload}
        />
      </Field>

      <Field label="Foreground layer 1" hint="what sits closest">
        <Input
          value={labelsFg1}
          onChange={(e) => setLabelsFg1(e.target.value)}
          placeholder="tree, grass, rocks"
        />
      </Field>
      <Field label="Foreground layer 2">
        <Input
          value={labelsFg2}
          onChange={(e) => setLabelsFg2(e.target.value)}
          placeholder="mountain, water"
        />
      </Field>
      <Field label="Scene classes">
        <Input
          value={classes}
          onChange={(e) => setClasses(e.target.value)}
          placeholder="nature, landscape"
        />
      </Field>

      <p className="text-xs text-muted-foreground">
        {modelConfig.name} · {formatRate(modelConfig.pricing)}. The labels tell
        it which objects to separate into depth layers.
      </p>
    </LabPanel>
  )
}
