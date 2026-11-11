/**
 * Video Lab — generate and upscale clips.
 *
 * Left: one settings panel. The mode follows from what you give it: no frame
 * is text-to-video, a start frame is image-to-video, start + end frames are
 * keyframes — the model list follows. Models are grouped Draft / Workhorse /
 * Hero with their fal rate, and Generate shows what the run will cost.
 * Right: results, each with its model and estimated cost.
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
  AlertTriangle,
  ArrowUpCircle,
  Calendar,
  Check,
  Clock,
  Download,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Info,
  Loader2,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Play,
  Plus,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Trash2,
  Upload,
  Video,
  Wand2,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  TIER_LABELS,
  estimateCost,
  formatEstimate,
  formatRate,
} from '@/lib/pricing'
import type { ModelTier } from '@/lib/pricing'
import { cn } from '@/lib/utils'
// NOTE: Server functions are dynamically imported in queryFn/mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { Slider } from '../../../components/ui/slider'
import { Switch } from '../../../components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../../components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip'
import { VideoUpscalePanel } from '../../../components/videos/VideoUpscalePanel'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { UploadDropZone } from '../../../components/images/UploadDropZone'
import type {
  BytedanceVideoTargetFps,
  BytedanceVideoTargetResolution,
  SeedvrTargetResolution,
  SeedvrVideoOutputFormat,
  SeedvrVideoOutputQuality,
  VideoCapability,
  VideoModelConfig,
} from '../../../server/services/types'
import { downloadFile, generateFilename } from '@/lib/download'

export const Route = createFileRoute('/_app/videos/')({
  component: VideosPage,
})

const PROMPT_MAX = 2000

interface GeneratedVideo {
  id: string
  url: string
  prompt: string | null
  model: string | null
  durationSeconds: number | null
  metadata: {
    generationType?: string
    sourceImageUrl?: string
    sourceImageId?: string
    firstFrameUrl?: string
    lastFrameUrl?: string
    aspectRatio?: string
  } | null
  createdAt: Date
}

interface SelectedImage {
  id: string
  url: string
  prompt: string | null
}

type Tab = 'create' | 'upscale'

const ASPECT_ICONS: Record<string, typeof Square> = {
  '16:9': RectangleHorizontal,
  '21:9': RectangleHorizontal,
  '9:16': RectangleVertical,
  '1:1': Square,
}

function VideosPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [tab, setTab] = useState<Tab>('create')

  // Form state
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('')
  const [duration, setDuration] = useState<number>(5)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [generateAudio, setGenerateAudio] = useState(true)
  const [startFrame, setStartFrame] = useState<SelectedImage | null>(null)
  const [endFrame, setEndFrame] = useState<SelectedImage | null>(null)

  // UI state
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(
    null,
  )
  const [imagePickerTarget, setImagePickerTarget] = useState<
    'start' | 'end' | null
  >(null)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)

  // Video upscale state
  const [upscaleModel, setUpscaleModel] = useState(
    'fal-ai/seedvr/upscale/video',
  )
  const [upscaleVideoUrl, setUpscaleVideoUrl] = useState('')
  const [selectedUpscaleVideo, setSelectedUpscaleVideo] =
    useState<GeneratedVideo | null>(null)
  const [upscaleFactor, setUpscaleFactor] = useState(2)
  const [topazTargetFps, setTopazTargetFps] = useState<number | undefined>(
    undefined,
  )
  const [topazH264Output, setTopazH264Output] = useState(false)
  const [seedvrUpscaleMode, setSeedvrUpscaleMode] = useState<
    'factor' | 'target'
  >('factor')
  const [seedvrTargetResolution, setSeedvrTargetResolution] =
    useState<SeedvrTargetResolution>('1080p')
  const [seedvrNoiseScale, setSeedvrNoiseScale] = useState(0.1)
  const [seedvrOutputFormat, setSeedvrOutputFormat] =
    useState<SeedvrVideoOutputFormat>('X264 (.mp4)')
  const [seedvrOutputQuality, setSeedvrOutputQuality] =
    useState<SeedvrVideoOutputQuality>('high')
  const [bytedanceTargetResolution, setBytedanceTargetResolution] =
    useState<BytedanceVideoTargetResolution>('1080p')
  const [bytedanceTargetFps, setBytedanceTargetFps] =
    useState<BytedanceVideoTargetFps>('30fps')

  // Generation state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [currentUpscaleJobId, setCurrentUpscaleJobId] = useState<string | null>(
    null,
  )
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    videoId: string | null
  }>({ open: false, videoId: null })
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const limit = 12
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const lastQueueToastRef = useRef<number | null>(null)

  // The mode follows from the frames you supply
  const generationType: VideoCapability = startFrame
    ? endFrame
      ? 'keyframes'
      : 'image-to-video'
    : 'text-to-video'

  // An image handed over from the Images page ("Animate")
  useEffect(() => {
    const stored = sessionStorage.getItem('animateImage')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        setStartFrame({ id: data.id, url: data.url, prompt: null })
        sessionStorage.removeItem('animateImage')
      } catch {
        // ignore
      }
    }
  }, [])

  // Models
  const { data: modelsData } = useQuery({
    queryKey: ['videoModels'],
    queryFn: async () => {
      const { getVideoModelsFn } = await import('../../../server/video.server')
      return getVideoModelsFn()
    },
  })
  const allModels: Array<VideoModelConfig> = modelsData?.models ?? []
  const availableModels: Array<VideoModelConfig> = useMemo(
    () => allModels.filter((m) => m.capabilities.includes(generationType)),
    [allModels, generationType],
  )
  const supportsEndFrames = allModels.some((m) =>
    m.capabilities.includes('keyframes'),
  )

  // Keep the selection valid when the mode changes; the first model offered
  // for a mode is its default (see DEFAULT_MODELS)
  useEffect(() => {
    if (
      availableModels.length > 0 &&
      !availableModels.find((m) => m.id === model)
    ) {
      // Prefer the same model family in the new mode (Kling 4 Flash T2V → I2V)
      const current = allModels.find((m) => m.id === model)
      const sibling = current
        ? availableModels.find((m) => m.name === current.name)
        : undefined
      const next = sibling ?? availableModels[0]
      setModel(next.id)
      if (!next.durations.includes(duration)) setDuration(next.durations[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModels])

  const selectedModel = availableModels.find((m) => m.id === model)

  const handleModelChange = (newModelId: string) => {
    setModel(newModelId)
    const next = availableModels.find((m) => m.id === newModelId)
    if (next && !next.durations.includes(duration)) {
      // nearest allowed length
      const nearest = [...next.durations].sort(
        (a, b) => Math.abs(a - duration) - Math.abs(b - duration),
      )[0]
      setDuration(nearest)
    }
    if (next?.aspectRatios && !next.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(next.aspectRatios[0])
    }
  }

  const audioOn = selectedModel?.supportsAudio ? generateAudio : undefined
  const costLabel = formatEstimate(
    estimateCost(selectedModel?.pricing, {
      durationSec: duration,
      audio: audioOn,
    }),
  )

  // Library
  const {
    data: videosData,
    isLoading: videosLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['videos'],
    queryFn: async ({ pageParam = 0 }) => {
      const { listUserVideosFn } = await import('../../../server/video.server')
      return listUserVideosFn({ data: { limit, offset: pageParam * limit } })
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * limit
      return loadedCount < lastPage.total ? allPages.length : undefined
    },
    initialPageParam: 0,
  })

  const {
    data: imagesData,
    isLoading: imagesLoading,
    refetch: refetchImages,
  } = useQuery({
    queryKey: ['images', 'forVideo'],
    queryFn: async () => {
      const { listUserImagesFn } = await import('../../../server/image.server')
      return listUserImagesFn({ data: { limit: 50 } })
    },
    enabled: imagePickerTarget !== null,
  })

  const videos = videosData?.pages.flatMap((page) => page.videos) ?? []
  const total = videosData?.pages[0]?.total ?? 0
  const images = imagesData?.images || []

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

  // Mutations
  const generateMutation = useMutation({
    mutationFn: async (input: { data: Record<string, unknown> }) => {
      const { generateVideoFn } = await import('../../../server/video.server')
      return generateVideoFn(input as never)
    },
    onSuccess: (result) => {
      setCurrentJobId(result.jobId)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (input: { data: { videoId: string } }) => {
      const { deleteVideoFn } = await import('../../../server/video.server')
      return deleteVideoFn(input as never)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      setSelectedVideo(null)
    },
  })

  const upscaleMutation = useMutation({
    mutationFn: async (input: { data: Record<string, unknown> }) => {
      const { upscaleVideoFn } =
        await import('../../../server/video-upscale.server')
      return upscaleVideoFn(input as never)
    },
    onSuccess: (result) => {
      setCurrentUpscaleJobId(result.jobId)
    },
  })

  // Job polling
  const { data: jobStatus } = useQuery({
    queryKey: ['videoJob', currentJobId],
    queryFn: async () => {
      const { getVideoJobStatusFn } =
        await import('../../../server/video.server')
      return getVideoJobStatusFn({ data: { jobId: currentJobId! } })
    },
    enabled: !!currentJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'completed' || status === 'failed' ? false : 3000
    },
  })

  useEffect(() => {
    if (jobStatus?.status === 'completed') {
      setCurrentJobId(null)
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['falCredits'] })
    }
  }, [jobStatus, queryClient])

  useEffect(() => {
    const queuePosition = jobStatus?.queuePosition
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
  }, [jobStatus?.queuePosition])

  const { data: upscaleJobStatus } = useQuery({
    queryKey: ['videoUpscaleJob', currentUpscaleJobId],
    queryFn: async () => {
      const { getVideoUpscaleJobStatusFn } =
        await import('../../../server/video-upscale.server')
      return getVideoUpscaleJobStatusFn({
        data: { jobId: currentUpscaleJobId! },
      })
    },
    enabled: !!currentUpscaleJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'completed' || status === 'failed' ? false : 3000
    },
  })

  useEffect(() => {
    if (upscaleJobStatus?.status === 'completed') {
      setCurrentUpscaleJobId(null)
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    }
  }, [upscaleJobStatus, queryClient])

  const isGenerating =
    generateMutation.isPending ||
    !!(
      currentJobId &&
      jobStatus?.status !== 'completed' &&
      jobStatus?.status !== 'failed'
    )

  const isUpscaling =
    upscaleMutation.isPending ||
    !!(
      currentUpscaleJobId &&
      upscaleJobStatus?.status !== 'completed' &&
      upscaleJobStatus?.status !== 'failed'
    )

  const canGenerate = !!prompt.trim() && !isGenerating && !!selectedModel

  const handleGenerate = () => {
    if (!canGenerate) return
    const base = {
      prompt: prompt.trim(),
      model,
      duration,
      generateAudio,
      aspectRatio,
    }
    if (generationType === 'text-to-video') {
      generateMutation.mutate({
        data: { ...base, generationType },
      })
    } else if (generationType === 'image-to-video') {
      generateMutation.mutate({
        data: {
          ...base,
          generationType,
          imageUrl: startFrame!.url,
          sourceImageId: startFrame!.id,
        },
      })
    } else {
      generateMutation.mutate({
        data: {
          ...base,
          generationType,
          firstFrameUrl: startFrame!.url,
          lastFrameUrl: endFrame!.url,
        },
      })
    }
  }

  const handleCancelJob = useCallback(() => {
    setCurrentJobId(null)
    lastQueueToastRef.current = null
    toast.info('Stopped waiting for this clip', {
      description: 'Pick a different model and try again.',
    })
  }, [])

  // Keyboard: Ctrl/Cmd+Enter generates, Esc closes panels
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        (e.metaKey || e.ctrlKey) &&
        document.activeElement === textareaRef.current
      ) {
        e.preventDefault()
        handleGenerate()
      }
      if (e.key === 'Escape') {
        setSelectedVideo(null)
        setImagePickerTarget(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  const handleImageSelect = (image: SelectedImage) => {
    if (imagePickerTarget === 'start') {
      setStartFrame(image)
      if (image.prompt && !prompt) setPrompt(`Animate: ${image.prompt}`)
    } else if (imagePickerTarget === 'end') {
      setEndFrame(image)
    }
    setImagePickerTarget(null)
    textareaRef.current?.focus()
  }

  const handleImageUploadComplete = async () => {
    const result = await refetchImages()
    const latestImage = result.data?.images?.[0]
    if (latestImage) handleImageSelect(latestImage)
  }

  const handleDownload = async (url: string, videoId?: string) => {
    const filename = generateFilename(url, 'video')
    const trackingId = videoId || url
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

  const handleVideoUpscale = () => {
    const videoUrl = upscaleVideoUrl || selectedUpscaleVideo?.url
    if (!videoUrl) return
    upscaleMutation.mutate({
      data: {
        videoUrl,
        model: upscaleModel,
        sourceAssetId: selectedUpscaleVideo?.id,
        upscaleFactor,
        targetFps: topazTargetFps,
        h264Output: topazH264Output,
        upscaleMode: seedvrUpscaleMode,
        seedvrTargetResolution,
        noiseScale: seedvrNoiseScale,
        outputFormat: seedvrOutputFormat,
        outputQuality: seedvrOutputQuality,
        bytedanceTargetResolution,
        bytedanceTargetFps,
      },
    })
  }

  const handleUpscaleThis = (video: GeneratedVideo) => {
    setSelectedUpscaleVideo(video)
    setUpscaleVideoUrl(video.url)
    setTab('upscale')
    setSelectedVideo(null)
  }

  const handleAddToProject = () => navigate({ to: '/projects' })

  const generateError =
    generateMutation.isError || jobStatus?.status === 'failed'
      ? generateMutation.error instanceof Error
        ? generateMutation.error.message
        : jobStatus?.error || 'Generation failed'
      : null

  const progress = jobStatus?.progress || 0

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* ================= Settings panel ================= */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border bg-card/40 lg:h-full lg:w-[400px] lg:border-r lg:border-b-0">
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {tab === 'create' ? 'Generate Video' : 'Upscale Video'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab === 'create'
                  ? 'Turn your ideas into cinematic video.'
                  : 'Sharpen a clip up to 4K.'}
              </p>
            </div>
            <div className="flex rounded-lg border border-border bg-background p-0.5">
              {(['create', 'upscale'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                    tab === t
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {tab === 'upscale' ? (
            <VideoUpscalePanel
              model={upscaleModel}
              onModelChange={setUpscaleModel}
              videoUrl={upscaleVideoUrl}
              onVideoUrlChange={setUpscaleVideoUrl}
              onSelectFromLibrary={() => setVideoPickerOpen(true)}
              selectedVideoName={
                selectedUpscaleVideo?.prompt?.slice(0, 30) || undefined
              }
              upscaleFactor={upscaleFactor}
              onUpscaleFactorChange={setUpscaleFactor}
              targetFps={topazTargetFps}
              onTargetFpsChange={setTopazTargetFps}
              h264Output={topazH264Output}
              onH264OutputChange={setTopazH264Output}
              upscaleMode={seedvrUpscaleMode}
              onUpscaleModeChange={setSeedvrUpscaleMode}
              seedvrTargetResolution={seedvrTargetResolution}
              onSeedvrTargetResolutionChange={setSeedvrTargetResolution}
              noiseScale={seedvrNoiseScale}
              onNoiseScaleChange={setSeedvrNoiseScale}
              outputFormat={seedvrOutputFormat}
              onOutputFormatChange={setSeedvrOutputFormat}
              outputQuality={seedvrOutputQuality}
              onOutputQualityChange={setSeedvrOutputQuality}
              bytedanceTargetResolution={bytedanceTargetResolution}
              onBytedanceTargetResolutionChange={setBytedanceTargetResolution}
              bytedanceTargetFps={bytedanceTargetFps}
              onBytedanceTargetFpsChange={setBytedanceTargetFps}
              onUpscale={handleVideoUpscale}
              isUpscaling={isUpscaling}
              hasVideo={
                !isUpscaling && !!(upscaleVideoUrl || selectedUpscaleVideo?.url)
              }
              error={
                upscaleMutation.isError
                  ? upscaleMutation.error instanceof Error
                    ? upscaleMutation.error.message
                    : 'Upscale failed'
                  : upscaleJobStatus?.status === 'failed'
                    ? upscaleJobStatus.error || 'Upscale failed'
                    : null
              }
            />
          ) : (
            <>
              {/* Prompt */}
              <Field label="Prompt">
                <div className="rounded-xl border border-input bg-background focus-within:border-muted-foreground/60 transition-colors">
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    maxLength={PROMPT_MAX}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={
                      generationType === 'text-to-video'
                        ? 'Describe the scene — subject, action, camera, light…'
                        : generationType === 'image-to-video'
                          ? 'Describe the motion — what moves, how the camera moves…'
                          : 'Describe how the first frame becomes the last…'
                    }
                    rows={5}
                    className="block w-full resize-none bg-transparent px-3.5 pt-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70"
                  />
                  <p className="px-3.5 pb-2 text-right text-[11px] tabular-nums text-muted-foreground">
                    {prompt.length}/{PROMPT_MAX}
                  </p>
                </div>
              </Field>

              {/* Frames */}
              <Field
                label={startFrame ? 'Frames' : 'Start frame'}
                hint={startFrame ? undefined : 'optional'}
              >
                {startFrame ? (
                  <div className="grid grid-cols-2 gap-3">
                    <FrameSlot
                      image={startFrame}
                      label="Start frame"
                      onPick={() => setImagePickerTarget('start')}
                      onClear={() => {
                        setStartFrame(null)
                        setEndFrame(null)
                      }}
                    />
                    {supportsEndFrames && (
                      <FrameSlot
                        image={endFrame}
                        label="End frame"
                        optional
                        onPick={() => setImagePickerTarget('end')}
                        onClear={() => setEndFrame(null)}
                      />
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setImagePickerTarget('start')}
                    className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-center transition-colors hover:border-muted-foreground/60 hover:bg-accent/40"
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium">
                      Upload or choose an image
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      JPG, PNG · or pick from your library
                    </span>
                  </button>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {generationType === 'text-to-video'
                    ? 'Add an image to animate it instead of starting from text.'
                    : generationType === 'image-to-video'
                      ? 'Animating your image. Add an end frame to steer where it lands.'
                      : 'Keyframes: the clip moves from the first image to the last.'}
                </p>
              </Field>

              {/* Model */}
              <Field label="Model">
                <ModelRadioList
                  models={availableModels}
                  value={model}
                  onChange={handleModelChange}
                />
              </Field>

              {/* Duration */}
              {selectedModel && selectedModel.durations.length > 1 && (
                <Field
                  label="Duration"
                  aside={
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {duration} seconds
                    </span>
                  }
                >
                  <Slider
                    value={[
                      Math.max(0, selectedModel.durations.indexOf(duration)),
                    ]}
                    min={0}
                    max={selectedModel.durations.length - 1}
                    step={1}
                    onValueChange={([i]) =>
                      setDuration(selectedModel.durations[i])
                    }
                  />
                  <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted-foreground">
                    {selectedModel.durations.map((d) => (
                      <span key={d}>{d}s</span>
                    ))}
                  </div>
                </Field>
              )}

              {/* Aspect ratio */}
              {selectedModel?.aspectRatios &&
                selectedModel.aspectRatios.length > 1 && (
                  <Field label="Aspect ratio">
                    <div className="grid grid-cols-3 gap-2">
                      {selectedModel.aspectRatios.map((ar) => {
                        const Icon = ASPECT_ICONS[ar] ?? RectangleHorizontal
                        return (
                          <button
                            key={ar}
                            onClick={() => setAspectRatio(ar)}
                            className={cn(
                              'flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium tabular-nums transition-colors',
                              aspectRatio === ar
                                ? 'border-primary/60 bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground',
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {ar}
                          </button>
                        )
                      })}
                    </div>
                  </Field>
                )}

              {/* Audio */}
              {selectedModel?.supportsAudio && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Add audio</p>
                    <p className="text-xs text-muted-foreground">
                      Synchronised dialogue, SFX and music — roughly doubles the
                      price
                    </p>
                  </div>
                  <Switch
                    checked={generateAudio}
                    onCheckedChange={setGenerateAudio}
                  />
                </div>
              )}

              {generateError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {generateError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Generate */}
        {tab === 'create' && (
          <div className="border-t border-border p-4">
            <Button
              size="lg"
              className="w-full"
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate
                  {costLabel && (
                    <span className="font-normal tabular-nums opacity-80">
                      · {costLabel}
                    </span>
                  )}
                </>
              )}
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Billed to your fal account · Ctrl+Enter to generate
            </p>
          </div>
        )}
      </aside>

      {/* ================= Results ================= */}
      <section className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-5 flex items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Results</h2>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {total}
          </span>
        </div>

        {videosLoading && videos.length === 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-video rounded-xl" />
            ))}
          </div>
        ) : videos.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-28 text-center">
            <Video className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-5 text-lg font-medium">No videos yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Write a prompt on the left. Start on a Draft model to try the idea
              cheaply, then re-run the keeper on a Hero model.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {isGenerating && (
                <div className="flex flex-col">
                  <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-card">
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                      <p className="mt-3 text-sm font-medium">
                        {jobStatus?.status === 'processing'
                          ? 'Rendering…'
                          : 'Queued…'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Usually 1–3 minutes
                      </p>
                      {jobStatus?.queuePosition &&
                        jobStatus.queuePosition >= 50 && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Queue position {jobStatus.queuePosition}
                            {jobStatus.queuePosition >= 200 && (
                              <button
                                onClick={handleCancelJob}
                                className="underline"
                              >
                                stop waiting
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
                      <div
                        className={cn(
                          'h-full bg-primary transition-all duration-500',
                          progress === 0 &&
                            'w-1/4 animate-[indeterminate_1.6s_ease-in-out_infinite]',
                        )}
                        style={progress ? { width: `${progress}%` } : undefined}
                      />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-sm">
                    <span className="truncate font-medium">
                      {selectedModel?.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {costLabel}
                    </span>
                  </div>
                </div>
              )}

              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  modelConfig={allModels.find((m) => m.id === video.model)}
                  onSelect={() => setSelectedVideo(video)}
                  onDownload={() => handleDownload(video.url, video.id)}
                  onAddToProject={handleAddToProject}
                  onUpscale={() => handleUpscaleThis(video)}
                  onDelete={() =>
                    setDeleteDialog({ open: true, videoId: video.id })
                  }
                  isDownloading={downloadingId === video.id}
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
      </section>

      {/* Video picker for upscale */}
      <Dialog open={videoPickerOpen} onOpenChange={setVideoPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select a video to upscale</DialogTitle>
          </DialogHeader>
          {videos.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-sm text-muted-foreground">
              <Video className="mb-3 h-10 w-10" />
              Generate a video first to upscale it.
            </div>
          ) : (
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
              {videos.map((video) => (
                <button
                  key={video.id}
                  className="group relative aspect-video overflow-hidden rounded-xl bg-muted"
                  onClick={() => {
                    setSelectedUpscaleVideo(video)
                    setUpscaleVideoUrl(video.url)
                    setVideoPickerOpen(false)
                  }}
                >
                  <video
                    src={video.url}
                    className="absolute inset-0 h-full w-full object-cover"
                    muted
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => {
                      e.currentTarget.pause()
                      e.currentTarget.currentTime = 0
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Check className="h-8 w-8 text-white" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image picker for frames */}
      <Dialog
        open={imagePickerTarget !== null}
        onOpenChange={(open) => !open && setImagePickerTarget(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {imagePickerTarget === 'end'
                ? 'Choose the end frame'
                : 'Choose a start frame'}
            </DialogTitle>
          </DialogHeader>
          <UploadDropZone onUploadComplete={handleImageUploadComplete} />
          {imagesLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No images yet — upload one above, or
              </p>
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() =>
                  navigate({ to: '/images', search: { mode: 'generate' } })
                }
              >
                <Plus className="h-4 w-4" />
                Create an image
              </Button>
            </div>
          ) : (
            <div className="grid max-h-[50vh] gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
              {images.map((image) => (
                <button
                  key={image.id}
                  className="group relative aspect-square overflow-hidden rounded-xl"
                  onClick={() => handleImageSelect(image)}
                >
                  <img
                    src={image.url}
                    alt={image.prompt || 'Image'}
                    className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Check className="h-7 w-7 text-white" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail panel */}
      <Sheet open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-b border-border px-6 pt-6 pb-4">
            <SheetTitle>Video details</SheetTitle>
          </SheetHeader>
          {selectedVideo && (
            <div className="space-y-5 p-6">
              <div className="overflow-hidden rounded-xl border border-border bg-black">
                <video
                  src={selectedVideo.url}
                  className="w-full"
                  controls
                  autoPlay
                  loop
                />
              </div>

              {selectedVideo.prompt && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm font-medium">Prompt</span>
                  </div>
                  <p className="text-sm leading-relaxed">
                    {selectedVideo.prompt}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4">
                {selectedVideo.metadata?.generationType && (
                  <Meta icon={Film} label="Type">
                    <span className="capitalize">
                      {selectedVideo.metadata.generationType.replace(/-/g, ' ')}
                    </span>
                  </Meta>
                )}
                {selectedVideo.model && (
                  <Meta icon={Zap} label="Model">
                    {allModels.find((m) => m.id === selectedVideo.model)
                      ?.name ?? selectedVideo.model.split('/').pop()}
                  </Meta>
                )}
                {selectedVideo.durationSeconds && (
                  <Meta icon={Clock} label="Duration">
                    {selectedVideo.durationSeconds}s
                  </Meta>
                )}
                {selectedVideo.metadata?.aspectRatio && (
                  <Meta icon={Maximize2} label="Aspect ratio">
                    {selectedVideo.metadata.aspectRatio}
                  </Meta>
                )}
                <Meta icon={Calendar} label="Created">
                  {new Date(selectedVideo.createdAt).toLocaleDateString(
                    'en-US',
                    { month: 'short', day: 'numeric', year: 'numeric' },
                  )}
                </Meta>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleAddToProject}>
                  <FolderPlus className="h-4 w-4" />
                  Add to project
                </Button>
                <Button
                  variant="secondary"
                  disabled={downloadingId === selectedVideo.id}
                  onClick={() =>
                    handleDownload(selectedVideo.url, selectedVideo.id)
                  }
                >
                  {downloadingId === selectedVideo.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download
                </Button>
                <Button
                  variant="secondary"
                  className="col-span-2"
                  onClick={() => handleUpscaleThis(selectedVideo)}
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Upscale this clip
                </Button>
              </div>

              <div className="border-t border-border pt-3">
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() =>
                    setDeleteDialog({ open: true, videoId: selectedVideo.id })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  Delete video
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title="Delete video?"
        description="This action cannot be undone. The video will be permanently removed from your library."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() =>
          deleteDialog.videoId &&
          deleteMutation.mutate({ data: { videoId: deleteDialog.videoId } })
        }
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// =============================================================================
// Pieces
// =============================================================================

function Field({
  label,
  hint,
  aside,
  children,
}: {
  label: string
  hint?: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">
          {label}
          {hint && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({hint})
            </span>
          )}
        </p>
        {aside}
      </div>
      {children}
    </div>
  )
}

function Meta({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Film
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-primary/10 p-2">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="truncate text-sm font-medium">{children}</p>
      </div>
    </div>
  )
}

function FrameSlot({
  image,
  label,
  optional,
  onPick,
  onClear,
}: {
  image: SelectedImage | null
  label: string
  optional?: boolean
  onPick: () => void
  onClear: () => void
}) {
  if (!image) {
    return (
      <button
        onClick={onPick}
        className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:bg-accent/40 hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
        {optional && <span className="text-[10px]">optional</span>}
      </button>
    )
  }
  return (
    <div className="group relative aspect-video overflow-hidden rounded-xl border border-border">
      <img src={image.url} alt={label} className="h-full w-full object-cover" />
      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium">
        {label}
      </span>
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onPick}
          className="rounded-md bg-white/15 px-2 py-1 text-xs font-medium text-white hover:bg-white/25"
        >
          Change
        </button>
        <button
          onClick={onClear}
          className="rounded-md bg-white/15 p-1 text-white hover:bg-white/25"
          aria-label={`Remove ${label.toLowerCase()}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

const TIER_ORDER: Array<ModelTier | 'other'> = [
  'draft',
  'standard',
  'hero',
  'other',
]
const TIER_HINTS: Record<ModelTier | 'other', string> = {
  draft: 'Best for quick tests',
  standard: 'Great balance of quality and cost',
  hero: 'Highest quality for final results',
  other: '',
}

function ModelRadioList({
  models,
  value,
  onChange,
}: {
  models: Array<VideoModelConfig>
  value: string
  onChange: (id: string) => void
}) {
  if (models.length === 0) {
    return <Skeleton className="h-48 rounded-xl" />
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {TIER_ORDER.map((tier) => {
        const group = models.filter((m) => (m.tier ?? 'other') === tier)
        if (group.length === 0) return null
        return (
          <div key={tier} className="border-b border-border last:border-b-0">
            <p className="flex items-baseline gap-2 bg-muted/40 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tier === 'other' ? 'Other' : TIER_LABELS[tier]}
              <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
                {TIER_HINTS[tier]}
              </span>
            </p>
            {group.map((m) => {
              const checked = m.id === value
              return (
                <TooltipProvider key={m.id} delayDuration={500}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onChange(m.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm transition-colors',
                          checked ? 'bg-primary/[0.08]' : 'hover:bg-accent/50',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                            checked ? 'border-primary' : 'border-border',
                          )}
                        >
                          {checked && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </span>
                        <span
                          className={cn(
                            'flex-1 truncate',
                            checked && 'font-medium',
                          )}
                        >
                          {m.name}
                        </span>
                        {m.supportsAudio && (
                          <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                            audio
                          </span>
                        )}
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatRate(m.pricing)}
                        </span>
                      </button>
                    </TooltipTrigger>
                    {m.description && (
                      <TooltipContent side="right" className="max-w-xs">
                        {m.description}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </div>
        )
      })}
      <p className="flex items-center gap-1.5 border-t border-border px-3.5 py-2 text-[11px] text-muted-foreground">
        <Info className="h-3 w-3" />
        Rates are fal's prices at the model's default resolution.
      </p>
    </div>
  )
}

interface VideoCardProps {
  video: GeneratedVideo
  modelConfig: VideoModelConfig | undefined
  onSelect: () => void
  onDownload: () => void
  onAddToProject: () => void
  onUpscale: () => void
  onDelete: () => void
  isDownloading?: boolean
}

function VideoCard({
  video,
  modelConfig,
  onSelect,
  onDownload,
  onAddToProject,
  onUpscale,
  onDelete,
  isDownloading = false,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Cost of a finished clip, estimated from its model and length (fal does
  // not report per-request cost back to us)
  const cost =
    modelConfig && video.durationSeconds
      ? formatEstimate(
          estimateCost(modelConfig.pricing, {
            durationSec: video.durationSeconds,
          }),
        )
      : null

  return (
    <div className="group flex flex-col">
      <button
        className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted text-left"
        onClick={onSelect}
        onMouseEnter={() => videoRef.current?.play()}
        onMouseLeave={() => {
          if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current.currentTime = 0
          }
        }}
      >
        <video
          ref={videoRef}
          src={video.url}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          muted
          loop
          playsInline
        />
        <span className="absolute bottom-2.5 left-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-opacity group-hover:opacity-0">
          <Play className="h-3.5 w-3.5 fill-white text-white" />
        </span>
        {video.durationSeconds && (
          <span className="absolute top-2.5 right-2.5 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
            0:{String(Math.round(video.durationSeconds)).padStart(2, '0')}
          </span>
        )}
      </button>
      <div className="mt-2.5 flex items-center gap-2 text-sm">
        <span className="truncate font-medium">
          {modelConfig?.name ?? video.model?.split('/').slice(-2).join(' ')}
        </span>
        {cost && (
          <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
            {cost.replace('≈ ', '')}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground',
                !cost && 'ml-auto',
              )}
              aria-label="Video actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDownload} disabled={isDownloading}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddToProject}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Add to project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onUpscale}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Upscale
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
