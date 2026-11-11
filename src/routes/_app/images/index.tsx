/**
 * Image Lab — create, edit and upscale images.
 *
 * Left: one settings panel with Create / Edit / Upscale tabs (the tab is in
 * the URL as ?mode=generate|edit|upscale). Models are grouped Draft /
 * Workhorse / Hero / Specialists with their fal rate, controls appear only
 * when the selected model takes them, and the primary button shows what the
 * run will cost.
 * Right: the library as a results grid, each image with its model and
 * estimated cost; hover for Animate / Edit / Upscale / Download / Delete.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  ArrowUpCircle,
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
  Trash2,
  Wand2,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  EditModelConfig,
  GptImageOutputFormat,
  GptImageQuality,
  ModelConfig,
  SeedvrTargetResolution,
  TopazModelType,
  UpscaleModelConfig,
} from '@/server/services/types'
import {
  DEFAULT_MODELS,
  EDIT_MODELS,
  GPT_IMAGE_CUSTOM_SIZE_LIMITS,
  GPT_IMAGE_OUTPUT_FORMATS,
  IMAGE_MODELS,
  SEEDVR_TARGET_RESOLUTIONS,
  TOPAZ_MODELS,
  UPSCALE_MODELS,
  aspectRatioToGptImageSize,
  clampGptImageQuality,
  gptImageQualityTiers,
  isGptImageEditModel,
  isGptImageModel,
  snapGptImageDim,
  validateGptImageCustomSize,
} from '@/server/services/types'
// NOTE: Server functions are dynamically imported in queryFn/mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BeforeAfterSlider } from '@/components/images/BeforeAfterSlider'
import {
  AspectCards,
  EmptyImageDrop,
  Field,
  FieldError,
  FrameSlot,
  GenerateButton,
  ImagePickerDialog,
  LabPanel,
  LabResults,
  LabShell,
  Meta,
  ModelRadioList,
  PendingCard,
  PromptBox,
  ResultCard,
  Segmented,
} from '@/components/generate'
import type { CardAction, SlotImage } from '@/components/generate'
import { downloadFile, generateFilename } from '@/lib/download'
import { estimateCost, formatEstimate } from '@/lib/pricing'
import { cn } from '@/lib/utils'

type ImageMode = 'generate' | 'edit' | 'upscale'
const MODES: ReadonlyArray<{ value: ImageMode; label: string }> = [
  { value: 'generate', label: 'Create' },
  { value: 'edit', label: 'Edit' },
  { value: 'upscale', label: 'Upscale' },
]

export const Route = createFileRoute('/_app/images/')({
  component: ImagesPage,
  validateSearch: (search: Record<string, unknown>): { mode?: ImageMode } => ({
    // Unknown modes (e.g. stale ?mode=aging links) fall back to Create
    mode: MODES.some((m) => m.value === search.mode)
      ? (search.mode as ImageMode)
      : undefined,
  }),
})

const PROMPT_MAX = 4000
const EDIT_PROMPT_MAX = 2000 // edit.server.ts caps edit prompts

// Aspect ratio presets → the dimensions sent to the server
const ASPECT_RATIOS = [
  { id: '1:1', width: 1024, height: 1024 },
  { id: '3:4', width: 768, height: 1024 },
  { id: '4:3', width: 1024, height: 768 },
  { id: '16:9', width: 1024, height: 576 },
  { id: '9:16', width: 576, height: 1024 },
]

const SEEDVR_SCALES = [2, 3, 4, 6, 8, 10] as const
const TOPAZ_SCALES = [1, 2, 3, 4] as const
const SUBJECTS = ['All', 'Foreground', 'Background'] as const
type Subject = (typeof SUBJECTS)[number]

/** SeedVR target heights, for the output-megapixel estimate */
const TARGET_HEIGHT: Record<SeedvrTargetResolution, number> = {
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '2160p': 2160,
}

interface ImageMetadata {
  width?: number
  height?: number
  seed?: number
  quality?: string
  // set on edit/upscale results, for the before/after view
  sourceAssetId?: string
}

interface GeneratedImage {
  id: string
  url: string
  prompt: string | null
  model: string | null
  metadata: ImageMetadata | null
  createdAt: Date
}

/** What the pending cards show while a job runs */
interface PendingRun {
  kind: ImageMode
  count: number
  title: string
  cost: string | null
  prompt: string | null
  model: string
  sourceAssetId?: string
}

// Every model an image in the library can have come from
const MODEL_LOOKUP = new Map<string, { config: ModelConfig; kind: ImageMode }>([
  ...IMAGE_MODELS.map((m) => [m.id, { config: m, kind: 'generate' }] as const),
  ...EDIT_MODELS.map((m) => [m.id, { config: m, kind: 'edit' }] as const),
  ...UPSCALE_MODELS.map((m) => [m.id, { config: m, kind: 'upscale' }] as const),
])

function modelTitle(modelId: string | null): string {
  if (!modelId) return 'Upload'
  const hit = MODEL_LOOKUP.get(modelId)
  if (!hit) return modelId.split('/').slice(-2).join(' ')
  const { config, kind } = hit
  if (kind === 'upscale') return `${config.name} upscale`
  if (kind === 'edit' && !/edit/i.test(config.name))
    return `${config.name} edit`
  return config.name
}

/** Estimated cost of one finished image (fal doesn't report it back) */
function imageCost(image: GeneratedImage): string | null {
  const hit = image.model ? MODEL_LOOKUP.get(image.model) : undefined
  if (!hit) return null
  const label = formatEstimate(
    estimateCost(hit.config.pricing, {
      width: image.metadata?.width,
      height: image.metadata?.height,
      quality: image.metadata?.quality,
      resolution: '1K',
    }),
  )
  return label?.replace('≈ ', '') ?? null
}

