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
import type {ImageMode} from '@/components/images';
import type {GptImageQuality, RecraftStyle} from '@/server/services/types';
import {
  deleteImageFn,
  generateImageFn,
  getImageJobStatusFn,
  getImageModelsFn,
  listUserImagesFn,
} from '@/server/image.fn'
import {
  createVariationFn,
  getEditJobStatusFn,
  inpaintImageFn,
  upscaleImageFn,
} from '@/server/edit.fn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
  BrushToolbar,
  EditPanel,
  ImageCanvas,
  
  ModeToggle,
  UpscalePanel,
  VariationsPanel
} from '@/components/images'
import {
  GPT_IMAGE_QUALITY_TIERS,
  
  RECRAFT_STYLES
  
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
  const canvasContainerRef = useRef<HTMLDivElement>(null)

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

  // Edit mode state
  const [editPrompt, setEditPrompt] = useState('')
  const [editModel, setEditModel] = useState('fal-ai/flux-pro/v1/fill')
  const [brushSize, setBrushSize] = useState(30)
  const [brushMode, setBrushMode] = useState<'draw' | 'erase'>('draw')
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null)
  const [selectedEditImage, setSelectedEditImage] = useState<{
    id: string
    url: string
    prompt: string | null
  } | null>(null)

  // Upscale mode state
  const [upscaleScale, setUpscaleScale] = useState(2)
  const [upscaleCreativity, setUpscaleCreativity] = useState(0.5)
  const [upscaleModel, setUpscaleModel] = useState('fal-ai/creative-upscaler')

  // Variations mode state
  const [variationPrompt, setVariationPrompt] = useState('')
  const [variationStrength, setVariationStrength] = useState(0.3)
  const [variationModel, setVariationModel] = useState(
    'fal-ai/flux-pro/v1.1/redux',
  )

  // UI state
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    null,
  )
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  // Generation state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [currentJobType, setCurrentJobType] = useState<
    'generate' | 'edit' | 'upscale' | 'variation' | null
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

  // Inpaint mutation
  const inpaintMutation = useMutation({
    mutationFn: inpaintImageFn,
    onSuccess: (result) => {
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

  // Variation mutation
  const variationMutation = useMutation({
    mutationFn: createVariationFn,
    onSuccess: (result) => {
      setCurrentJobId(result.jobId)
      setCurrentJobType('variation')
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
      // Reset mask after successful edit
      if (currentJobType === 'edit') {
        setMaskDataUrl(null)
        const container = canvasContainerRef.current as HTMLDivElement & {
          clearMask?: () => void
        }
        container?.clearMask?.()
      }
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
        // Model-specific options
        quality: model === 'fal-ai/gpt-image-1.5' ? gptQuality : undefined,
        style: model.includes('recraft') ? recraftStyle : undefined,
      },
    })
  }

  const handleInpaint = () => {
    if (
      !selectedEditImage ||
      !maskDataUrl ||
      !editPrompt.trim() ||
      isGenerating
    )
      return

    inpaintMutation.mutate({
      data: {
        imageUrl: selectedEditImage.url,
        maskUrl: maskDataUrl,
        prompt: editPrompt.trim(),
        model: editModel,
        sourceAssetId: selectedEditImage.id,
      },
    })
  }

  const handleUpscale = () => {
    if (!selectedEditImage || isGenerating) return

    upscaleMutation.mutate({
      data: {
        imageUrl: selectedEditImage.url,
        model: upscaleModel,
        scale: upscaleScale,
        creativity: upscaleCreativity,
        sourceAssetId: selectedEditImage.id,
      },
    })
  }

  const handleCreateVariation = () => {
    if (!selectedEditImage || isGenerating) return

    variationMutation.mutate({
      data: {
        imageUrl: selectedEditImage.url,
        prompt: variationPrompt.trim() || undefined,
        model: variationModel,
        strength: variationStrength,
        sourceAssetId: selectedEditImage.id,
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
    setSelectedEditImage({ id: image.id, url: image.url, prompt: image.prompt })
    setSelectedImage(null)
    handleModeChange('edit')
  }

  const handleSelectImageForEdit = (image: {
    id: string
    url: string
    prompt: string | null
  }) => {
    setSelectedEditImage(image)
    setMaskDataUrl(null)
  }

  const handleClearMask = () => {
    setMaskDataUrl(null)
    const container = canvasContainerRef.current as HTMLDivElement & {
      clearMask?: () => void
    }
    container?.clearMask?.()
  }

  const isGenerating =
    generateMutation.isPending ||
    inpaintMutation.isPending ||
    upscaleMutation.isPending ||
    variationMutation.isPending ||
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
    generateMutation.error ||
    inpaintMutation.error ||
    upscaleMutation.error ||
    variationMutation.error

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
            onLoadMore={() => setPage((p) => p + 1)}
            onSelect={setSelectedImage}
            onDownload={handleDownload}
            onAnimate={handleAnimate}
            onCopyPrompt={handleCopyPrompt}
            onDelete={handleDelete}
            onEdit={handleEditImage}
          />
        ) : (
          // Edit/Upscale/Variations Mode: Canvas + Image Selector
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Canvas / Preview */}
            <div className="space-y-3">
              {mode === 'edit' && (
                <BrushToolbar
                  brushSize={brushSize}
                  onBrushSizeChange={setBrushSize}
                  brushMode={brushMode}
                  onBrushModeChange={setBrushMode}
                  onClearMask={handleClearMask}
                />
              )}
              <div
                ref={canvasContainerRef}
                className="aspect-square rounded-lg border bg-muted/50 overflow-hidden"
              >
                {mode === 'edit' ? (
                  <ImageCanvas
                    imageUrl={selectedEditImage?.url || null}
                    brushSize={brushSize}
                    brushMode={brushMode}
                    onMaskChange={setMaskDataUrl}
                    className="h-full w-full"
                  />
                ) : selectedEditImage ? (
                  <img
                    src={selectedEditImage.url}
                    alt="Selected"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">
                      Select an image to {mode}
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
              <h3 className="mb-3 text-sm font-medium">Select Image</h3>
              <div className="grid grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
                {images.map((image) => {
                  const isSelected = selectedEditImage?.id === image.id
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
                          <Check className="h-6 w-6 text-primary" />
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
              onModelChange={setModel}
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
            />
          )}

          {mode === 'edit' && (
            <EditPanel
              prompt={editPrompt}
              onPromptChange={setEditPrompt}
              model={editModel}
              onModelChange={setEditModel}
              onGenerate={handleInpaint}
              isGenerating={isGenerating}
              hasMask={!!maskDataUrl}
              hasImage={!!selectedEditImage}
              error={
                inpaintMutation.error instanceof Error
                  ? inpaintMutation.error.message
                  : editJobStatus?.error
              }
            />
          )}

          {mode === 'upscale' && (
            <UpscalePanel
              scale={upscaleScale}
              onScaleChange={setUpscaleScale}
              creativity={upscaleCreativity}
              onCreativityChange={setUpscaleCreativity}
              model={upscaleModel}
              onModelChange={setUpscaleModel}
              onUpscale={handleUpscale}
              isUpscaling={isGenerating}
              hasImage={!!selectedEditImage}
              error={
                upscaleMutation.error instanceof Error
                  ? upscaleMutation.error.message
                  : editJobStatus?.error
              }
            />
          )}

          {mode === 'variations' && (
            <VariationsPanel
              prompt={variationPrompt}
              onPromptChange={setVariationPrompt}
              strength={variationStrength}
              onStrengthChange={setVariationStrength}
              model={variationModel}
              onModelChange={setVariationModel}
              onGenerate={handleCreateVariation}
              isGenerating={isGenerating}
              hasImage={!!selectedEditImage}
              error={
                variationMutation.error instanceof Error
                  ? variationMutation.error.message
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
        {isGenerating && (
          <Card className="aspect-square overflow-hidden">
            <div className="relative h-full w-full bg-muted">
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {jobStatus?.status === 'processing'
                    ? 'Creating...'
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
        )}

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
  models: Array<{ id: string; name: string; credits: number }>
  aspectRatio: string
  onAspectRatioChange: (v: string) => void
  showNegativePrompt: boolean
  onToggleNegativePrompt: () => void
  negativePrompt: string
  onNegativePromptChange: (v: string) => void
  onGenerate: () => void
  isGenerating: boolean
  selectedModel: { credits: number } | undefined
  error: Error | null
  jobStatus: { status?: string; error?: string | null } | undefined
  // Model-specific options
  gptQuality: GptImageQuality
  onGptQualityChange: (v: GptImageQuality) => void
  recraftStyle: RecraftStyle
  onRecraftStyleChange: (v: RecraftStyle) => void
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
}: GeneratePanelProps) {
  // Calculate displayed credits based on model-specific options
  const getDisplayedCredits = () => {
    if (model === 'fal-ai/gpt-image-1.5') {
      const tier = GPT_IMAGE_QUALITY_TIERS.find((t) => t.id === gptQuality)
      return tier?.credits || 4
    }
    if (model.includes('recraft') && recraftStyle === 'vector_illustration') {
      return (selectedModel?.credits || 4) * 2
    }
    return selectedModel?.credits || 3
  }
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
