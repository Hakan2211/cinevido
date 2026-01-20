/**
 * Images Page - Unified Create, Edit, Upscale & Variations
 *
 * Professional image interface with mode switching:
 * - Generate: Create new images from text prompts
 * - Edit: Inpaint/outpaint existing images with mask drawing
 * - Upscale: Enhance image resolution with AI
 * - Variations: Create variations from reference images
 */

import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Paintbrush,
  Play,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ImageMode } from '@/components/images'
import type {
  GptImageQuality,
  RecraftStyle,
  SeedvrTargetResolution,
  TopazModelType,
} from '@/server/services/types'
import {
  deleteImageFn,
  generateImageFn,
  getImageJobStatusFn,
  getImageModelsFn,
  listUserImagesFn,
} from '@/server/image.fn'
import {
  editImageFn,
  getEditJobStatusFn,
  upscaleImageFn,
} from '@/server/edit.fn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  EditPanel,
  ModeToggle,
  UploadDropZone,
  UpscalePanel,
} from '@/components/images'
import {
  GPT_IMAGE_QUALITY_TIERS,
  RECRAFT_STYLES,
  getEditModelById,
} from '@/server/services/types'

export const Route = createFileRoute('/_app/images/')({
  component: ImagesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    mode: (search.mode as ImageMode) || 'generate',
  }),
})

// Aspect ratio presets
const ASPECT_RATIOS = [
  { id: '1:1', name: '1:1', width: 1024, height: 1024 },
  { id: '3:4', name: '3:4', width: 768, height: 1024 },
  { id: '4:3', name: '4:3', width: 1024, height: 768 },
  { id: '16:9', name: '16:9', width: 1024, height: 576 },
  { id: '9:16', name: '9:16', width: 576, height: 1024 },
]

interface GeneratedImage {
  id: string
  url: string
  prompt: string | null
  model: string | null
  metadata: { width?: number; height?: number; seed?: number } | null
  createdAt: Date
}

