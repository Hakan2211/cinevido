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
  ArrowUpCircle,
  Calendar,
  Check,
  Clock,
  Download,
  Film,
  FolderPlus,
  Loader2,
  Maximize2,
  MessageSquare,
  Play,
  Plus,
  Trash2,
  Video,
  Wand2,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { estimateCost, formatEstimate, formatRateAt } from '@/lib/pricing'
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
import { VideoUpscalePanel } from '../../../components/videos/VideoUpscalePanel'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
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
import { estimateVideoUpscale } from '@/lib/video-upscale-cost'
import type { UpscaleSource } from '@/lib/video-upscale-cost'
import { VIDEO_UPSCALE_MODELS } from '../../../server/services/types'

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
    resolution?: string
    generateAudio?: boolean
  } | null
  createdAt: Date
}

interface SelectedImage {
  id: string
  url: string
  prompt: string | null
}

type Tab = 'create' | 'upscale'

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
  const [resolution, setResolution] = useState<string | undefined>()
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
  const [upscaleSource, setUpscaleSource] = useState<UpscaleSource | null>(null)
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
      if (!resolution || !next.resolutions?.includes(resolution)) {
        setResolution(next.defaultResolution)
      }
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
    // Resolutions are model-specific (720p vs 768P): fall back to the default
    if (next && (!resolution || !next.resolutions?.includes(resolution))) {
      setResolution(next.defaultResolution)
    }
  }

  const activeResolution =
    resolution && selectedModel?.resolutions?.includes(resolution)
      ? resolution
      : selectedModel?.defaultResolution

  const audioOn = selectedModel?.supportsAudio ? generateAudio : undefined
  const costLabel = formatEstimate(
    estimateCost(selectedModel?.pricing, {
      durationSec: duration,
      audio: audioOn,
      resolution: activeResolution,
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

  const videos = videosData?.pages.flatMap((page) => page.videos) ?? []
  const total = videosData?.pages[0]?.total ?? 0

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
      resolution: activeResolution,
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
        sourceWidth: upscaleSource?.width,
        sourceHeight: upscaleSource?.height,
        sourceDurationSec: upscaleSource?.durationSec,
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

  const upscaleCostLabel = formatEstimate(
    estimateVideoUpscale(
      VIDEO_UPSCALE_MODELS.find((m) => m.id === upscaleModel)?.pricing,
      upscaleSource,
      {
        modelId: upscaleModel,
        factor: upscaleFactor,
        targetHeight:
          seedvrUpscaleMode === 'target'
            ? Number.parseInt(seedvrTargetResolution, 10)
            : undefined,
        bytedanceResolution: bytedanceTargetResolution,
        fps: upscaleModel.includes('bytedance')
          ? Number.parseInt(bytedanceTargetFps, 10)
          : topazTargetFps,
      },
    ),
  )
  const canUpscale =
    !isUpscaling && !!(upscaleVideoUrl || selectedUpscaleVideo?.url)

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
    <LabShell>
      {/* ================= Settings panel ================= */}
      <LabPanel
        title={tab === 'create' ? 'Generate Video' : 'Upscale Video'}
        subtitle={
          tab === 'create'
            ? 'Turn your ideas into cinematic video.'
            : 'Sharpen a clip up to 4K.'
        }
        tabs={[
          { value: 'create', label: 'Create' },
          { value: 'upscale', label: 'Upscale' },
        ]}
        tab={tab}
        onTabChange={setTab}
        footer={
          tab === 'create' ? (
            <GenerateButton
              label="Generate"
              icon={Wand2}
              busy={isGenerating}
              busyLabel="Generating…"
              costLabel={costLabel}
              disabled={!canGenerate}
              onClick={handleGenerate}
            />
          ) : (
            <GenerateButton
              label="Upscale"
              icon={ArrowUpCircle}
              busy={isUpscaling}
              busyLabel="Upscaling…"
              costLabel={upscaleCostLabel}
              disabled={!canUpscale}
              onClick={handleVideoUpscale}
              hint={
                upscaleSource
                  ? 'Estimated from the output size and length · billed to your fal account'
                  : 'Choose a clip to see the cost'
              }
            />
          )
        }
      >
        {tab === 'upscale' ? (
          <VideoUpscalePanel
            model={upscaleModel}
            onModelChange={setUpscaleModel}
            videoUrl={upscaleVideoUrl}
            onVideoUrlChange={(url) => {
              setUpscaleVideoUrl(url)
              setSelectedUpscaleVideo(null)
              setUpscaleSource(null)
            }}
            onSelectFromLibrary={() => setVideoPickerOpen(true)}
            source={upscaleSource}
            onSourceChange={setUpscaleSource}
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
              <PromptBox
                textareaRef={textareaRef}
                value={prompt}
                onChange={setPrompt}
                max={PROMPT_MAX}
                placeholder={
                  generationType === 'text-to-video'
                    ? 'Describe the scene — subject, action, camera, light…'
                    : generationType === 'image-to-video'
                      ? 'Describe the motion — what moves, how the camera moves…'
                      : 'Describe how the first frame becomes the last…'
                }
              />
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
                <EmptyImageDrop onPick={() => setImagePickerTarget('start')} />
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
                otherLabel="Other"
                badge={(m) => (m.supportsAudio ? 'audio' : null)}
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
                  <AspectCards
                    ratios={selectedModel.aspectRatios}
                    value={aspectRatio}
                    onChange={setAspectRatio}
                  />
                </Field>
              )}

            {/* Resolution */}
            {selectedModel?.resolutions &&
              selectedModel.resolutions.length > 1 && (
                <Field label="Resolution">
                  <Segmented
                    options={selectedModel.resolutions.map((r) => ({
                      value: r,
                      label: r.toLowerCase() === '4k' ? '4K' : r.toLowerCase(),
                      title:
                        formatRateAt(selectedModel.pricing, {
                          resolution: r,
                          audio: audioOn,
                        }) ?? undefined,
                    }))}
                    value={activeResolution ?? ''}
                    onChange={setResolution}
                  />
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

            {generateError && <FieldError>{generateError}</FieldError>}
          </>
        )}
      </LabPanel>

      {/* ================= Results ================= */}
      <LabResults count={total}>
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
                <PendingCard
                  status={
                    jobStatus?.status === 'processing'
                      ? 'Rendering…'
                      : 'Queued…'
                  }
                  eta="Usually 1–3 minutes"
                  progress={progress}
                  queuePosition={jobStatus?.queuePosition}
                  onStopWaiting={handleCancelJob}
                  title={selectedModel?.name}
                  cost={costLabel}
                />
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
      </LabResults>

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
      <ImagePickerDialog
        open={imagePickerTarget !== null}
        onOpenChange={(open) => !open && setImagePickerTarget(null)}
        title={
          imagePickerTarget === 'end'
            ? 'Choose the end frame'
            : 'Choose a start frame'
        }
        onPick={([image]) => handleImageSelect(image)}
        emptyAction={
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => navigate({ to: '/images' })}
          >
            <Plus className="h-4 w-4" />
            Create an image
          </Button>
        }
      />

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
    </LabShell>
  )
}

// =============================================================================
// Pieces
// =============================================================================

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
            resolution: video.metadata?.resolution,
            audio: modelConfig.supportsAudio
              ? video.metadata?.generateAudio
              : undefined,
          }),
        )
      : null

  return (
    <ResultCard
      title={
        modelConfig?.name ??
        video.model?.split('/').slice(-2).join(' ') ??
        'Video'
      }
      cost={cost?.replace('≈ ', '')}
      onSelect={onSelect}
      onHover={(hovering) => {
        const el = videoRef.current
        if (!el) return
        if (hovering) void el.play().catch(() => {})
        else {
          el.pause()
          el.currentTime = 0
        }
      }}
      menuLabel="Video actions"
      menuActions={[
        {
          label: 'Download',
          icon: Download,
          onClick: onDownload,
          disabled: isDownloading,
        },
        { label: 'Add to project', icon: FolderPlus, onClick: onAddToProject },
        { label: 'Upscale', icon: ArrowUpCircle, onClick: onUpscale },
        { label: 'Delete', icon: Trash2, onClick: onDelete, destructive: true },
      ]}
      media={
        <>
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
        </>
      }
    />
  )
}
