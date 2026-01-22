'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Model3DModelSelect } from './Model3DModelSelect'
import { MeshSettingsPanel, type MeshSettings } from './MeshSettingsPanel'
import { MultiImagePicker, type SelectedImage } from './MultiImagePicker'
import { generate3DModelFn } from '@/server/model3d.fn'
import { get3DModelById, IMAGE_TO_3D_MODELS } from '@/server/services/types'
import { listUserImagesFn, uploadUserImageFn } from '@/server/image.fn'

interface ImageTo3DPanelProps {
  className?: string
}

export function ImageTo3DPanel({ className }: ImageTo3DPanelProps) {
  const queryClient = useQueryClient()

  // Form state
  const [modelId, setModelId] = useState(
    IMAGE_TO_3D_MODELS.find((m) => m.id === 'hunyuan3d-v3-image')?.id ||
      IMAGE_TO_3D_MODELS[0].id,
  )
  const [images, setImages] = useState<SelectedImage[]>([])
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

  return (
    <div className={cn('space-y-4', className)}>
      {/* Image picker */}
      <div className="space-y-2">
        <MultiImagePicker
          images={images}
          onChange={setImages}
          maxImages={getMaxImages()}
          labels={getImageLabels()}
          galleryImages={galleryImages}
          onUpload={handleUpload}
        />
        {modelConfig?.supportsMultipleImages && (
          <p className="text-xs text-muted-foreground">
            {modelConfig.dropdownDescription}
          </p>
        )}
      </div>

      {/* Prompt input (for models that require/support it) */}
      {(requiresPrompt || isSketch) && (
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            isSketch
              ? 'Describe the 3D model attributes (color, material, etc.)'
              : 'Describe the object...'
          }
          className="min-h-[60px] resize-none text-base rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60"
        />
      )}

      {/* Settings Row - Premium Styling */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Model Selector */}
        <Model3DModelSelect
          mode="image-to-3d"
          value={modelId}
          onChange={(id) => {
            setModelId(id)
            // Reset images when changing models
            setImages([])
          }}
        />

        {/* Advanced Settings Toggle */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                'text-xs font-medium transition-colors rounded-lg px-3 py-1.5',
                showAdvanced
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {showAdvanced ? '- Advanced' : '+ Advanced'}
            </button>
          </CollapsibleTrigger>
        </Collapsible>

        {/* Credits Display - Premium Badge */}
        {modelConfig && (
          <div className="ml-auto flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-medium text-primary">
              {modelConfig.credits} credits
            </span>
          </div>
        )}

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={
            generateMutation.isPending ||
            images.length === 0 ||
            (requiresPrompt && !prompt.trim())
          }
          className="rounded-xl bg-primary hover:bg-primary/90 btn-primary-glow transition-all duration-200"
          size="default"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </>
          )}
        </Button>
      </div>

      {/* Advanced settings content */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleContent className="pt-2">
          <MeshSettingsPanel
            settings={meshSettings}
            onChange={setMeshSettings}
            modelType={isHunyuan ? 'hunyuan' : isMeshy ? 'meshy' : 'generic'}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