function ImagesPage() {
  const navigate = useNavigate()
  const { mode: searchMode } = useSearch({ from: '/_app/images/' })
  const queryClient = useQueryClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Mode state
  const [mode, setMode] = useState<ImageMode>(searchMode || 'generate')

  // Generate form state
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(
    'imagineart/imagineart-1.5-preview/text-to-image',
  )
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [showNegativePrompt, setShowNegativePrompt] = useState(false)
  const [negativePrompt, setNegativePrompt] = useState('')

  // Model-specific options
  const [gptQuality, setGptQuality] = useState<GptImageQuality>('medium')
  const [recraftStyle, setRecraftStyle] =
    useState<RecraftStyle>('realistic_image')
  const [numImages, setNumImages] = useState(1)

  // Edit mode state (prompt-based, no masks!)
  const [editPrompt, setEditPrompt] = useState('')
  const [editModel, setEditModel] = useState('fal-ai/flux-pro/kontext')
  // Multi-image selection for edit mode
  const [selectedEditImages, setSelectedEditImages] = useState<
    Array<{
      id: string
      url: string
      prompt: string | null
    }>
  >([])

  // Upscale mode state
  const [upscaleModel, setUpscaleModel] = useState(
    'fal-ai/seedvr/upscale/image',
  )
  const [upscaleScale, setUpscaleScale] = useState(2)

  // SeedVR specific state
  const [upscaleMode, setUpscaleMode] = useState<'factor' | 'target'>('factor')
  const [targetResolution, setTargetResolution] =
    useState<SeedvrTargetResolution>('1080p')
  const [noiseScale, setNoiseScale] = useState(0.1)

  // Topaz specific state
  const [topazModel, setTopazModel] = useState<TopazModelType>('Standard V2')
  const [subjectDetection, setSubjectDetection] = useState<
    'All' | 'Foreground' | 'Background'
  >('All')
  const [faceEnhancement, setFaceEnhancement] = useState(true)
  const [faceEnhancementStrength, setFaceEnhancementStrength] = useState(0.8)
  const [faceEnhancementCreativity, setFaceEnhancementCreativity] = useState(0)

  // UI state
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    null,
  )
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  // Generation state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [currentJobType, setCurrentJobType] = useState<
    'generate' | 'edit' | 'upscale' | null
  >(null)

  // Pagination
  const [page, setPage] = useState(0)
  const limit = 20

  // Update URL when mode changes
  const handleModeChange = useCallback(
    (newMode: ImageMode) => {
      setMode(newMode)
      navigate({
        to: '/images',
        search: { mode: newMode },
        replace: true,
      })
    },
    [navigate],
  )

  // Fetch models
  const { data: modelsData } = useQuery({
    queryKey: ['imageModels'],
    queryFn: () => getImageModelsFn(),
  })

  // Fetch images
  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: ['images', page],
    queryFn: () => listUserImagesFn({ data: { limit, offset: page * limit } }),
  })

  const models = modelsData?.models || []
  const images = imagesData?.images || []
  const total = imagesData?.total || 0
  const hasMore = images.length + page * limit < total

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: generateImageFn,
    onSuccess: (result) => {
      setCurrentJobId(result.jobId)
      setCurrentJobType('generate')
    },
  })

  // Edit mutation (prompt-based, no masks!)
  const editMutation = useMutation({
    mutationFn: editImageFn,
    onSuccess: (result: { jobId: string }) => {
      setCurrentJobId(result.jobId)
      setCurrentJobType('edit')
    },
  })

  // Upscale mutation
  const upscaleMutation = useMutation({
    mutationFn: upscaleImageFn,
    onSuccess: (result) => {
      setCurrentJobId(result.jobId)
      setCurrentJobType('upscale')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteImageFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
      setSelectedImage(null)
    },
  })

  // Poll job status (for generate)
  const { data: jobStatus } = useQuery({
    queryKey: ['imageJob', currentJobId],
    queryFn: () => getImageJobStatusFn({ data: { jobId: currentJobId! } }),
    enabled: !!currentJobId && currentJobType === 'generate',
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') {
        return false
      }
      return 2000
    },
  })

  // Poll edit job status
  const { data: editJobStatus } = useQuery({
    queryKey: ['editJob', currentJobId],
    queryFn: () => getEditJobStatusFn({ data: { jobId: currentJobId! } }),
    enabled: !!currentJobId && currentJobType !== 'generate',
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') {
        return false
      }
      return 2000
    },
  })

  // Handle job completion
  useEffect(() => {
    const status = currentJobType === 'generate' ? jobStatus : editJobStatus
    if (status?.status === 'completed') {
      setCurrentJobId(null)
      setCurrentJobType(null)
      queryClient.invalidateQueries({ queryKey: ['images'] })
    }
  }, [jobStatus, editJobStatus, currentJobType, queryClient])

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const maxHeight = 120
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    }
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [prompt, adjustTextareaHeight])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        document.activeElement === textareaRef.current
      ) {
        e.preventDefault()
        handleGenerate()
      }
      if (e.key === 'Escape') {
        setSelectedImage(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [prompt, model, aspectRatio, negativePrompt])

  const handleGenerate = () => {
    if (!prompt.trim() || isGenerating) return

    const ratio =
      ASPECT_RATIOS.find((r) => r.id === aspectRatio) || ASPECT_RATIOS[0]

    generateMutation.mutate({
      data: {
        prompt: prompt.trim(),
        model,
        width: ratio.width,
        height: ratio.height,
        negativePrompt: negativePrompt.trim() || undefined,
        numImages: numImages > 1 ? numImages : undefined,
        // Model-specific options
        quality: model === 'fal-ai/gpt-image-1.5' ? gptQuality : undefined,
        style: model.includes('recraft') ? recraftStyle : undefined,
      },
    })
  }

  const handleEdit = () => {
    if (selectedEditImages.length === 0 || !editPrompt.trim() || isGenerating)
      return

    editMutation.mutate({
      data: {
        imageUrls: selectedEditImages.map((img) => img.url),
        prompt: editPrompt.trim(),
        model: editModel,
        sourceAssetIds: selectedEditImages.map((img) => img.id),
      },
    })
  }

  const handleUpscale = () => {
    if (selectedEditImages.length === 0 || isGenerating) return

    const isSeedVR = upscaleModel.includes('seedvr')
    const isTopaz = upscaleModel.includes('topaz')

    // Upscale only works with single image
    upscaleMutation.mutate({
      data: {
        imageUrl: selectedEditImages[0].url,
        model: upscaleModel,
        scale: upscaleScale,
        sourceAssetId: selectedEditImages[0].id,
        // SeedVR specific
        ...(isSeedVR && {
          upscaleMode,
          targetResolution:
            upscaleMode === 'target' ? targetResolution : undefined,
          noiseScale,
        }),
        // Topaz specific
        ...(isTopaz && {
          topazModel,
          subjectDetection,
          faceEnhancement,
          faceEnhancementStrength: faceEnhancement
            ? faceEnhancementStrength
            : undefined,
          faceEnhancementCreativity: faceEnhancement
            ? faceEnhancementCreativity
            : undefined,
        }),
      },
    })
  }

  const handleCopyPrompt = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  const handleDownload = (url: string, filename?: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `image-${Date.now()}.png`
    link.click()
  }

  const handleDelete = (imageId: string) => {
    if (confirm('Delete this image?')) {
      deleteMutation.mutate({ data: { imageId } })
    }
  }

  const handleAnimate = (image: GeneratedImage) => {
    sessionStorage.setItem(
      'animateImage',
      JSON.stringify({ url: image.url, id: image.id }),
    )
    navigate({ to: '/videos' })
  }

  const handleEditImage = (image: GeneratedImage) => {
    setSelectedEditImages([
      { id: image.id, url: image.url, prompt: image.prompt },
    ])
    setSelectedImage(null)
    handleModeChange('edit')
  }

  // Get current model's max images
  const currentEditModelConfig = getEditModelById(editModel)
  const maxImagesForModel = currentEditModelConfig?.maxImages || 1

  // Handle selecting/deselecting images for edit mode
  const handleSelectImageForEdit = (image: {
    id: string
    url: string
    prompt: string | null
  }) => {
    setSelectedEditImages((prev) => {
      const isAlreadySelected = prev.some((img) => img.id === image.id)

      if (isAlreadySelected) {
        // Deselect: remove from array
        return prev.filter((img) => img.id !== image.id)
      }

      // For single-image models, replace selection
      if (maxImagesForModel === 1) {
        return [image]
      }

      // For multi-image models, add if under limit
      if (prev.length >= maxImagesForModel) {
        toast.info(`Maximum ${maxImagesForModel} images for this model`)
        return prev
      }

      return [...prev, image]
    })
  }

  // Handle model change - trim selection if needed
  const handleEditModelChange = (newModel: string) => {
    const newModelConfig = getEditModelById(newModel)
    const newMaxImages = newModelConfig?.maxImages || 1

    setEditModel(newModel)

    // If current selection exceeds new model's limit, trim it
    if (selectedEditImages.length > newMaxImages) {
      const trimmed = selectedEditImages.slice(0, newMaxImages)
      setSelectedEditImages(trimmed)
      toast.info(
        `${newModelConfig?.name || 'This model'} supports ${newMaxImages} image${newMaxImages === 1 ? '' : 's'}. Kept first ${newMaxImages}.`,
      )
    }
  }

  const isGenerating =
    generateMutation.isPending ||
    editMutation.isPending ||
    upscaleMutation.isPending ||
    !!(
      currentJobId &&
      (currentJobType === 'generate'
        ? jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed'
        : editJobStatus?.status !== 'completed' &&
          editJobStatus?.status !== 'failed')
    )

  const selectedModel = models.find((m) => m.id === model)
  const progress =
    currentJobType === 'generate'
      ? jobStatus?.progress || 0
      : editJobStatus?.progress || 0

  const currentError =
    generateMutation.error || editMutation.error || upscaleMutation.error

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col">
      {/* Header with Mode Toggle */}
      <div className="flex items-center justify-between px-1 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Images</h1>
          <p className="text-sm text-muted-foreground">
            {total} image{total !== 1 ? 's' : ''} in your library
          </p>
        </div>
        <ModeToggle mode={mode} onModeChange={handleModeChange} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-48">
        {mode === 'generate' ? (
          // Generate Mode: Gallery Grid
          <GenerateGallery
            images={images}
            isLoading={imagesLoading}
            isGenerating={isGenerating}
            jobStatus={jobStatus}
            progress={progress}
            hasMore={hasMore}
            numImages={numImages}
            onLoadMore={() => setPage((p) => p + 1)}
            onSelect={setSelectedImage}
            onDownload={handleDownload}
            onAnimate={handleAnimate}
            onCopyPrompt={handleCopyPrompt}
            onDelete={handleDelete}
            onEdit={handleEditImage}
          />
        ) : (
          // Edit/Upscale/Variations Mode: Preview + Image Selector
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Preview Area */}
            <div className="space-y-3">
              <div className="aspect-square rounded-lg border bg-muted/50 overflow-hidden">
                {selectedEditImages.length > 0 ? (
                  selectedEditImages.length === 1 ? (
                    // Single image preview
                    <img
                      src={selectedEditImages[0].url}
                      alt="Selected"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    // Multi-image grid preview
                    <div className="h-full w-full grid grid-cols-2 gap-1 p-1">
                      {selectedEditImages.slice(0, 4).map((img, idx) => (
                        <div
                          key={img.id}
                          className="relative overflow-hidden rounded"
                        >
                          <img
                            src={img.url}
                            alt={`Selected ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {idx + 1}
                          </div>
                        </div>
                      ))}
                      {selectedEditImages.length > 4 && (
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          +{selectedEditImages.length - 4} more
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">
                      Select{' '}
                      {mode === 'edit' && maxImagesForModel > 1
                        ? 'image(s)'
                        : 'an image'}{' '}
                      to {mode}
                    </p>
                  </div>
                )}
              </div>
              {isGenerating && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing... {progress > 0 && `${progress}%`}
                </div>
              )}
            </div>

            {/* Image Selector Grid */}
            <div>
              <h3 className="mb-3 text-sm font-medium">
                Select Image
                {mode === 'edit' && maxImagesForModel > 1 ? 's' : ''}
                {mode === 'edit' && maxImagesForModel > 1 && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    (up to {maxImagesForModel})
                  </span>
                )}
              </h3>

              {/* Upload drop zone */}
              <UploadDropZone
                onUploadComplete={() => {
                  queryClient.invalidateQueries({ queryKey: ['images'] })
                }}
              />

              <div className="grid grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
                {images.map((image) => {
                  const selectionIndex = selectedEditImages.findIndex(
                    (img) => img.id === image.id,
                  )
                  const isSelected = selectionIndex !== -1
                  return (
                    <button
                      key={image.id}
                      onClick={() =>
                        handleSelectImageForEdit({
                          id: image.id,
                          url: image.url,
                          prompt: image.prompt,
                        })
                      }
                      className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-transparent hover:border-muted-foreground/30'
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.prompt || 'Image'}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          {mode === 'edit' && maxImagesForModel > 1 ? (
                            // Show number for multi-image models
                            <div className="bg-primary text-primary-foreground text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center">
                              {selectionIndex + 1}
                            </div>
                          ) : (
                            <Check className="h-6 w-6 text-primary" />
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              {images.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No images yet. Generate some first!
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Panel - Mode-specific */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:left-64">
        <div className="mx-auto max-w-4xl p-4">
          {mode === 'generate' && (
            <GeneratePanel
              prompt={prompt}
              onPromptChange={setPrompt}
              textareaRef={textareaRef}
              model={model}
              onModelChange={(newModel) => {
                setModel(newModel)
                // Reset numImages to 1 if new model doesn't support it
                const newModelConfig = models.find((m) => m.id === newModel)
                if (!newModelConfig?.supportsNumImages) {
                  setNumImages(1)
                }
              }}
              models={models}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              showNegativePrompt={showNegativePrompt}
              onToggleNegativePrompt={() =>
                setShowNegativePrompt(!showNegativePrompt)
              }
              negativePrompt={negativePrompt}
              onNegativePromptChange={setNegativePrompt}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              selectedModel={selectedModel}
              error={currentError}
              jobStatus={jobStatus}
              // Model-specific options
              gptQuality={gptQuality}
              onGptQualityChange={setGptQuality}
              recraftStyle={recraftStyle}
              onRecraftStyleChange={setRecraftStyle}
              numImages={numImages}
              onNumImagesChange={setNumImages}
            />
          )}

          {mode === 'edit' && (
            <EditPanel
              prompt={editPrompt}
              onPromptChange={setEditPrompt}
              model={editModel}
              onModelChange={handleEditModelChange}
              onGenerate={handleEdit}
              isGenerating={isGenerating}
              selectedCount={selectedEditImages.length}
              maxImages={maxImagesForModel}
              error={
                editMutation.error instanceof Error
                  ? editMutation.error.message
                  : editJobStatus?.error
              }
            />
          )}

          {mode === 'upscale' && (
            <UpscalePanel
              model={upscaleModel}
              onModelChange={setUpscaleModel}
              scale={upscaleScale}
              onScaleChange={setUpscaleScale}
              // SeedVR specific
              upscaleMode={upscaleMode}
              onUpscaleModeChange={setUpscaleMode}
              targetResolution={targetResolution}
              onTargetResolutionChange={setTargetResolution}
              noiseScale={noiseScale}
              onNoiseScaleChange={setNoiseScale}
              // Topaz specific
              topazModel={topazModel}
              onTopazModelChange={setTopazModel}
              subjectDetection={subjectDetection}
              onSubjectDetectionChange={setSubjectDetection}
              faceEnhancement={faceEnhancement}
              onFaceEnhancementChange={setFaceEnhancement}
              faceEnhancementStrength={faceEnhancementStrength}
              onFaceEnhancementStrengthChange={setFaceEnhancementStrength}
              faceEnhancementCreativity={faceEnhancementCreativity}
              onFaceEnhancementCreativityChange={setFaceEnhancementCreativity}
              // Actions
              onUpscale={handleUpscale}
              isUpscaling={isGenerating}
              hasImage={selectedEditImages.length > 0}
              error={
                upscaleMutation.error instanceof Error
                  ? upscaleMutation.error.message
                  : editJobStatus?.error
              }
            />
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <Sheet open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Image Details</SheetTitle>
          </SheetHeader>
          {selectedImage && (
            <ImageDetailPanel
              image={selectedImage}
              copiedPrompt={copiedPrompt}
              onCopyPrompt={handleCopyPrompt}
              onDownload={handleDownload}
              onAnimate={handleAnimate}
              onDelete={handleDelete}
              onEdit={handleEditImage}
              onUsePrompt={(p) => {
                setPrompt(p)
                setSelectedImage(null)
                textareaRef.current?.focus()
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// =============================================================================
// Sub-components
// =============================================================================

interface GenerateGalleryProps {
  images: Array<GeneratedImage>
  isLoading: boolean
  isGenerating: boolean
  jobStatus: { status?: string; progress?: number } | undefined
  progress: number
  hasMore: boolean
  numImages: number
  onLoadMore: () => void
  onSelect: (image: GeneratedImage) => void
  onDownload: (url: string) => void
  onAnimate: (image: GeneratedImage) => void
  onCopyPrompt: (text: string) => void
  onDelete: (id: string) => void
  onEdit: (image: GeneratedImage) => void
}

function GenerateGallery({
  images,
  isLoading,
  isGenerating,
  jobStatus,
  progress,
  hasMore,
  numImages,
  onLoadMore,
  onSelect,
  onDownload,
  onAnimate,
  onCopyPrompt,
  onDelete,
  onEdit,
}: GenerateGalleryProps) {
  if (isLoading && images.length === 0) {
    return (
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    )
  }

  if (images.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="rounded-full bg-muted p-6">
          <ImageIcon className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="mt-6 text-lg font-medium">No images yet</h3>
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
          Type a prompt below and press Enter to create your first AI-generated
          image
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {isGenerating &&
          Array.from({ length: numImages }).map((_, i) => (
            <Card
              key={`generating-${i}`}
              className="aspect-square overflow-hidden"
            >
              <div className="relative h-full w-full bg-muted">
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {jobStatus?.status === 'processing'
                      ? `Creating ${i + 1}/${numImages}...`
                      : 'Starting...'}
                  </p>
                  {progress > 0 && (
                    <div className="mt-3 w-24">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted-foreground/20">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
            </Card>
          ))}

        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            onSelect={() => onSelect(image)}
            onDownload={() => onDownload(image.url)}
            onAnimate={() => onAnimate(image)}
            onCopyPrompt={() => image.prompt && onCopyPrompt(image.prompt)}
            onDelete={() => onDelete(image.id)}
            onEdit={() => onEdit(image)}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </>
  )
}

interface GeneratePanelProps {
  prompt: string
  onPromptChange: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  model: string
  onModelChange: (v: string) => void
  models: Array<{
    id: string
    name: string
    credits: number
    supportsNumImages?: boolean
    maxNumImages?: number
  }>
  aspectRatio: string
  onAspectRatioChange: (v: string) => void
  showNegativePrompt: boolean
  onToggleNegativePrompt: () => void
  negativePrompt: string
  onNegativePromptChange: (v: string) => void
  onGenerate: () => void
  isGenerating: boolean
  selectedModel:
    | { credits: number; supportsNumImages?: boolean; maxNumImages?: number }
    | undefined
  error: Error | null
  jobStatus: { status?: string; error?: string | null } | undefined
  // Model-specific options
  gptQuality: GptImageQuality
  onGptQualityChange: (v: GptImageQuality) => void
  recraftStyle: RecraftStyle
  onRecraftStyleChange: (v: RecraftStyle) => void
  numImages: number
  onNumImagesChange: (v: number) => void
}

function GeneratePanel({
  prompt,
  onPromptChange,
  textareaRef,
  model,
  onModelChange,
  models,
  aspectRatio,
  onAspectRatioChange,
  showNegativePrompt,
  onToggleNegativePrompt,
  negativePrompt,
  onNegativePromptChange,
  onGenerate,
  isGenerating,
  selectedModel,
  error,
  jobStatus,
  gptQuality,
  onGptQualityChange,
  recraftStyle,
  onRecraftStyleChange,
  numImages,
  onNumImagesChange,
}: GeneratePanelProps) {
  // Calculate displayed credits based on model-specific options
  const getDisplayedCredits = () => {
    let baseCredits = selectedModel?.credits || 3
    if (model === 'fal-ai/gpt-image-1.5') {
      const tier = GPT_IMAGE_QUALITY_TIERS.find((t) => t.id === gptQuality)
      baseCredits = tier?.credits || 4
    }
    if (model.includes('recraft') && recraftStyle === 'vector_illustration') {
      baseCredits = (selectedModel?.credits || 4) * 2
    }
    // Multiply by number of images
    return baseCredits * numImages
  }

  const supportsNumImages = selectedModel?.supportsNumImages ?? false
  const maxNumImages = selectedModel?.maxNumImages ?? 4
  return (
    <>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder="Describe the image you want to create... (Press Enter to generate)"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="min-h-[52px] resize-none pr-24 text-base"
          rows={1}
        />
        <Button
          size="sm"
          className="absolute bottom-2 right-2"
          onClick={onGenerate}
          disabled={!prompt.trim() || isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Generate
            </>
          )}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="flex items-center gap-2">
                  {m.name}
                  <span className="text-xs text-muted-foreground">
                    {m.credits}cr
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* GPT Image Quality Selector */}
        {model === 'fal-ai/gpt-image-1.5' && (
          <Select value={gptQuality} onValueChange={onGptQualityChange}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GPT_IMAGE_QUALITY_TIERS.map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>
                  <span className="flex items-center gap-2">
                    {tier.name}
                    <span className="text-xs text-muted-foreground">
                      {tier.credits}cr
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Recraft Style Selector */}
        {model.includes('recraft') && (
          <Select value={recraftStyle} onValueChange={onRecraftStyleChange}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECRAFT_STYLES.map((style) => (
                <SelectItem key={style.id} value={style.id}>
                  {style.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Number of Images Slider - only shown for models that support it */}
        {supportsNumImages && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Images
            </span>
            <Slider
              value={[numImages]}
              onValueChange={([value]) => onNumImagesChange(value)}
              min={1}
              max={maxNumImages}
              step={1}
              className="w-20"
            />
            <span className="text-xs font-medium w-4">{numImages}</span>
          </div>
        )}

        <div className="flex rounded-md border">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio.id}
              onClick={() => onAspectRatioChange(ratio.id)}
              className={`px-2.5 py-1 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                aspectRatio === ratio.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {ratio.name}
            </button>
          ))}
        </div>

        <button
          onClick={onToggleNegativePrompt}
          className={`text-xs font-medium transition-colors ${
            showNegativePrompt
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {showNegativePrompt ? '- Hide negative' : '+ Negative prompt'}
        </button>

        <div className="ml-auto text-xs text-muted-foreground">
          {getDisplayedCredits()} credits
        </div>
      </div>

      {showNegativePrompt && (
        <div className="mt-3">
          <Textarea
            placeholder="What to avoid in the image..."
            value={negativePrompt}
            onChange={(e) => onNegativePromptChange(e.target.value)}
            className="h-16 resize-none text-sm"
          />
        </div>
      )}

      {(error || jobStatus?.status === 'failed') && (
        <p className="mt-2 text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : jobStatus?.error || 'Generation failed'}
        </p>
      )}
    </>
  )
}

interface ImageDetailPanelProps {
  image: GeneratedImage
  copiedPrompt: boolean
  onCopyPrompt: (text: string) => void
  onDownload: (url: string) => void
  onAnimate: (image: GeneratedImage) => void
  onDelete: (id: string) => void
  onEdit: (image: GeneratedImage) => void
  onUsePrompt: (prompt: string) => void
}

function ImageDetailPanel({
  image,
  copiedPrompt,
  onCopyPrompt,
  onDownload,
  onAnimate,
  onDelete,
  onEdit,
  onUsePrompt,
}: ImageDetailPanelProps) {
  return (
    <div className="mt-6 space-y-6">
      <div className="overflow-hidden rounded-lg bg-muted">
        <img
          src={image.url}
          alt={image.prompt || 'Generated image'}
          className="w-full object-contain"
        />
      </div>

      {image.prompt && (
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">
              Prompt
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopyPrompt(image.prompt!)}
            >
              {copiedPrompt ? (
                <Check className="mr-1.5 h-3 w-3" />
              ) : (
                <Copy className="mr-1.5 h-3 w-3" />
              )}
              {copiedPrompt ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <p className="mt-1 text-sm">{image.prompt}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        {image.model && (
          <div>
            <span className="text-muted-foreground">Model</span>
            <p className="font-medium">{image.model.split('/').pop()}</p>
          </div>
        )}
        {image.metadata?.width && (
          <div>
            <span className="text-muted-foreground">Dimensions</span>
            <p className="font-medium">
              {image.metadata.width} x {image.metadata.height}
            </p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Created</span>
          <p className="font-medium">
            {new Date(image.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        {image.metadata?.seed && (
          <div>
            <span className="text-muted-foreground">Seed</span>
            <p className="font-medium">{image.metadata.seed}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => onDownload(image.url)}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button variant="outline" onClick={() => onEdit(image)}>
            <Paintbrush className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button onClick={() => onAnimate(image)}>
            <Play className="mr-2 h-4 w-4" />
            Animate
          </Button>
        </div>
        <Button
          variant="outline"
          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => onDelete(image.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      {image.prompt && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => onUsePrompt(image.prompt!)}
        >
          <Wand2 className="mr-2 h-4 w-4" />
          Use this prompt
        </Button>
      )}
    </div>
  )
}

// Image Card Component
interface ImageCardProps {
  image: GeneratedImage
  onSelect: () => void
  onDownload: () => void
  onAnimate: () => void
  onCopyPrompt: () => void
  onDelete: () => void
  onEdit: () => void
}

function ImageCard({
  image,
  onSelect,
  onDownload,
  onAnimate,
  onCopyPrompt,
  onDelete,
  onEdit,
}: ImageCardProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Card className="group cursor-pointer overflow-hidden" onClick={onSelect}>
        <div className="relative aspect-square">
          <img
            src={image.url}
            alt={image.prompt || 'Generated image'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="absolute right-2 top-2 flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDownload()
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit()
                    }}
                  >
                    <Paintbrush className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAnimate()
                    }}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Animate</TooltipContent>
              </Tooltip>

              {image.prompt && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        onCopyPrompt()
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy prompt</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>

            {image.prompt && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                <p className="line-clamp-2 text-sm text-white">
                  {image.prompt}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </TooltipProvider>
  )
}