function getAspectRatio(width: number, height: number): string {
  const ratio = width / height
  const known: Array<[string, number]> = [
    ['1:1', 1],
    ['4:3', 4 / 3],
    ['3:4', 3 / 4],
    ['16:9', 16 / 9],
    ['9:16', 9 / 16],
    ['21:9', 21 / 9],
    ['3:2', 3 / 2],
    ['2:3', 2 / 3],
  ]
  const hit = known.find(([, r]) => Math.abs(ratio - r) < 0.03)
  return hit ? hit[0] : `${ratio.toFixed(2)}:1`
}

function ImagesPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const mode: ImageMode = search.mode ?? 'generate'
  const queryClient = useQueryClient()
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const editPromptRef = useRef<HTMLTextAreaElement>(null)

  // ---- Create ----
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<string>(DEFAULT_MODELS.image)
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [numImages, setNumImages] = useState(1)
  const [gptQuality, setGptQuality] = useState<GptImageQuality>('high')
  const [gptOutputFormat, setGptOutputFormat] =
    useState<GptImageOutputFormat>('png')
  const [gptCustomWidth, setGptCustomWidth] = useState(1920)
  const [gptCustomHeight, setGptCustomHeight] = useState(1080)

  // ---- Edit ----
  const [editPrompt, setEditPrompt] = useState('')
  const [editModel, setEditModel] = useState<string>(DEFAULT_MODELS.edit)
  const [editRefs, setEditRefs] = useState<Array<SlotImage>>([])
  const [gptEditQuality, setGptEditQuality] = useState<GptImageQuality>('high')
  const [gptEditOutputFormat, setGptEditOutputFormat] =
    useState<GptImageOutputFormat>('png')

  // ---- Upscale ----
  const [upscaleModel, setUpscaleModel] = useState<string>(
    DEFAULT_MODELS.upscale,
  )
  const [upscaleSource, setUpscaleSource] = useState<SlotImage | null>(null)
  const [upscaleScale, setUpscaleScale] = useState(2)
  const [upscaleMode, setUpscaleMode] = useState<'factor' | 'target'>('factor')
  const [targetResolution, setTargetResolution] =
    useState<SeedvrTargetResolution>('1080p')
  const [noiseScale, setNoiseScale] = useState(0.1)
  const [topazModel, setTopazModel] = useState<TopazModelType>('Standard V2')
  const [subjectDetection, setSubjectDetection] = useState<Subject>('All')
  const [faceEnhancement, setFaceEnhancement] = useState(true)
  const [faceEnhancementStrength, setFaceEnhancementStrength] = useState(0.8)
  const [faceEnhancementCreativity, setFaceEnhancementCreativity] = useState(0)

  // ---- UI ----
  const [pickerFor, setPickerFor] = useState<'edit' | 'upscale' | null>(null)
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    null,
  )
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    imageId: string | null
  }>({ open: false, imageId: null })
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // ---- Job ----
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingRun | null>(null)
  // A failed job's message, shown on the tab that started it
  const [jobError, setJobError] = useState<{
    mode: ImageMode
    message: string
  } | null>(null)
  const lastQueueToastRef = useRef<number | null>(null)

  const limit = 24
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const setMode = useCallback(
    (next: ImageMode) =>
      navigate({
        to: '/images',
        search: { mode: next === 'generate' ? undefined : next },
        replace: true,
      }),
    [navigate],
  )

  // ---- Selected models ----
  const selectedModel = IMAGE_MODELS.find((m) => m.id === model)
  const selectedEditModel: EditModelConfig | undefined = EDIT_MODELS.find(
    (m) => m.id === editModel,
  )
  const selectedUpscaleModel: UpscaleModelConfig | undefined =
    UPSCALE_MODELS.find((m) => m.id === upscaleModel)
  const maxRefs = selectedEditModel?.maxImages ?? 1

  const isGpt = isGptImageModel(model)
  const isGptEdit = isGptImageEditModel(editModel)
  const isCustomSize = isGpt && aspectRatio === 'custom'
  const customSizeError = isCustomSize
    ? validateGptImageCustomSize(gptCustomWidth, gptCustomHeight)
    : null
  const dims = isCustomSize
    ? { width: gptCustomWidth, height: gptCustomHeight }
    : (ASPECT_RATIOS.find((r) => r.id === aspectRatio) ?? ASPECT_RATIOS[0])
  const batch = selectedModel?.supportsNumImages ? numImages : 1
  const isSeedVR = upscaleModel.includes('seedvr')
  const isTopaz = upscaleModel.includes('topaz')

  // ---- Costs ----
  const createCostOne = formatEstimate(
    estimateCost(selectedModel?.pricing, {
      width: dims.width,
      height: dims.height,
      quality: isGpt ? gptQuality : undefined,
      resolution: '1K',
    }),
  )
  const createCost = formatEstimate(
    estimateCost(selectedModel?.pricing, {
      numImages: batch,
      width: dims.width,
      height: dims.height,
      quality: isGpt ? gptQuality : undefined,
      resolution: '1K',
    }),
  )
  // Edits are priced per output image; megapixel models assume ~1MP output
  const editCost = formatEstimate(
    estimateCost(selectedEditModel?.pricing, {
      quality: isGptEdit ? gptEditQuality : undefined,
      resolution: '1K',
    }),
  )
  // Upscalers bill output megapixels
  const upscaleOut = useMemo(() => {
    const w = upscaleSource?.metadata?.width ?? 1024
    const h = upscaleSource?.metadata?.height ?? 1024
    if (isSeedVR && upscaleMode === 'target') {
      const th = TARGET_HEIGHT[targetResolution]
      return { width: Math.round((th * w) / h), height: th }
    }
    return { width: w * upscaleScale, height: h * upscaleScale }
  }, [upscaleSource, isSeedVR, upscaleMode, targetResolution, upscaleScale])
  const upscaleCost = formatEstimate(
    estimateCost(selectedUpscaleModel?.pricing, upscaleOut),
  )

  // ---- Library ----
  const {
    data: imagesData,
    isLoading: imagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['images'],
    queryFn: async ({ pageParam = 0 }) => {
      const { listUserImagesFn } = await import('@/server/image.server')
      return listUserImagesFn({ data: { limit, offset: pageParam * limit } })
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * limit
      return loadedCount < lastPage.total ? allPages.length : undefined
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })
  const images: Array<GeneratedImage> =
    imagesData?.pages.flatMap((page) => page.images) ?? []
  const total = imagesData?.pages[0]?.total ?? 0

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // ---- Mutations ----
  const generateMutation = useMutation({
    mutationFn: async (input: { data: Record<string, unknown> }) => {
      const { generateImageFn } = await import('@/server/image.server')
      return generateImageFn(input as never)
    },
    onSuccess: (result) => setCurrentJobId(result.jobId),
    onError: () => setPending(null),
  })

  const editMutation = useMutation({
    mutationFn: async (input: { data: Record<string, unknown> }) => {
      const { editImageFn } = await import('@/server/edit.server')
      return editImageFn(input as never)
    },
    onSuccess: (result) => setCurrentJobId(result.jobId),
    onError: () => setPending(null),
  })

  const upscaleMutation = useMutation({
    mutationFn: async (input: { data: Record<string, unknown> }) => {
      const { upscaleImageFn } = await import('@/server/edit.server')
      return upscaleImageFn(input as never)
    },
    onSuccess: (result) => setCurrentJobId(result.jobId),
    onError: () => setPending(null),
  })

  const deleteMutation = useMutation({
    mutationFn: async (input: { data: { imageId: string } }) => {
      const { deleteImageFn } = await import('@/server/image.server')
      return deleteImageFn(input as never)
    },
    onSuccess: (_result, input) => {
      const id = input.data.imageId
      queryClient.invalidateQueries({ queryKey: ['images'] })
      setSelectedImage(null)
      setEditRefs((refs) => refs.filter((r) => r.id !== id))
      setUpscaleSource((src) => (src?.id === id ? null : src))
      toast.success('Image deleted')
    },
  })

  // ---- Job polling (generate jobs and edit/upscale jobs live in different tables) ----
  const jobKind = pending?.kind
  const pollGenerate = !!currentJobId && jobKind === 'generate'
  const pollEdit = !!currentJobId && jobKind !== undefined && !pollGenerate

  const { data: imageJob, error: imageJobError } = useQuery({
    queryKey: ['imageJob', currentJobId],
    queryFn: async () => {
      const { getImageJobStatusFn } = await import('@/server/image.server')
      return getImageJobStatusFn({ data: { jobId: currentJobId! } })
    },
    enabled: pollGenerate,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'completed' || status === 'failed' ? false : 2000
    },
  })

  const { data: editJob, error: editJobError } = useQuery({
    queryKey: ['editJob', currentJobId],
    queryFn: async () => {
      const { getEditJobStatusFn } = await import('@/server/edit.server')
      return getEditJobStatusFn({ data: { jobId: currentJobId! } })
    },
    enabled: pollEdit,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'completed' || status === 'failed' ? false : 2000
    },
  })

  const job = pollGenerate ? imageJob : pollEdit ? editJob : undefined
  const jobQueryError = pollGenerate
    ? imageJobError
    : pollEdit
      ? editJobError
      : null
  // only generate jobs report a queue position
  const queuePosition = (job as { queuePosition?: number } | undefined)
    ?.queuePosition

  useEffect(() => {
    if (!currentJobId || !pending) return

    if (job?.status === 'completed') {
      const resultUrl: string | undefined =
        job.output?.url || job.output?.images?.[0]?.url
      const resultId: string | undefined =
        job.output?.assetId || job.output?.images?.[0]?.assetId
      queryClient.invalidateQueries({ queryKey: ['images'] })
      queryClient.invalidateQueries({ queryKey: ['falCredits'] })

      if (pending.kind !== 'generate' && resultUrl && resultId) {
        const result: GeneratedImage = {
          id: resultId,
          url: resultUrl,
          prompt: pending.prompt,
          model: pending.model,
          metadata: { sourceAssetId: pending.sourceAssetId },
          createdAt: new Date(),
        }
        toast.success(
          pending.kind === 'edit' ? 'Edit ready' : 'Upscale ready',
          {
            action: {
              label: 'Compare',
              onClick: () => setSelectedImage(result),
            },
          },
        )
      }
      setCurrentJobId(null)
      setPending(null)
    } else if (job?.status === 'failed' || jobQueryError) {
      const message =
        job?.error ||
        (jobQueryError instanceof Error
          ? jobQueryError.message
          : 'Generation failed')
      setJobError({ mode: pending.kind, message })
      toast.error(message)
      setCurrentJobId(null)
      setPending(null)
    }
  }, [job, jobQueryError, currentJobId, pending, queryClient])

  useEffect(() => {
    if (queuePosition && queuePosition >= 50) {
      const range = queuePosition >= 200 ? 200 : queuePosition >= 100 ? 100 : 50
      if (lastQueueToastRef.current !== range) {
        lastQueueToastRef.current = range
        if (queuePosition >= 200) {
          toast.error('fal.ai is overloaded', {
            description: `Queue position ${queuePosition}. Consider switching to a different model.`,
            duration: 8000,
          })
        } else {
          toast.warning('fal.ai is busy', {
            description: `Queue position ${queuePosition}. This may take longer than usual.`,
            duration: 6000,
          })
        }
      }
    } else if (!queuePosition) {
      lastQueueToastRef.current = null
    }
  }, [queuePosition])

  const isBusy =
    generateMutation.isPending ||
    editMutation.isPending ||
    upscaleMutation.isPending ||
    !!currentJobId

  const handleStopWaiting = useCallback(() => {
    setCurrentJobId(null)
    setPending(null)
    lastQueueToastRef.current = null
    toast.info('Stopped waiting for this image', {
      description: 'Pick a different model and try again.',
    })
  }, [])

  // ---- Actions ----
  const canCreate =
    !!prompt.trim() && !isBusy && !!selectedModel && !customSizeError
  const canEdit =
    editRefs.length > 0 && !!editPrompt.trim() && !isBusy && !!selectedEditModel
  const canUpscale = !!upscaleSource && !isBusy

  const handleCreate = () => {
    if (!canCreate || !selectedModel) return
    setJobError(null)
    setPending({
      kind: 'generate',
      count: batch,
      title: selectedModel.name,
      cost: createCostOne,
      prompt: prompt.trim(),
      model,
    })
    generateMutation.mutate({
      data: {
        prompt: prompt.trim(),
        model,
        width: dims.width,
        height: dims.height,
        negativePrompt:
          selectedModel.supportsNegativePrompt && negativePrompt.trim()
            ? negativePrompt.trim()
            : undefined,
        numImages: batch > 1 ? batch : undefined,
        quality: isGpt ? clampGptImageQuality(model, gptQuality) : undefined,
        // GPT Image: a preset for known ratios; for custom the server builds
        // image_size from width/height
        imageSizePreset:
          isGpt && !isCustomSize
            ? aspectRatioToGptImageSize(aspectRatio)
            : undefined,
        outputFormat: isGpt ? gptOutputFormat : undefined,
      },
    })
  }

  const handleEdit = () => {
    if (!canEdit || !selectedEditModel) return
    setJobError(null)
    setPending({
      kind: 'edit',
      count: 1,
      title: modelTitle(editModel),
      cost: editCost,
      prompt: editPrompt.trim(),
      model: editModel,
      sourceAssetId: editRefs[0]?.id,
    })
    editMutation.mutate({
      data: {
        imageUrls: editRefs.map((img) => img.url),
        prompt: editPrompt.trim(),
        model: editModel,
        sourceAssetIds: editRefs.map((img) => img.id),
        quality: isGptEdit
          ? clampGptImageQuality(editModel, gptEditQuality)
          : undefined,
        outputFormat: isGptEdit ? gptEditOutputFormat : undefined,
      },
    })
  }

  const handleUpscale = () => {
    if (!canUpscale || !upscaleSource) return
    setJobError(null)
    setPending({
      kind: 'upscale',
      count: 1,
      title: modelTitle(upscaleModel),
      cost: upscaleCost,
      prompt: upscaleSource.prompt,
      model: upscaleModel,
      sourceAssetId: upscaleSource.id,
    })
    upscaleMutation.mutate({
      data: {
        imageUrl: upscaleSource.url,
        model: upscaleModel,
        scale: upscaleScale,
        sourceAssetId: upscaleSource.id,
        sourceWidth: upscaleSource.metadata?.width,
        sourceHeight: upscaleSource.metadata?.height,
        ...(isSeedVR && {
          upscaleMode,
          targetResolution:
            upscaleMode === 'target' ? targetResolution : undefined,
          noiseScale,
        }),
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

  const runPrimary =
    mode === 'generate'
      ? handleCreate
      : mode === 'edit'
        ? handleEdit
        : handleUpscale

  // Ctrl/Cmd+Enter in a prompt runs the current tab; Esc closes the sheet
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        (e.metaKey || e.ctrlKey) &&
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        e.preventDefault()
        runPrimary()
      }
      if (e.key === 'Escape') setSelectedImage(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  const handleModelChange = (id: string) => {
    setModel(id)
    const next = IMAGE_MODELS.find((m) => m.id === id)
    if (!next?.supportsNumImages) setNumImages(1)
    else if (numImages > (next.maxNumImages ?? 4)) setNumImages(1)
    if (!isGptImageModel(id) && aspectRatio === 'custom') setAspectRatio('1:1')
    setGptQuality((q) => clampGptImageQuality(id, q))
  }

  const handleEditModelChange = (id: string) => {
    setEditModel(id)
    setGptEditQuality((q) => clampGptImageQuality(id, q))
    const next = EDIT_MODELS.find((m) => m.id === id)
    const max = next?.maxImages ?? 1
    if (editRefs.length > max) {
      setEditRefs(editRefs.slice(0, max))
      toast.info(
        `${next?.name ?? 'This model'} takes ${max} image${max === 1 ? '' : 's'} — kept the first ${max}.`,
      )
    }
  }

  const handleUpscaleModelChange = (id: string) => {
    setUpscaleModel(id)
    const next = UPSCALE_MODELS.find((m) => m.id === id)
    if (next && upscaleScale > next.maxScale) setUpscaleScale(2)
    if (id.includes('topaz') && !TOPAZ_SCALES.includes(upscaleScale as 1)) {
      setUpscaleScale(2)
    }
    if (id.includes('seedvr') && !SEEDVR_SCALES.includes(upscaleScale as 2)) {
      setUpscaleScale(2)
    }
  }

  const toSlot = (image: GeneratedImage): SlotImage => ({
    id: image.id,
    url: image.url,
    prompt: image.prompt,
    metadata: image.metadata,
  })

  const handleAnimate = (image: GeneratedImage) => {
    sessionStorage.setItem(
      'animateImage',
      JSON.stringify({ url: image.url, id: image.id }),
    )
    navigate({ to: '/videos' })
  }

  /** Edit from a card: on the Edit tab it adds a reference, otherwise starts one */
  const handleEditImage = (image: GeneratedImage) => {
    setSelectedImage(null)
    if (mode === 'edit') {
      if (editRefs.some((r) => r.id === image.id)) return
      if (editRefs.length >= maxRefs) {
        toast.info(`${selectedEditModel?.name} takes up to ${maxRefs} images`)
        return
      }
      setEditRefs([...editRefs, toSlot(image)])
    } else {
      setEditRefs([toSlot(image)])
      setMode('edit')
    }
    editPromptRef.current?.focus()
  }

  const handleUpscaleImage = (image: GeneratedImage) => {
    setSelectedImage(null)
    setUpscaleSource(toSlot(image))
    setMode('upscale')
  }

  const handleCopyPrompt = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  const handleUsePrompt = (text: string) => {
    setPrompt(text)
    setSelectedImage(null)
    setMode('generate')
    promptRef.current?.focus()
  }

  const handleDownload = async (url: string, imageId?: string) => {
    const filename = generateFilename(url, 'image')
    const trackingId = imageId || url
    await downloadFile(url, filename, {
      onStart: () => {
        setDownloadingId(trackingId)
        toast.info('Starting download...')
      },
      onComplete: () => {
        setDownloadingId(null)
        toast.success('Download complete!')
      },
      onError: (error) => {
        setDownloadingId(null)
        toast.error(`Download failed: ${error.message}`)
      },
    })
  }

  const mutationError =
    mode === 'generate'
      ? generateMutation.error
      : mode === 'edit'
        ? editMutation.error
        : upscaleMutation.error
  const panelError =
    mutationError instanceof Error
      ? mutationError.message
      : jobError?.mode === mode
        ? jobError.message
        : null

  // ---- Panel ----
  const panelTitle =
    mode === 'generate'
      ? 'Generate Image'
      : mode === 'edit'
        ? 'Edit Image'
        : 'Upscale Image'
  const panelSubtitle =
    mode === 'generate'
      ? 'Describe it and pick a model.'
      : mode === 'edit'
        ? 'Change an image with words, or combine several.'
        : 'Sharpen and enlarge an image.'

  const footer =
    mode === 'generate' ? (
      <GenerateButton
        label={batch > 1 ? `Generate ${batch}` : 'Generate'}
        icon={Wand2}
        busy={isBusy}
        busyLabel="Generating…"
        costLabel={createCost}
        disabled={!canCreate}
        onClick={handleCreate}
      />
    ) : mode === 'edit' ? (
      <GenerateButton
        label="Edit"
        icon={Paintbrush}
        busy={isBusy}
        busyLabel="Working…"
        costLabel={editCost}
        disabled={!canEdit}
        onClick={handleEdit}
      />
    ) : (
      <GenerateButton
        label={
          isSeedVR && upscaleMode === 'target'
            ? `Upscale to ${targetResolution}`
            : `Upscale ${upscaleScale}×`
        }
        icon={ArrowUpCircle}
        busy={isBusy}
        busyLabel="Upscaling…"
        costLabel={upscaleCost}
        disabled={!canUpscale}
        onClick={handleUpscale}
        hint="Billed to your fal account"
      />
    )

  return (
    <LabShell>
      {/* ================= Settings panel ================= */}
      <LabPanel
        title={panelTitle}
        subtitle={panelSubtitle}
        tabs={MODES}
        tab={mode}
        onTabChange={setMode}
        footer={footer}
      >
        {mode === 'generate' && (
          <>
            <Field label="Prompt">
              <PromptBox
                textareaRef={promptRef}
                value={prompt}
                onChange={setPrompt}
                max={PROMPT_MAX}
                placeholder="Describe the image — subject, setting, light, style…"
              />
            </Field>

            <Field label="Model">
              <ModelRadioList
                models={IMAGE_MODELS}
                value={model}
                onChange={handleModelChange}
                footnote="Rates are fal's prices at about 1 megapixel."
              />
            </Field>

            <Field label="Aspect ratio">
              <AspectCards
                ratios={[
                  ...ASPECT_RATIOS.map((r) => r.id),
                  ...(isGpt ? ['custom'] : []),
                ]}
                value={aspectRatio}
                onChange={setAspectRatio}
                labels={{ custom: 'Custom' }}
              />
              {isCustomSize && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <DimInput
                      label="Width"
                      value={gptCustomWidth}
                      onChange={setGptCustomWidth}
                    />
                    <DimInput
                      label="Height"
                      value={gptCustomHeight}
                      onChange={setGptCustomHeight}
                    />
                  </div>
                  <p
                    className={cn(
                      'text-xs',
                      customSizeError
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                    )}
                  >
                    {customSizeError ??
                      `Multiples of ${GPT_IMAGE_CUSTOM_SIZE_LIMITS.multipleOf}, up to ${GPT_IMAGE_CUSTOM_SIZE_LIMITS.maxEdge}px, aspect up to ${GPT_IMAGE_CUSTOM_SIZE_LIMITS.maxAspect}:1`}
                  </p>
                </div>
              )}
            </Field>

            {selectedModel?.supportsNumImages && (
              <Field label="Images per run">
                <Segmented
                  options={Array.from(
                    { length: selectedModel.maxNumImages ?? 4 },
                    (_, i) => ({ value: i + 1, label: String(i + 1) }),
                  )}
                  value={numImages}
                  onChange={setNumImages}
                />
              </Field>
            )}

            {isGpt && (
              <GptOptions
                modelId={model}
                quality={gptQuality}
                onQualityChange={setGptQuality}
                format={gptOutputFormat}
                onFormatChange={setGptOutputFormat}
              />
            )}

            {selectedModel?.supportsNegativePrompt && (
              <Field label="Negative prompt" hint="optional">
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to keep out of the image…"
                  rows={2}
                  className="block w-full resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-muted-foreground/60"
                />
              </Field>
            )}
          </>
        )}

        {mode === 'edit' && (
          <>
            <Field
              label="Images"
              aside={
                <span className="text-xs tabular-nums text-muted-foreground">
                  {editRefs.length} / {maxRefs}
                </span>
              }
            >
              {editRefs.length === 0 ? (
                <EmptyImageDrop
                  onPick={() => setPickerFor('edit')}
                  title="Choose images to edit"
                  hint={`Up to ${maxRefs} · upload or pick from your library`}
                />
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {editRefs.map((ref, i) => (
                    <FrameSlot
                      key={ref.id}
                      image={ref}
                      label={`Image ${i + 1}`}
                      aspect="square"
                      badge={i + 1}
                      onPick={() => setPickerFor('edit')}
                      onClear={() =>
                        setEditRefs(editRefs.filter((r) => r.id !== ref.id))
                      }
                    />
                  ))}
                  {editRefs.length < maxRefs && (
                    <FrameSlot
                      image={null}
                      label="Add"
                      aspect="square"
                      onPick={() => setPickerFor('edit')}
                      onClear={() => {}}
                    />
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {editRefs.length > 1
                  ? 'Refer to them by number in the prompt — “put the jacket from image 2 on the person in image 1”.'
                  : 'Edit one image, or add more to combine them. Tip: hover a result and press Edit to add it.'}
              </p>
            </Field>

            <Field label="Prompt">
              <PromptBox
                textareaRef={editPromptRef}
                value={editPrompt}
                onChange={setEditPrompt}
                max={EDIT_PROMPT_MAX}
                rows={4}
                placeholder="Describe the change — “make it golden hour”, “remove the car”…"
              />
            </Field>

            <Field label="Model">
              <ModelRadioList
                models={EDIT_MODELS}
                value={editModel}
                onChange={handleEditModelChange}
                footnote="Rates are fal's prices per output image at about 1 megapixel."
              />
            </Field>

            {isGptEdit && (
              <GptOptions
                modelId={editModel}
                quality={gptEditQuality}
                onQualityChange={setGptEditQuality}
                format={gptEditOutputFormat}
                onFormatChange={setGptEditOutputFormat}
              />
            )}
          </>
        )}

        {mode === 'upscale' && (
          <>
            <Field label="Image">
              {upscaleSource ? (
                <FrameSlot
                  image={upscaleSource}
                  label="Source"
                  onPick={() => setPickerFor('upscale')}
                  onClear={() => setUpscaleSource(null)}
                />
              ) : (
                <EmptyImageDrop onPick={() => setPickerFor('upscale')} />
              )}
              {upscaleSource?.metadata?.width &&
                upscaleSource.metadata.height && (
                  <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                    {upscaleSource.metadata.width} ×{' '}
                    {upscaleSource.metadata.height} → {upscaleOut.width} ×{' '}
                    {upscaleOut.height}
                  </p>
                )}
            </Field>

            <Field label="Model">
              <ModelRadioList
                models={UPSCALE_MODELS}
                value={upscaleModel}
                onChange={handleUpscaleModelChange}
                footnote="Billed on the output image's megapixels."
              />
            </Field>

            {isSeedVR && (
              <>
                <Field label="Size">
                  <Segmented
                    options={[
                      { value: 'factor', label: 'By factor' },
                      { value: 'target', label: 'To resolution' },
                    ]}
                    value={upscaleMode}
                    onChange={setUpscaleMode}
                  />
                  <div className="mt-2">
                    {upscaleMode === 'factor' ? (
                      <Segmented
                        options={SEEDVR_SCALES.map((s) => ({
                          value: s,
                          label: `${s}×`,
                        }))}
                        value={upscaleScale}
                        onChange={setUpscaleScale}
                      />
                    ) : (
                      <Segmented
                        options={SEEDVR_TARGET_RESOLUTIONS.map((r) => ({
                          value: r.id,
                          label: r.id,
                          title: r.description,
                        }))}
                        value={targetResolution}
                        onChange={setTargetResolution}
                      />
                    )}
                  </div>
                </Field>
                <Field
                  label="Noise"
                  aside={
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {Math.round(noiseScale * 100)}%
                    </span>
                  }
                >
                  <Slider
                    value={[noiseScale * 100]}
                    onValueChange={([v]) => setNoiseScale(v / 100)}
                    min={0}
                    max={100}
                    step={5}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {noiseScale < 0.2
                      ? 'Low: cleaner, stays close to the original.'
                      : noiseScale > 0.5
                        ? 'High: more invented detail, may change things.'
                        : 'Balanced.'}
                  </p>
                </Field>
              </>
            )}

            {isTopaz && (
              <>
                <Field label="Scale">
                  <Segmented
                    options={TOPAZ_SCALES.map((s) => ({
                      value: s,
                      label: `${s}×`,
                    }))}
                    value={upscaleScale}
                    onChange={setUpscaleScale}
                  />
                </Field>
                <Field label="Enhancement">
                  <Select
                    value={topazModel}
                    onValueChange={(v) => setTopazModel(v as TopazModelType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOPAZ_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="flex items-center gap-2">
                            {m.name}
                            <span className="text-xs text-muted-foreground">
                              {m.description}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Subject">
                  <Segmented
                    options={SUBJECTS.map((s) => ({ value: s, label: s }))}
                    value={subjectDetection}
                    onChange={setSubjectDetection}
                  />
                </Field>
                <div className="space-y-4 rounded-xl border border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Face enhancement</p>
                      <p className="text-xs text-muted-foreground">
                        Recovers detail in faces
                      </p>
                    </div>
                    <Switch
                      checked={faceEnhancement}
                      onCheckedChange={setFaceEnhancement}
                    />
                  </div>
                  {faceEnhancement && (
                    <>
                      <PercentSlider
                        label="Strength"
                        value={faceEnhancementStrength}
                        onChange={setFaceEnhancementStrength}
                      />
                      <PercentSlider
                        label="Creativity"
                        value={faceEnhancementCreativity}
                        onChange={setFaceEnhancementCreativity}
                      />
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {panelError && <FieldError>{panelError}</FieldError>}
      </LabPanel>

      {/* ================= Results ================= */}
      <LabResults count={total}>
        {imagesLoading && images.length === 0 ? (
          <div className={GRID}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : images.length === 0 && !pending ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-28 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-5 text-lg font-medium">No images yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Write a prompt on the left. Explore on a Draft model, then re-run
              the keeper on a Hero model.
            </p>
          </div>
        ) : (
          <>
            <div className={GRID}>
              {pending &&
                Array.from({ length: pending.count }).map((_, i) => (
                  <PendingCard
                    key={`pending-${i}`}
                    aspect="square"
                    status={
                      job?.status === 'processing'
                        ? pending.kind === 'upscale'
                          ? 'Upscaling…'
                          : 'Rendering…'
                        : 'Queued…'
                    }
                    eta="Usually under a minute"
                    progress={job?.progress ?? 0}
                    queuePosition={queuePosition}
                    onStopWaiting={handleStopWaiting}
                    title={pending.title}
                    cost={pending.cost}
                  />
                ))}

              {images.map((image) => (
                <ImageCard
                  key={image.id}
                  image={image}
                  onSelect={() => setSelectedImage(image)}
                  onAnimate={() => handleAnimate(image)}
                  onEdit={() => handleEditImage(image)}
                  onUpscale={() => handleUpscaleImage(image)}
                  onDownload={() => handleDownload(image.url, image.id)}
                  onCopyPrompt={
                    image.prompt
                      ? () => handleCopyPrompt(image.prompt!)
                      : undefined
                  }
                  onDelete={() =>
                    setDeleteDialog({ open: true, imageId: image.id })
                  }
                  isDownloading={downloadingId === image.id}
                  editLabel={mode === 'edit' ? 'Add to edit' : 'Edit'}
                />
              ))}
            </div>

            <div ref={loadMoreRef} className="flex justify-center py-8">
              {isFetchingNextPage && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
          </>
        )}
      </LabResults>

      {/* Image picker (edit references / upscale source) */}
      <ImagePickerDialog
        open={pickerFor !== null}
        onOpenChange={(open) => !open && setPickerFor(null)}
        title={
          pickerFor === 'edit'
            ? `Choose up to ${maxRefs} image${maxRefs === 1 ? '' : 's'}`
            : 'Choose an image to upscale'
        }
        multiple={pickerFor === 'edit' && maxRefs > 1}
        max={pickerFor === 'edit' ? maxRefs : 1}
        initial={pickerFor === 'edit' ? editRefs : []}
        onPick={(picked) => {
          if (pickerFor === 'edit') setEditRefs(picked.slice(0, maxRefs))
          else if (picked[0]) setUpscaleSource(picked[0])
        }}
      />

      {/* Detail sheet */}
      <Sheet open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-b border-border px-6 pt-6 pb-4">
            <SheetTitle>Image details</SheetTitle>
          </SheetHeader>
          {selectedImage && (
            <ImageDetail
              image={selectedImage}
              copiedPrompt={copiedPrompt}
              onCopyPrompt={handleCopyPrompt}
              onDownload={() =>
                handleDownload(selectedImage.url, selectedImage.id)
              }
              onAnimate={() => handleAnimate(selectedImage)}
              onEdit={() => handleEditImage(selectedImage)}
              onUpscale={() => handleUpscaleImage(selectedImage)}
              onUsePrompt={handleUsePrompt}
              onDelete={() =>
                setDeleteDialog({ open: true, imageId: selectedImage.id })
              }
              isDownloading={downloadingId === selectedImage.id}
            />
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title="Delete image?"
        description="This action cannot be undone. The image will be permanently removed from your library."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() =>
          deleteDialog.imageId &&
          deleteMutation.mutate({ data: { imageId: deleteDialog.imageId } })
        }
        isLoading={deleteMutation.isPending}
      />
    </LabShell>
  )
}

const GRID = 'grid grid-cols-2 gap-5 md:grid-cols-3 2xl:grid-cols-4'

// =============================================================================
// Pieces
// =============================================================================

function GptOptions({
  modelId,
  quality,
  onQualityChange,
  format,
  onFormatChange,
}: {
  modelId: string
  quality: GptImageQuality
  onQualityChange: (q: GptImageQuality) => void
  format: GptImageOutputFormat
  onFormatChange: (f: GptImageOutputFormat) => void
}) {
  return (
    <>
      <Field label="Quality">
        <Segmented
          size="sm"
          options={gptImageQualityTiers(modelId).map((t) => ({
            value: t.id as GptImageQuality,
            label: t.name,
            title: t.description,
          }))}
          value={quality}
          onChange={onQualityChange}
        />
      </Field>
      <Field label="Format">
        <Segmented
          size="sm"
          options={GPT_IMAGE_OUTPUT_FORMATS.map((f) => ({
            value: f.id as GptImageOutputFormat,
            label: f.name,
            title: f.description,
          }))}
          value={format}
          onChange={onFormatChange}
        />
      </Field>
    </>
  )
}

function DimInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}
      <Input
        type="number"
        min={GPT_IMAGE_CUSTOM_SIZE_LIMITS.multipleOf}
        max={GPT_IMAGE_CUSTOM_SIZE_LIMITS.maxEdge}
        step={GPT_IMAGE_CUSTOM_SIZE_LIMITS.multipleOf}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        onBlur={(e) => onChange(snapGptImageDim(Number(e.target.value)))}
        className="h-9 tabular-nums"
      />
    </label>
  )
}

function PercentSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <Slider
        value={[value * 100]}
        onValueChange={([v]) => onChange(v / 100)}
        min={0}
        max={100}
        step={5}
      />
    </div>
  )
}

function ImageCard({
  image,
  onSelect,
  onAnimate,
  onEdit,
  onUpscale,
  onDownload,
  onCopyPrompt,
  onDelete,
  isDownloading,
  editLabel,
}: {
  image: GeneratedImage
  onSelect: () => void
  onAnimate: () => void
  onEdit: () => void
  onUpscale: () => void
  onDownload: () => void
  onCopyPrompt?: () => void
  onDelete: () => void
  isDownloading: boolean
  editLabel: string
}) {
  const hoverActions: Array<CardAction> = [
    { label: 'Animate', icon: Play, onClick: onAnimate },
    { label: editLabel, icon: Paintbrush, onClick: onEdit },
    { label: 'Upscale', icon: ArrowUpCircle, onClick: onUpscale },
    {
      label: 'Download',
      icon: isDownloading ? Loader2 : Download,
      onClick: onDownload,
      disabled: isDownloading,
    },
    { label: 'Delete', icon: Trash2, onClick: onDelete, destructive: true },
  ]
  const menuActions: Array<CardAction> = [
    { label: 'Animate', icon: Play, onClick: onAnimate },
    { label: editLabel, icon: Paintbrush, onClick: onEdit },
    { label: 'Upscale', icon: ArrowUpCircle, onClick: onUpscale },
    ...(onCopyPrompt
      ? [{ label: 'Copy prompt', icon: Copy, onClick: onCopyPrompt }]
      : []),
    {
      label: 'Download',
      icon: Download,
      onClick: onDownload,
      disabled: isDownloading,
    },
    { label: 'Delete', icon: Trash2, onClick: onDelete, destructive: true },
  ]
  return (
    <ResultCard
      aspect="square"
      title={modelTitle(image.model)}
      cost={imageCost(image)}
      onSelect={onSelect}
      hoverActions={hoverActions}
      menuActions={menuActions}
      menuLabel="Image actions"
      media={
        <img
          src={image.url}
          alt={image.prompt || 'Generated image'}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      }
    />
  )
}

function ImageDetail({
  image,
  copiedPrompt,
  onCopyPrompt,
  onDownload,
  onAnimate,
  onEdit,
  onUpscale,
  onUsePrompt,
  onDelete,
  isDownloading,
}: {
  image: GeneratedImage
  copiedPrompt: boolean
  onCopyPrompt: (text: string) => void
  onDownload: () => void
  onAnimate: () => void
  onEdit: () => void
  onUpscale: () => void
  onUsePrompt: (text: string) => void
  onDelete: () => void
  isDownloading: boolean
}) {
  // Edit/upscale results link back to their source for a before/after view
  const sourceAssetId = image.metadata?.sourceAssetId
  const { data: sourceImage } = useQuery({
    queryKey: ['sourceImage', sourceAssetId],
    queryFn: async () => {
      const { getImageFn } = await import('@/server/image.server')
      return getImageFn({ data: { imageId: sourceAssetId! } })
    },
    enabled: !!sourceAssetId,
    staleTime: Infinity,
  })
  const cost = imageCost(image)

  return (
    <div className="space-y-5 p-6">
      {sourceAssetId && sourceImage?.url ? (
        <BeforeAfterSlider
          beforeImage={sourceImage.url}
          afterImage={image.url}
          beforeLabel="Original"
          afterLabel="Result"
          className="rounded-xl border border-border"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-muted">
          <img
            src={image.url}
            alt={image.prompt || 'Generated image'}
            className="w-full"
          />
        </div>
      )}

      {image.prompt && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">Prompt</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopyPrompt(image.prompt!)}
            >
              {copiedPrompt ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copiedPrompt ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-sm leading-relaxed">{image.prompt}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4">
        <Meta icon={Zap} label="Model">
          {modelTitle(image.model)}
          {cost && (
            <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
              {cost}
            </span>
          )}
        </Meta>
        {image.metadata?.width && image.metadata.height && (
          <Meta icon={Maximize2} label="Size">
            {image.metadata.width} × {image.metadata.height}{' '}
            <span className="font-normal text-muted-foreground">
              ({getAspectRatio(image.metadata.width, image.metadata.height)})
            </span>
          </Meta>
        )}
        <Meta icon={Calendar} label="Created">
          {new Date(image.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Meta>
        {image.metadata?.seed !== undefined && (
          <Meta icon={Hash} label="Seed">
            {image.metadata.seed}
          </Meta>
        )}
      </div>

      <Button className="w-full" onClick={onAnimate}>
        <Play className="h-4 w-4" />
        Animate
      </Button>
      <div className="grid grid-cols-3 gap-3">
        <Button variant="secondary" onClick={onEdit}>
          <Paintbrush className="h-4 w-4" />
          Edit
        </Button>
        <Button variant="secondary" onClick={onUpscale}>
          <ArrowUpCircle className="h-4 w-4" />
          Upscale
        </Button>
        <Button
          variant="secondary"
          disabled={isDownloading}
          onClick={onDownload}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download
        </Button>
      </div>
      {image.prompt && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => onUsePrompt(image.prompt!)}
        >
          <Wand2 className="h-4 w-4" />
          Use this prompt
        </Button>
      )}

      <div className="border-t border-border pt-3">
        <Button
          variant="ghost"
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete image
        </Button>
      </div>
    </div>
  )
}
