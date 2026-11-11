import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { MeshSettingsPanel } from './MeshSettingsPanel'
import { MultiImagePicker } from './MultiImagePicker'
import type { MeshSettings } from './MeshSettingsPanel'
import type { SelectedImage } from './MultiImagePicker'
import {
  Field,
  GenerateButton,
  LabPanel,
  ModelRadioList,
  PromptBox,
} from '@/components/generate'
import { IMAGE_TO_3D_MODELS, get3DModelById } from '@/server/services/types'
import { format3DCost } from './cost'
import type { Model3DPanelTabs } from './tabs'

// NOTE: Server functions are dynamically imported in queryFn/mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions

export function ImageTo3DPanel(tabs: Model3DPanelTabs) {
  const queryClient = useQueryClient()

  // Form state
  const [modelId, setModelId] = useState(
    IMAGE_TO_3D_MODELS.find((m) => m.id === 'hunyuan3d-v3-image')?.id ||
      IMAGE_TO_3D_MODELS[0].id,
  )
  const [images, setImages] = useState<Array<SelectedImage>>([])
  const [prompt, setPrompt] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Mesh settings
  const [meshSettings, setMeshSettings] = useState<MeshSettings>({
    enablePbr: false,
    faceCount: 500000,
    generateType: 'Normal',
    topology: 'triangle',
    targetPolycount: 30000,
    symmetryMode: 'auto',
    shouldRemesh: true,
  })

  const modelConfig = get3DModelById(modelId)
  const isHunyuan = modelConfig?.id.includes('hunyuan')
  const isMeshy = modelConfig?.id.includes('meshy')
  const isSketch = modelConfig?.id === 'hunyuan3d-v3-sketch'
  const requiresPrompt = modelConfig?.requiresPrompt

  // Get max images based on model
  const getMaxImages = () => {
    if (modelConfig?.maxImages) return modelConfig.maxImages
    if (modelConfig?.supportsMultipleImages) return 4
    return 1
  }

  // Get image labels for Hunyuan multi-view
  const getImageLabels = () => {
    if (modelId === 'hunyuan3d-v3-image') {
      return ['Front', 'Back', 'Left', 'Right']
    }
    return undefined
  }

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
        throw new Error('Please select at least one image')
      }

      if (requiresPrompt && !prompt.trim()) {
        throw new Error('This model requires a text description')
      }

      // Build image URLs based on model type
      const imageUrls = images.map((img) => img.url)

      // For Hunyuan multi-view, map to specific fields
      let backImageUrl: string | undefined
      let leftImageUrl: string | undefined
      let rightImageUrl: string | undefined

      if (modelId === 'hunyuan3d-v3-image' && images.length > 1) {
        backImageUrl = images[1]?.url
        leftImageUrl = images[2]?.url
        rightImageUrl = images[3]?.url
      }

      const { generate3DModelFn } = await import('@/server/model3d.server')
      return generate3DModelFn({
        data: {
          modelId,
          mode: 'image-to-3d',
          prompt: prompt.trim() || undefined,
          imageUrl: imageUrls[0],
          imageUrls: imageUrls.length > 1 ? imageUrls : undefined,
          backImageUrl,
          leftImageUrl,
          rightImageUrl,
          enablePbr: meshSettings.enablePbr,
          faceCount: isHunyuan ? meshSettings.faceCount : undefined,
          generateType: isHunyuan ? meshSettings.generateType : undefined,
          topology: isMeshy ? meshSettings.topology : undefined,
          targetPolycount: isMeshy ? meshSettings.targetPolycount : undefined,
          symmetryMode: isMeshy ? meshSettings.symmetryMode : undefined,
          shouldRemesh: isMeshy ? meshSettings.shouldRemesh : undefined,
          isATpose: meshSettings.isATpose,
        },
      })
    },
    onSuccess: () => {
      toast.success('3D model generation started!')
      queryClient.invalidateQueries({ queryKey: ['3d-models'] })
      setImages([])
      setPrompt('')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Generation failed')
    },
  })

  const handleGenerate = () => {
    generateMutation.mutate()
  }

  const meshType = isHunyuan
    ? 'hunyuan'
    : isMeshy
      ? 'meshy'
      : modelId === 'rodin-v2'
        ? 'rodin'
        : null
  const costLabel = format3DCost(modelConfig, {
    mesh: meshSettings,
    imageCount: images.length,
  })

  return (
    <LabPanel
      title="Image to 3D"
      subtitle="Lift an object or a person out of a photo."
      {...tabs}
      footer={
        <GenerateButton
          label="Generate"
          icon={Sparkles}
          busy={generateMutation.isPending}
          busyLabel="Starting…"
          costLabel={costLabel}
          disabled={
            generateMutation.isPending ||
            images.length === 0 ||
            (!!requiresPrompt && !prompt.trim())
          }
          onClick={handleGenerate}
          hint="Billed to your fal account · models take 1–5 minutes"
        />
      }
    >
      <Field
        label={getMaxImages() > 1 ? 'Images' : 'Image'}
        hint={getMaxImages() > 1 ? `up to ${getMaxImages()}` : undefined}
      >
        <MultiImagePicker
          images={images}
          onChange={setImages}
          maxImages={getMaxImages()}
          labels={getImageLabels()}
          galleryImages={galleryImages}
          onUpload={handleUpload}
        />
        {modelId === 'hunyuan3d-v3-image' && (
          <p className="mt-2 text-xs text-muted-foreground">
            Back / left / right views are optional; adding any costs $0.15.
          </p>
        )}
      </Field>

      {(requiresPrompt || isSketch) && (
        <Field
          label="Description"
          hint={requiresPrompt ? undefined : 'optional'}
        >
          <PromptBox
            value={prompt}
            onChange={setPrompt}
            rows={3}
            max={1024}
            placeholder={
              isSketch
                ? 'Describe the attributes (color, material, etc.)'
                : 'Describe the object…'
            }
          />
        </Field>
      )}

      <Field label="Model">
        <ModelRadioList
          models={IMAGE_TO_3D_MODELS}
          value={modelId}
          onChange={(id) => {
            setModelId(id)
            // slot layouts differ per model (Hunyuan views vs Rodin's 5)
            setImages([])
          }}
          footnote="Rates are fal's prices per model at default settings."
        />
      </Field>

      {meshType && (
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showAdvanced ? '− Mesh settings' : '+ Mesh settings'}
          </button>
          {showAdvanced && (
            <MeshSettingsPanel
              className="mt-4"
              settings={meshSettings}
              onChange={setMeshSettings}
              modelType={meshType}
            />
          )}
        </div>
      )}
    </LabPanel>
  )
}
