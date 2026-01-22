/**
 * Videos Page - Unified Create & Gallery
 *
 * Professional video generation interface with:
 * - 3 Tabs: Text to Video, Image to Video, Keyframes
 * - Fixed bottom prompt bar with mode-specific inputs
 * - Uniform grid with skeleton placeholders
 * - Hover-to-play video previews
 * - Hover actions (download, use in project, delete)
 * - Slide-out detail panel
 * - Keyboard shortcuts (Enter to generate, Esc to close)
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
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
  Clock,
  Download,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  MessageSquare,
  Play,
  Plus,
  Trash2,
  Video,
  Wand2,
  X,
  Zap,
} from 'lucide-react'
import {
  deleteVideoFn,
  generateVideoFn,
  getVideoJobStatusFn,
  getVideoModelsFn,
  listUserVideosFn,
} from '../../../server/video.fn'
import { listUserImagesFn } from '../../../server/image.fn'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Textarea } from '../../../components/ui/textarea'
import { Skeleton } from '../../../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { ModelSelect } from '../../../components/ui/model-select'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip'
import { Switch } from '../../../components/ui/switch'
import { Label } from '../../../components/ui/label'
import { VideoModeToggle } from '../../../components/videos/VideoModeToggle'
import type { VideoMode } from '../../../components/videos/VideoModeToggle'
import type { VideoModelConfig } from '../../../server/services/types'

export const Route = createFileRoute('/_app/videos/')({
  component: VideosPage,
})

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

function VideosPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Mode state
  const [mode, setMode] = useState<VideoMode>('text-to-video')

  // Form state
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('')
  const [duration, setDuration] = useState<number>(5)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [generateAudio, setGenerateAudio] = useState(true)

  // Image-to-video state
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null)

  // Keyframes state
  const [firstFrame, setFirstFrame] = useState<SelectedImage | null>(null)
  const [lastFrame, setLastFrame] = useState<SelectedImage | null>(null)
  // Pika multi-keyframe support
  const [keyframes, setKeyframes] = useState<Array<SelectedImage>>([])

  // UI state
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(
    null,
  )
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [imagePickerTarget, setImagePickerTarget] = useState<
    'image' | 'first' | 'last' | number
  >('image')

  // Generation state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  // Pagination
  const limit = 12
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Check for pre-selected image from Images page
  useEffect(() => {
    const stored = sessionStorage.getItem('animateImage')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        setSelectedImage({ id: data.id, url: data.url, prompt: null })
        setMode('image-to-video')
        sessionStorage.removeItem('animateImage')
      } catch {
        // ignore
      }
    }
  }, [])

  // Fetch models
  const { data: modelsData } = useQuery({
    queryKey: ['videoModels'],
    queryFn: () => getVideoModelsFn(),
  })

  // Get filtered models based on current mode
  const capabilityKey =
    mode === 'text-to-video'
      ? 'textToVideo'
      : mode === 'image-to-video'
        ? 'imageToVideo'
        : 'keyframes'
  const availableModels: Array<VideoModelConfig> =
    modelsData?.byCapability[capabilityKey] || []

  // Set default model when mode changes
  useEffect(() => {
    if (
      availableModels.length > 0 &&
      !availableModels.find((m) => m.id === model)
    ) {
      setModel(availableModels[0].id)
      // Reset duration to model default
      setDuration(availableModels[0].durations[0] || 5)
    }
  }, [mode, availableModels, model])

  const selectedModel = availableModels.find((m) => m.id === model)

  // Handle model change - also update duration to a valid value
  const handleModelChange = (newModelId: string) => {
    setModel(newModelId)
    const newModel = availableModels.find((m) => m.id === newModelId)
    if (newModel && newModel.durations.length > 0) {
      // Only update duration if current duration is not valid for this model
      if (!newModel.durations.includes(duration)) {
        setDuration(newModel.durations[0])
      }
    }
  }

  // Check if selected model is Pika (supports multi-keyframe)
  const isPikaKeyframes =
    mode === 'keyframes' &&
    model.includes('pika') &&
    model.includes('pikaframes')

  // Fetch videos with infinite scroll
  const {
    data: videosData,
    isLoading: videosLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['videos'],
    queryFn: ({ pageParam = 0 }) =>
      listUserVideosFn({ data: { limit, offset: pageParam * limit } }),
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * limit
      return loadedCount < lastPage.total ? allPages.length : undefined
    },
    initialPageParam: 0,
  })

  // Fetch user's images for picker
  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: ['images', 'forVideo'],
    queryFn: () => listUserImagesFn({ data: { limit: 50 } }),
    enabled: imagePickerOpen,
  })

  // Flatten all pages into single array
  const videos = videosData?.pages.flatMap((page) => page.videos) ?? []
  const total = videosData?.pages[0]?.total ?? 0
  const images = imagesData?.images || []

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
    mutationFn: generateVideoFn,
    onSuccess: (result) => {
      setCurrentJobId(result.jobId)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteVideoFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      setSelectedVideo(null)
    },
  })

  // Poll job status
  const { data: jobStatus } = useQuery({
    queryKey: ['videoJob', currentJobId],
    queryFn: () => getVideoJobStatusFn({ data: { jobId: currentJobId! } }),
    enabled: !!currentJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') {
        return false
      }
      return 3000 // Videos take longer
    },
  })

  // Handle job completion
  useEffect(() => {
    if (jobStatus?.status === 'completed') {
      setCurrentJobId(null)
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    }
  }, [jobStatus, queryClient])

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
        setSelectedVideo(null)
        setImagePickerOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    prompt,
    model,
    duration,
    mode,
    selectedImage,
    firstFrame,
    lastFrame,
    keyframes,
  ])

  const canGenerate = () => {
    if (!prompt.trim() || isGenerating) return false

    switch (mode) {
      case 'text-to-video':
        return true
      case 'image-to-video':
        return !!selectedImage
      case 'keyframes':
        if (isPikaKeyframes) {
          return keyframes.length >= 2
        }
        return !!firstFrame && !!lastFrame
    }
  }

  const handleGenerate = () => {
    if (!canGenerate()) return

    const baseData = {
      prompt: prompt.trim(),
      model,
      duration,
      generateAudio,
    }

    if (mode === 'text-to-video') {
      generateMutation.mutate({
        data: {
          ...baseData,
          generationType: 'text-to-video',
          aspectRatio,
        },
      })
    } else if (mode === 'image-to-video') {
      generateMutation.mutate({
        data: {
          ...baseData,
          generationType: 'image-to-video',
          imageUrl: selectedImage!.url,
          sourceImageId: selectedImage!.id,
        },
      })
    } else {
      // mode === 'keyframes'
      if (isPikaKeyframes && keyframes.length >= 2) {
        generateMutation.mutate({
          data: {
            ...baseData,
            generationType: 'keyframes',
            keyframeUrls: keyframes.map((k) => k.url),
          },
        })
      } else {
        generateMutation.mutate({
          data: {
            ...baseData,
            generationType: 'keyframes',
            firstFrameUrl: firstFrame!.url,
            lastFrameUrl: lastFrame!.url,
          },
        })
      }
    }
  }

  const openImagePicker = (target: 'image' | 'first' | 'last' | number) => {
    setImagePickerTarget(target)
    setImagePickerOpen(true)
  }

  const handleImageSelect = (image: {
    id: string
    url: string
    prompt: string | null
  }) => {
    if (imagePickerTarget === 'image') {
      setSelectedImage(image)
      // Pre-fill prompt if image has one
      if (image.prompt && !prompt) {
        setPrompt(`Animate: ${image.prompt}`)
      }
    } else if (imagePickerTarget === 'first') {
      setFirstFrame(image)
    } else if (imagePickerTarget === 'last') {
      setLastFrame(image)
    } else if (typeof imagePickerTarget === 'number') {
      // Pika multi-keyframe: add at specific index
      const newKeyframes = [...keyframes]
      newKeyframes[imagePickerTarget] = image
      setKeyframes(newKeyframes)
    }
    setImagePickerOpen(false)
    textareaRef.current?.focus()
  }

  const addKeyframe = () => {
    if (keyframes.length < 5) {
      openImagePicker(keyframes.length)
    }
  }

  const removeKeyframe = (index: number) => {
    setKeyframes(keyframes.filter((_, i) => i !== index))
  }

  const handleDownload = (url: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `video-${Date.now()}.mp4`
    link.click()
  }

  const handleDelete = (videoId: string) => {
    if (confirm('Delete this video?')) {
      deleteMutation.mutate({ data: { videoId } })
    }
  }

  const handleAddToProject = () => {
    navigate({ to: '/projects' })
  }

  const isGenerating =
    generateMutation.isPending ||
    !!(
      currentJobId &&
      jobStatus?.status !== 'completed' &&
      jobStatus?.status !== 'failed'
    )

  const progress = jobStatus?.progress || 0

  // Calculate credits (including Pika extra frames)
  const creditCost = () => {
    if (!selectedModel) return 0
    let cost = selectedModel.credits
    if (isPikaKeyframes && keyframes.length > 2) {
      cost += (keyframes.length - 2) * 5
    }
    return cost
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col">
      {/* Header with Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-2 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Videos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} video{total !== 1 ? 's' : ''} in your library
          </p>
        </div>
        <VideoModeToggle mode={mode} onModeChange={setMode} />
      </div>

      {/* Main Grid Area - Scrollable */}
      <div className="flex-1 overflow-y-auto pb-60">
        {videosLoading && videos.length === 0 ? (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 px-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-video rounded-2xl" />
            ))}
          </div>
        ) : videos.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-8 border border-primary/10">
              <Video className="h-16 w-16 text-primary/70" />
            </div>
            <h3 className="mt-8 text-xl font-semibold">No videos yet</h3>
            <p className="mt-3 text-muted-foreground text-center max-w-md">
              {mode === 'text-to-video'
                ? 'Describe your scene to generate a cinematic video'
                : mode === 'image-to-video'
                  ? 'Select an image and describe the motion to bring it to life'
                  : 'Add keyframes to create a smooth transition video'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 px-2">
              {/* Generating placeholder - Premium Styling */}
              {isGenerating && (
                <Card className="aspect-video overflow-hidden rounded-2xl border-border/50 bg-card/50 p-0">
                  <div className="relative h-full w-full bg-gradient-to-br from-muted to-muted/50">
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="rounded-full bg-primary/10 p-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-foreground">
                        {jobStatus?.status === 'processing'
                          ? 'Creating video...'
                          : 'Starting...'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        ~1-3 minutes
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
              )}

              {/* Video cards */}
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onSelect={() => setSelectedVideo(video)}
                  onDownload={() => handleDownload(video.url)}
                  onAddToProject={handleAddToProject}
                  onDelete={() => handleDelete(video.id)}
                />
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div
              ref={loadMoreRef}
              className="col-span-full flex justify-center py-8"
            >
              {isFetchingNextPage && (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              )}
              {!hasNextPage && videos.length > 0 && (
                <p className="text-sm text-muted-foreground">No more videos</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Fixed Bottom Panel - Premium Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 p-4 pb-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/20 p-5">
          {/* Mode-specific inputs - Premium Styling */}
          {mode === 'image-to-video' && (
            <div className="mb-4 flex gap-4 items-center">
              {/* Image Picker Thumbnail - Premium */}
              <button
                onClick={() => openImagePicker('image')}
                className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-border/50 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10"
              >
                {selectedImage ? (
                  <>
                    <img
                      src={selectedImage.url}
                      alt="Selected"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px] opacity-0 transition-opacity hover:opacity-100">
                      <span className="text-xs font-medium text-white">
                        Change
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Image
                    </span>
                  </div>
                )}
              </button>
              <div className="flex-1">
                <p className="font-medium text-sm">First Frame</p>
                <p className="text-xs text-muted-foreground">
                  Select an image to animate
                </p>
              </div>
            </div>
          )}

          {mode === 'keyframes' && !isPikaKeyframes && (
            <div className="mb-4 flex gap-4 items-center">
              {/* First Frame - Premium */}
              <button
                onClick={() => openImagePicker('first')}
                className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-border/50 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10"
              >
                {firstFrame ? (
                  <>
                    <img
                      src={firstFrame.url}
                      alt="First frame"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px] opacity-0 transition-opacity hover:opacity-100">
                      <span className="text-xs font-medium text-white">
                        Change
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium">
                      First
                    </span>
                  </div>
                )}
              </button>

              {/* Arrow - Premium */}
              <div className="flex items-center text-primary">
                <span className="text-xl font-bold">→</span>
              </div>

              {/* Last Frame - Premium */}
              <button
                onClick={() => openImagePicker('last')}
                className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-border/50 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10"
              >
                {lastFrame ? (
                  <>
                    <img
                      src={lastFrame.url}
                      alt="Last frame"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px] opacity-0 transition-opacity hover:opacity-100">
                      <span className="text-xs font-medium text-white">
                        Change
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Last
                    </span>
                  </div>
                )}
              </button>

              <div className="flex-1">
                <p className="font-medium text-sm">Keyframes</p>
                <p className="text-xs text-muted-foreground">
                  Create a transition between images
                </p>
              </div>
            </div>
          )}

          {/* Pika multi-keyframe UI */}
          {mode === 'keyframes' && isPikaKeyframes && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">
                  Keyframes ({keyframes.length}/5)
                </span>
                <span className="text-xs text-muted-foreground">
                  Add 2-5 images for smooth transitions
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {keyframes.map((kf, index) => (
                  <div key={index} className="relative">
                    <button
                      onClick={() => openImagePicker(index)}
                      className="relative h-[60px] w-[60px] overflow-hidden rounded-lg border"
                    >
                      <img
                        src={kf.url}
                        alt={`Frame ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    <button
                      onClick={() => removeKeyframe(index)}
                      className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {keyframes.length < 5 && (
                  <button
                    onClick={addKeyframe}
                    className="flex h-[60px] w-[60px] items-center justify-center rounded-lg border-2 border-dashed hover:border-primary hover:bg-accent/50"
                  >
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Prompt Input - Premium Styling */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={
                mode === 'text-to-video'
                  ? 'Describe your video scene...'
                  : mode === 'image-to-video'
                    ? 'Describe the motion...'
                    : 'Describe the transition...'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[80px] resize-none pr-28 text-base rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60"
              rows={2}
            />
            <Button
              size="default"
              className="absolute bottom-3 right-3 rounded-xl bg-primary hover:bg-primary/90 btn-primary-glow transition-all duration-200"
              onClick={handleGenerate}
              disabled={!canGenerate()}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
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
              onValueChange={handleModelChange}
              models={availableModels}
              showDescription={true}
              showProvider={true}
            />

            {/* Duration - Premium Pills */}
            {selectedModel && selectedModel.durations.length > 1 && (
              <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
                {selectedModel.durations.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded-lg ${
                      duration === d
                        ? 'bg-primary text-primary-foreground active-glow'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            )}

            {/* Aspect Ratio (for text-to-video) - Premium */}
            {mode === 'text-to-video' && selectedModel?.aspectRatios && (
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger className="h-9 w-24 rounded-xl border-border/50 bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {selectedModel.aspectRatios.map((ar) => (
                    <SelectItem key={ar} value={ar}>
                      {ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Audio Toggle - Premium */}
            {selectedModel?.supportsAudio && (
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
                <Switch
                  id="audio"
                  checked={generateAudio}
                  onCheckedChange={setGenerateAudio}
                />
                <Label htmlFor="audio" className="text-xs font-medium">
                  Audio
                </Label>
              </div>
            )}

            {/* Credits Display - Premium Badge */}
            <div className="ml-auto flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-medium text-primary">
                {creditCost()} credits
              </span>
            </div>
          </div>

          {/* Error Display - Premium */}
          {(generateMutation.isError || jobStatus?.status === 'failed') && (
            <div className="mt-3 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2">
              <p className="text-sm text-destructive">
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : jobStatus?.error || 'Generation failed'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Image Picker Dialog */}
      <Dialog open={imagePickerOpen} onOpenChange={setImagePickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {imagePickerTarget === 'image'
                ? 'Select an image to animate'
                : imagePickerTarget === 'first'
                  ? 'Select first frame'
                  : imagePickerTarget === 'last'
                    ? 'Select last frame'
                    : `Select frame ${imagePickerTarget + 1}`}
            </DialogTitle>
          </DialogHeader>
          {imagesLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No images yet</p>
              <Button
                className="mt-4"
                onClick={() =>
                  navigate({ to: '/images', search: { mode: 'generate' } })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Image First
              </Button>
            </div>
          ) : (
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
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
                    <Check className="h-8 w-8 text-white" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Panel */}
      <Sheet open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/30">
            <SheetTitle>Video Details</SheetTitle>
          </SheetHeader>
          {selectedVideo && (
            <div className="space-y-6 px-6 pb-6 pt-6">
              {/* Video Preview with Glow Border */}
              <div className="overflow-hidden rounded-2xl border border-primary/20 premium-glow bg-black">
                <video
                  src={selectedVideo.url}
                  className="w-full"
                  controls
                  autoPlay
                  loop
                />
              </div>

              {/* Prompt Card */}
              {selectedVideo.prompt && (
                <div className="rounded-xl border border-border/30 bg-card/50 p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm font-medium">Prompt</span>
                  </div>
                  <p className="text-sm leading-relaxed">
                    {selectedVideo.prompt}
                  </p>
                </div>
              )}

              {/* Metadata Card */}
              <div className="rounded-xl border border-border/30 bg-card/50 p-4">
                <div className="grid grid-cols-2 gap-4">
                  {selectedVideo.metadata?.generationType && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Film className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Type
                        </span>
                        <p className="text-sm font-medium capitalize">
                          {selectedVideo.metadata.generationType.replace(
                            /-/g,
                            ' ',
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedVideo.model && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Model
                        </span>
                        <p className="text-sm font-medium">
                          {selectedVideo.model.split('/').pop()}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedVideo.durationSeconds && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Duration
                        </span>
                        <p className="text-sm font-medium">
                          {selectedVideo.durationSeconds}s
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedVideo.metadata?.aspectRatio && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Maximize2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Aspect Ratio
                        </span>
                        <p className="text-sm font-medium">
                          {selectedVideo.metadata.aspectRatio}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Created
                      </span>
                      <p className="text-sm font-medium">
                        {new Date(selectedVideo.createdAt).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary Action: Add to Project */}
              <Button
                className="w-full rounded-xl bg-primary hover:bg-primary/90 btn-primary-glow h-11"
                onClick={handleAddToProject}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                Add to Project
              </Button>

              {/* Secondary Action: Download */}
              <Button
                variant="outline"
                className="w-full rounded-xl border-border/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                onClick={() => handleDownload(selectedVideo.url)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>

              {/* Delete Button - Separated at Bottom */}
              <div className="pt-2 border-t border-border/30">
                <Button
                  variant="ghost"
                  className="w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete(selectedVideo.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Video
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// Video Card Component - Premium Design
interface VideoCardProps {
  video: GeneratedVideo
  onSelect: () => void
  onDownload: () => void
  onAddToProject: () => void
  onDelete: () => void
}

function VideoCard({
  video,
  onSelect,
  onDownload,
  onAddToProject,
  onDelete,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleMouseEnter = () => {
    videoRef.current?.play()
  }

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Card
        className="group cursor-pointer overflow-hidden rounded-2xl border-border/30 bg-card/30 p-0 transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
        onClick={onSelect}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="relative aspect-video bg-muted/50 overflow-hidden">
          <video
            ref={videoRef}
            src={video.url}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            muted
            loop
            playsInline
          />

          {/* Play icon when not hovering */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-all duration-300 group-hover:opacity-0">
            <div className="rounded-full bg-white/20 backdrop-blur-sm p-4 transition-transform group-hover:scale-90">
              <Play className="h-10 w-10 text-white drop-shadow-lg" />
            </div>
          </div>

          {/* Duration badge - Premium */}
          {video.durationSeconds && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white">
              <Clock className="h-3 w-3" />
              {video.durationSeconds}s
            </div>
          )}

          {/* Hover overlay with frosted glass effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-all duration-300 group-hover:opacity-100 backdrop-blur-[2px]">
            {/* Action buttons - Premium */}
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
                      onAddToProject()
                    }}
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add to Project</TooltipContent>
              </Tooltip>

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

            {/* Prompt preview at bottom - Premium */}
            {video.prompt && (
              <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <p className="line-clamp-3 text-sm text-white/90 leading-relaxed">
                  {video.prompt}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </TooltipProvider>
  )
}
