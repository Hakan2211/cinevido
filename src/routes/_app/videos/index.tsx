/**
 * Videos Page - Unified Create & Gallery
 *
 * Professional video generation interface with:
 * - Fixed bottom prompt bar with image picker
 * - Uniform grid with skeleton placeholders
 * - Hover-to-play video previews
 * - Hover actions (download, use in project, delete)
 * - Slide-out detail panel
 * - Keyboard shortcuts (Enter to generate, Esc to close)
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  generateVideoFn,
  getVideoJobStatusFn,
  getVideoModelsFn,
  listUserVideosFn,
  deleteVideoFn,
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
import {
  Wand2,
  Loader2,
  Video,
  Download,
  Trash2,
  Play,
  Check,
  Plus,
  Image as ImageIcon,
  Clock,
  FolderPlus,
} from 'lucide-react'

export const Route = createFileRoute('/_app/videos/')({
  component: VideosPage,
})

interface GeneratedVideo {
  id: string
  url: string
  prompt: string | null
  model: string | null
  durationSeconds: number | null
  metadata: { sourceImageUrl?: string; sourceImageId?: string } | null
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

  // Form state
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null)
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(
    'fal-ai/kling-video/v1.5/pro/image-to-video',
  )
  const [duration, setDuration] = useState<5 | 10>(5)

  // UI state
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(
    null,
  )
  const [imagePickerOpen, setImagePickerOpen] = useState(false)

  // Generation state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  // Pagination
  const [page, setPage] = useState(0)
  const limit = 12

  // Check for pre-selected image from Images page
  useEffect(() => {
    const stored = sessionStorage.getItem('animateImage')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        setSelectedImage({ id: data.id, url: data.url, prompt: null })
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

  // Fetch videos
  const { data: videosData, isLoading: videosLoading } = useQuery({
    queryKey: ['videos', page],
    queryFn: () => listUserVideosFn({ data: { limit, offset: page * limit } }),
  })

  // Fetch user's images for picker
  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: ['images', 'forVideo'],
    queryFn: () => listUserImagesFn({ data: { limit: 50 } }),
    enabled: imagePickerOpen,
  })

  const models = modelsData?.models || []
  const videos = videosData?.videos || []
  const total = videosData?.total || 0
  const hasMore = videos.length + page * limit < total
  const images = imagesData?.images || []

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
  }, [prompt, model, duration, selectedImage])

  const handleGenerate = () => {
    if (!selectedImage || !prompt.trim() || isGenerating) return

    generateMutation.mutate({
      data: {
        imageUrl: selectedImage.url,
        prompt: prompt.trim(),
        model,
        duration,
        sourceImageId: selectedImage.id,
      },
    })
  }

  const handleImageSelect = (image: {
    id: string
    url: string
    prompt: string | null
  }) => {
    setSelectedImage(image)
    setImagePickerOpen(false)
    // Pre-fill prompt if image has one
    if (image.prompt && !prompt) {
      setPrompt(`Animate: ${image.prompt}`)
    }
    textareaRef.current?.focus()
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
    // Navigate to projects - asset will be available there
    navigate({ to: '/projects' })
  }

  const isGenerating =
    generateMutation.isPending ||
    !!(
      currentJobId &&
      jobStatus?.status !== 'completed' &&
      jobStatus?.status !== 'failed'
    )

  const selectedModel = models.find((m) => m.id === model)
  const progress = jobStatus?.progress || 0

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Videos</h1>
          <p className="text-sm text-muted-foreground">
            {total} video{total !== 1 ? 's' : ''} in your library
          </p>
        </div>
      </div>

      {/* Main Grid Area - Scrollable */}
      <div className="flex-1 overflow-y-auto pb-56">
        {videosLoading && videos.length === 0 ? (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-video rounded-lg" />
            ))}
          </div>
        ) : videos.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-full bg-muted p-6">
              <Video className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="mt-6 text-lg font-medium">No videos yet</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              Select an image and describe the motion to create your first
              AI-generated video
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {/* Generating placeholder */}
              {isGenerating && (
                <Card className="aspect-video overflow-hidden">
                  <div className="relative h-full w-full bg-muted">
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="mt-3 text-sm text-muted-foreground">
                        {jobStatus?.status === 'processing'
                          ? 'Creating video...'
                          : 'Starting...'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        ~1-3 minutes
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

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={videosLoading}
                >
                  {videosLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fixed Bottom Prompt Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:left-64">
        <div className="mx-auto max-w-4xl p-4">
          {/* Image + Prompt Row */}
          <div className="flex gap-3">
            {/* Image Picker Thumbnail */}
            <button
              onClick={() => setImagePickerOpen(true)}
              className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-lg border-2 border-dashed transition-colors hover:border-primary hover:bg-accent/50"
            >
              {selectedImage ? (
                <>
                  <img
                    src={selectedImage.url}
                    alt="Selected"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                    <span className="text-xs font-medium text-white">
                      Change
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                  <span className="mt-1 text-[10px] text-muted-foreground">
                    Image
                  </span>
                </div>
              )}
            </button>

            {/* Prompt Input */}
            <div className="relative flex-1">
              <Textarea
                ref={textareaRef}
                placeholder={
                  selectedImage
                    ? 'Describe the motion... (Press Enter to generate)'
                    : 'Select an image first, then describe the motion...'
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[68px] resize-none pr-24 text-base"
                rows={1}
                disabled={!selectedImage}
              />
              <Button
                size="sm"
                className="absolute bottom-2 right-2"
                onClick={handleGenerate}
                disabled={!selectedImage || !prompt.trim() || isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Wand2 className="mr-1.5 h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Inline Settings */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-8 w-44">
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

            <div className="flex rounded-md border">
              <button
                onClick={() => setDuration(5)}
                className={`px-3 py-1 text-xs font-medium transition-colors rounded-l-md ${
                  duration === 5
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                5 sec
              </button>
              <button
                onClick={() => setDuration(10)}
                className={`px-3 py-1 text-xs font-medium transition-colors rounded-r-md ${
                  duration === 10
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                10 sec
              </button>
            </div>

            <div className="ml-auto text-xs text-muted-foreground">
              {selectedModel?.credits || 20} credits
            </div>
          </div>

          {/* Error message */}
          {(generateMutation.isError || jobStatus?.status === 'failed') && (
            <p className="mt-2 text-sm text-destructive">
              {generateMutation.error instanceof Error
                ? generateMutation.error.message
                : jobStatus?.error || 'Generation failed'}
            </p>
          )}
        </div>
      </div>

      {/* Image Picker Dialog */}
      <Dialog open={imagePickerOpen} onOpenChange={setImagePickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select an image to animate</DialogTitle>
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
                  className="group relative overflow-hidden rounded-lg"
                  onClick={() => handleImageSelect(image)}
                >
                  <img
                    src={image.url}
                    alt={image.prompt || 'Image'}
                    className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
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
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Video Details</SheetTitle>
          </SheetHeader>
          {selectedVideo && (
            <div className="mt-6 space-y-6">
              {/* Video Preview */}
              <div className="overflow-hidden rounded-lg bg-black">
                <video
                  src={selectedVideo.url}
                  className="w-full"
                  controls
                  autoPlay
                  loop
                />
              </div>

              {/* Prompt */}
              {selectedVideo.prompt && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Motion Prompt
                  </h4>
                  <p className="mt-1 text-sm">{selectedVideo.prompt}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedVideo.model && (
                  <div>
                    <span className="text-muted-foreground">Model</span>
                    <p className="font-medium">
                      {selectedVideo.model.split('/').pop()}
                    </p>
                  </div>
                )}
                {selectedVideo.durationSeconds && (
                  <div>
                    <span className="text-muted-foreground">Duration</span>
                    <p className="font-medium">
                      {selectedVideo.durationSeconds}s
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p className="font-medium">
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

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDownload(selectedVideo.url)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button onClick={handleAddToProject}>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Add to Project
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleDelete(selectedVideo.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// Video Card Component
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
        className="group cursor-pointer overflow-hidden"
        onClick={onSelect}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="relative aspect-video bg-muted">
          <video
            ref={videoRef}
            src={video.url}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
          />

          {/* Play icon when not hovering */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity group-hover:opacity-0">
            <Play className="h-12 w-12 text-white" />
          </div>

          {/* Duration badge */}
          {video.durationSeconds && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs text-white">
              <Clock className="h-3 w-3" />
              {video.durationSeconds}s
            </div>
          )}

          {/* Hover overlay with actions */}
          <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {/* Action buttons */}
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

            {/* Prompt preview at bottom */}
            {video.prompt && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                <p className="line-clamp-2 text-sm text-white">
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
