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
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  Calendar,
  Check,
  Copy,
  Download,
  Hash,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  MessageSquare,
  Paintbrush,
  Play,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
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
import { ModelSelect } from '@/components/ui/model-select'
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

// Calculate aspect ratio from dimensions
function getAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(width, height)
  const ratioW = width / divisor
  const ratioH = height / divisor
  // Simplify common ratios
  if (ratioW === 16 && ratioH === 9) return '16:9'
  if (ratioW === 9 && ratioH === 16) return '9:16'
  if (ratioW === 4 && ratioH === 3) return '4:3'
  if (ratioW === 3 && ratioH === 4) return '3:4'
  if (ratioW === 1 && ratioH === 1) return '1:1'
  if (ratioW === 21 && ratioH === 9) return '21:9'
  if (ratioW === 9 && ratioH === 21) return '9:21'
  // For other ratios, try to approximate to common ones
  const ratio = width / height
  if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.05) return '3:4'
  if (Math.abs(ratio - 1) < 0.05) return '1:1'
  return `${ratioW}:${ratioH}`
}

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
  const limit = 20
  const loadMoreRef = useRef<HTMLDivElement>(null)

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

  // Fetch images with infinite scroll
  const {
    data: imagesData,
    isLoading: imagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['images'],
    queryFn: ({ pageParam = 0 }) =>
      listUserImagesFn({ data: { limit, offset: pageParam * limit } }),
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * limit
      return loadedCount < lastPage.total ? allPages.length : undefined
    },
    initialPageParam: 0,
  })

  const models = modelsData?.models || []
  // Flatten all pages into single array
  const images = imagesData?.pages.flatMap((page) => page.images) ?? []
  const total = imagesData?.pages[0]?.total ?? 0

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

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
      <div className="flex items-center justify-between px-2 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Images</h1>
          <p className="text-sm text-muted-foreground mt-1">
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
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            loadMoreRef={loadMoreRef}
            numImages={numImages}
            onSelect={setSelectedImage}
            onDownload={handleDownload}
            onAnimate={handleAnimate}
            onCopyPrompt={handleCopyPrompt}
            onDelete={handleDelete}
            onEdit={handleEditImage}
          />
        ) : (
          // Edit/Upscale Mode: Premium Preview + Image Selector
          <div className="grid gap-8 lg:grid-cols-2 px-2">
            {/* Preview Area - Premium Styling */}
            <div className="space-y-4">
              <div className="aspect-square rounded-2xl border border-border/30 bg-card/30 overflow-hidden shadow-lg">
                {selectedEditImages.length > 0 ? (
                  selectedEditImages.length === 1 ? (
                    // Single image preview - fills container
                    <img
                      src={selectedEditImages[0].url}
                      alt="Selected"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // Multi-image grid preview
                    <div className="h-full w-full grid grid-cols-2 gap-2 p-2">
                      {selectedEditImages.slice(0, 4).map((img, idx) => (
                        <div
                          key={img.id}
                          className="relative overflow-hidden rounded-xl"
                        >
                          <img
                            src={img.url}
                            alt={`Selected ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center active-glow">
                            {idx + 1}
                          </div>
                        </div>
                      ))}
                      {selectedEditImages.length > 4 && (
                        <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full">
                          +{selectedEditImages.length - 4} more
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-4">
                    <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-6 border border-primary/10">
                      <ImageIcon className="h-12 w-12 text-primary/50" />
                    </div>
                    <p className="text-muted-foreground text-center">
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
                <div className="flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium">
                    Processing... {progress > 0 && `${progress}%`}
                  </span>
                </div>
              )}
            </div>

            {/* Image Selector Grid - Premium Styling */}
            <div>
              <h3 className="mb-4 text-lg font-semibold">
                Select Image
                {mode === 'edit' && maxImagesForModel > 1 ? 's' : ''}
                {mode === 'edit' && maxImagesForModel > 1 && (
                  <span className="ml-2 text-sm text-muted-foreground font-normal">
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

              <div className="grid grid-cols-3 md:grid-cols-4 gap-3 max-h-[450px] overflow-y-auto pr-2">
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
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/20'
                          : 'border-border/30 hover:border-primary/30 hover:shadow-md'
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.prompt || 'Image'}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center">
                          {mode === 'edit' && maxImagesForModel > 1 ? (
                            <div className="bg-primary text-primary-foreground text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center active-glow">
                              {selectionIndex + 1}
                            </div>
                          ) : (
                            <div className="bg-primary rounded-full p-2 active-glow">
                              <Check className="h-5 w-5 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              {images.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No images yet. Generate some first!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Panel - Premium Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 p-4 pb-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/20 p-5">
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
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/30">
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
  hasNextPage: boolean | undefined
  isFetchingNextPage: boolean
  loadMoreRef: React.RefObject<HTMLDivElement | null>
  numImages: number
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
  hasNextPage,
  isFetchingNextPage,
  loadMoreRef,
  numImages,
  onSelect,
  onDownload,
  onAnimate,
  onCopyPrompt,
  onDelete,
  onEdit,
}: GenerateGalleryProps) {
  if (isLoading && images.length === 0) {
    return (
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 px-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    )
  }

  if (images.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-8 border border-primary/10">
          <ImageIcon className="h-16 w-16 text-primary/70" />
        </div>
        <h3 className="mt-8 text-xl font-semibold">No images yet</h3>
        <p className="mt-3 text-muted-foreground text-center max-w-md">
          Describe your vision below and press Enter to create your first
          AI-generated masterpiece
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 px-2">
        {isGenerating &&
          Array.from({ length: numImages }).map((_, i) => (
            <Card
              key={`generating-${i}`}
              className="aspect-square overflow-hidden rounded-2xl border-border/50 bg-card/50 p-0"
            >
              <div className="relative h-full w-full bg-gradient-to-br from-muted to-muted/50">
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-foreground">
                    {jobStatus?.status === 'processing'
                      ? `Creating ${i + 1}/${numImages}...`
                      : 'Starting...'}
                  </p>
                  {progress > 0 && (
                    <div className="mt-4 w-32">
                      <div className="h-2 overflow-hidden rounded-full bg-primary/20">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        {progress}%
                      </p>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
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

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="col-span-full flex justify-center py-8">
        {isFetchingNextPage && (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
        {!hasNextPage && images.length > 0 && (
          <p className="text-sm text-muted-foreground">No more images</p>
        )}
      </div>
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
      {/* Premium Textarea with Floating Generate Button */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder="Describe the image you want to create..."
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="min-h-[80px] resize-none pr-28 text-base rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60"
          rows={2}
        />
        <Button
          size="default"
          className="absolute bottom-3 right-3 rounded-xl bg-primary hover:bg-primary/90 btn-primary-glow transition-all duration-200"
          onClick={onGenerate}
          disabled={!prompt.trim() || isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </>
          )}
        </Button>
      </div>

      {/* Settings Row - Premium Styling */}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {/* Model Selector with Icons */}
        <ModelSelect
          value={model}
          onValueChange={onModelChange}
          models={models}
          showDescription={true}
          showProvider={true}
        />

        {/* GPT Image Quality Selector */}
        {model === 'fal-ai/gpt-image-1.5' && (
          <Select value={gptQuality} onValueChange={onGptQualityChange}>
            <SelectTrigger className="h-9 w-32 rounded-xl border-border/50 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
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
            <SelectTrigger className="h-9 w-40 rounded-xl border-border/50 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {RECRAFT_STYLES.map((style) => (
                <SelectItem key={style.id} value={style.id}>
                  {style.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Number of Images Slider - Premium Styling */}
        {supportsNumImages && (
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Batch
            </span>
            <Slider
              value={[numImages]}
              onValueChange={([value]) => onNumImagesChange(value)}
              min={1}
              max={maxNumImages}
              step={1}
              className="w-20"
            />
            <span className="text-sm font-medium w-4 text-primary">
              {numImages}
            </span>
          </div>
        )}

        {/* Aspect Ratio Selector - Premium Pills */}
        <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio.id}
              onClick={() => onAspectRatioChange(ratio.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded-lg ${
                aspectRatio === ratio.id
                  ? 'bg-primary text-primary-foreground active-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {ratio.name}
            </button>
          ))}
        </div>

        {/* Negative Prompt Toggle */}
        <button
          onClick={onToggleNegativePrompt}
          className={`text-xs font-medium transition-colors rounded-lg px-3 py-1.5 ${
            showNegativePrompt
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          {showNegativePrompt ? '- Negative' : '+ Negative'}
        </button>

        {/* Credits Display - Premium Badge */}
        <div className="ml-auto flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-medium text-primary">
            {getDisplayedCredits()} credits
          </span>
        </div>
      </div>

      {/* Negative Prompt Input */}
      {showNegativePrompt && (
        <div className="mt-4">
          <Textarea
            placeholder="What to avoid in the image..."
            value={negativePrompt}
            onChange={(e) => onNegativePromptChange(e.target.value)}
            className="h-16 resize-none text-sm rounded-xl border-border/50 bg-background/50"
          />
        </div>
      )}

      {/* Error Display */}
      {(error || jobStatus?.status === 'failed') && (
        <div className="mt-3 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2">
          <p className="text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : jobStatus?.error || 'Generation failed'}
          </p>
        </div>
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
    <div className="space-y-6 px-6 pb-6">
      {/* Image Preview with Glow Border */}
      <div className="overflow-hidden rounded-2xl border border-primary/20 premium-glow aspect-square">
        <img
          src={image.url}
          alt={image.prompt || 'Generated image'}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Prompt Card */}
      {image.prompt && (
        <div className="rounded-xl border border-border/30 bg-card/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">Prompt</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs hover:bg-primary/10 hover:text-primary"
              onClick={() => onCopyPrompt(image.prompt!)}
            >
              {copiedPrompt ? (
                <Check className="mr-1 h-3 w-3" />
              ) : (
                <Copy className="mr-1 h-3 w-3" />
              )}
              {copiedPrompt ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-sm leading-relaxed">{image.prompt}</p>
        </div>
      )}

      {/* Metadata Card */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-4">
        <div className="grid grid-cols-2 gap-4">
          {image.model && (
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Model</span>
                <p className="text-sm font-medium">
                  {image.model.split('/').pop()}
                </p>
              </div>
            </div>
          )}
          {image.metadata?.width && image.metadata?.height && (
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Maximize2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground">
                  Dimensions
                </span>
                <p className="text-sm font-medium">
                  {image.metadata.width} x {image.metadata.height}{' '}
                  <span className="text-muted-foreground">
                    (
                    {getAspectRatio(
                      image.metadata.width,
                      image.metadata.height,
                    )}
                    )
                  </span>
                </p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Created</span>
              <p className="text-sm font-medium">
                {new Date(image.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          {image.metadata?.seed && (
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Hash className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Seed</span>
                <p className="text-sm font-medium">{image.metadata.seed}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Primary Action: Animate */}
      <Button
        className="w-full rounded-xl bg-primary hover:bg-primary/90 btn-primary-glow h-11"
        onClick={() => onAnimate(image)}
      >
        <Play className="mr-2 h-4 w-4" />
        Animate
      </Button>

      {/* Secondary Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="rounded-xl border-border/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
          onClick={() => onDownload(image.url)}
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
        <Button
          variant="outline"
          className="rounded-xl border-border/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
          onClick={() => onEdit(image)}
        >
          <Paintbrush className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Use Prompt Button */}
      {image.prompt && (
        <Button
          variant="secondary"
          className="w-full rounded-xl hover:bg-primary/10 hover:text-primary"
          onClick={() => onUsePrompt(image.prompt!)}
        >
          <Wand2 className="mr-2 h-4 w-4" />
          Use this prompt
        </Button>
      )}

      {/* Delete Button - Separated at Bottom */}
      <div className="pt-2 border-t border-border/30">
        <Button
          variant="ghost"
          className="w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(image.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Image
        </Button>
      </div>
    </div>
  )
}

// Image Card Component - Premium Design
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
      <Card
        className="group cursor-pointer overflow-hidden rounded-2xl border-border/30 bg-card/30 p-0 transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
        onClick={onSelect}
      >
        <div className="relative aspect-square overflow-hidden">
          <img
            src={image.url}
            alt={image.prompt || 'Generated image'}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            loading="lazy"
          />

          {/* Frosted glass overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-all duration-300 group-hover:opacity-100 backdrop-blur-[2px]">
            {/* Action buttons - top right */}
            <div className="absolute right-3 top-3 flex gap-2 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white"
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
                    className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white"
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
                    className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white"
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
                      className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white"
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
                    className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-md border-white/20 hover:bg-destructive/80 text-white"
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

            {/* Prompt text at bottom */}
            {image.prompt && (
              <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <p className="line-clamp-3 text-sm text-white/90 leading-relaxed">
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
