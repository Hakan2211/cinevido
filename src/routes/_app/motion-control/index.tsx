/**
 * Motion Control Page
 *
 * Transfer motion from a reference video to a character image using Kling AI.
 * Features:
 * - Character image picker (library or URL)
 * - Reference video picker (library or URL)
 * - Model selection (Standard/Pro)
 * - Character orientation selection
 * - Job polling with progress indicator
 * - Gallery of generated motion control videos
 */

import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Download,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Move,
  Play,
  Trash2,
  Video,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Skeleton } from '../../../components/ui/skeleton'
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
import { MotionControlPanel } from '../../../components/motion-control/MotionControlPanel'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import type { CharacterOrientation } from '../../../server/services/types'
import { downloadFile, generateFilename } from '@/lib/download'

export const Route = createFileRoute('/_app/motion-control/')({
  component: MotionControlPage,
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
    sourceVideoUrl?: string
    sourceVideoId?: string
    characterOrientation?: string
  } | null
  createdAt: Date
}

interface SelectedAsset {
  id: string
  url: string
  prompt?: string | null
}

function MotionControlPage() {
  const queryClient = useQueryClient()

  // Character image state
  const [characterImage, setCharacterImage] = useState<SelectedAsset | null>(
    null,
  )
  const [imageUrl, setImageUrl] = useState('')

  // Reference video state
  const [referenceVideo, setReferenceVideo] = useState<SelectedAsset | null>(
    null,
  )
  const [videoUrl, setVideoUrl] = useState('')

  // Generation settings
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('fal-ai/kling-video/v3/pro/motion-control')
  const [characterOrientation, setCharacterOrientation] =
    useState<CharacterOrientation>('video')
  const [duration, setDuration] = useState(5)

  // Picker dialogs
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)

  // UI state
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(
    null,
  )
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    videoId: string | null
  }>({ open: false, videoId: null })

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Pagination
  const limit = 12
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Queue position toast deduplication
  const lastQueueToastRef = useRef<number | null>(null)

  // Fetch motion control videos (filtered by metadata.generationType)
  const {
    data: videosData,
    isLoading: videosLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['motion-control-videos'],
    queryFn: async ({ pageParam = 0 }) => {
      const { listMotionControlVideosFn } =
        await import('../../../server/motion-control.server')
      return listMotionControlVideosFn({
        data: { limit, offset: pageParam * limit },
      })
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * limit
      return loadedCount < lastPage.total ? allPages.length : undefined
    },
    initialPageParam: 0,
  })

  // Fetch user's images for picker
  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: ['images', 'forMotionControl'],
    queryFn: async () => {
      const { listUserImagesFn } = await import('../../../server/image.server')
      return listUserImagesFn({ data: { limit: 50 } })
    },
    enabled: imagePickerOpen,
  })

  // Fetch user's videos for picker
  const { data: allVideosData, isLoading: allVideosLoading } = useQuery({
    queryKey: ['videos', 'forMotionControl'],
    queryFn: async () => {
      const { listUserVideosFn } = await import('../../../server/video.server')
      return listUserVideosFn({ data: { limit: 50 } })
    },
    enabled: videoPickerOpen,
  })

  // Flatten pages
  const videos = videosData?.pages.flatMap((page) => page.videos) ?? []
  const total = videosData?.pages[0]?.total ?? 0
  const images = imagesData?.images || []
  const allVideos = allVideosData?.videos || []

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
    mutationFn: async (input: { data: Record<string, unknown> }) => {
      const { generateMotionControlFn } =
        await import('../../../server/motion-control.server')
      return generateMotionControlFn(input as never)
    },
    onSuccess: (result) => {
      setCurrentJobId(result.jobId)
      // Clear inputs after successful submission
      setPrompt('')
      setCharacterImage(null)
      setImageUrl('')
      setReferenceVideo(null)
      setVideoUrl('')
    },
    onError: (error) => {
      toast.error('Generation failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (input: { data: { videoId: string } }) => {
      const { deleteVideoFn } = await import('../../../server/video.server')
      return deleteVideoFn(input as never)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motion-control-videos'] })
      setSelectedVideo(null)
    },
  })

  // Image upload mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (input: {
      data: {
        imageData: string
        filename: string
        contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      }
    }) => {
      const { uploadUserImageFn } = await import('../../../server/image.server')
      return uploadUserImageFn(input as never)
    },
    onSuccess: (result) => {
      setCharacterImage({
        id: result.image.id,
        url: result.image.url,
        prompt: result.image.prompt,
      })
      setImageUrl('')
      toast.success('Image uploaded successfully!')
      // Invalidate images query so picker shows new image
      queryClient.invalidateQueries({ queryKey: ['images'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload image')
    },
  })

  // Video upload mutation
  const uploadVideoMutation = useMutation({
    mutationFn: async (input: {
      data: {
        videoData: string
        filename: string
        contentType:
          | 'video/mp4'
          | 'video/webm'
          | 'video/quicktime'
          | 'video/x-msvideo'
      }
    }) => {
      const { uploadUserVideoFn } = await import('../../../server/video.server')
      return uploadUserVideoFn(input as never)
    },
    onSuccess: (result) => {
      setReferenceVideo({
        id: result.video.id,
        url: result.video.url,
        prompt: result.video.prompt,
      })
      setVideoUrl('')
      toast.success('Video uploaded successfully!')
      // Invalidate videos query so picker shows new video
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload video')
    },
  })

  // Poll job status
  const { data: jobStatus } = useQuery({
    queryKey: ['motionControlJob', currentJobId],
    queryFn: async () => {
      const { getMotionControlJobStatusFn } =
        await import('../../../server/motion-control.server')
      return getMotionControlJobStatusFn({ data: { jobId: currentJobId! } })
    },
    enabled: !!currentJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') {
        return false
      }
      return 3000
    },
  })

  // Handle job completion
  useEffect(() => {
    if (jobStatus?.status === 'completed') {
      setCurrentJobId(null)
      queryClient.invalidateQueries({ queryKey: ['motion-control-videos'] })
      toast.success('Motion control video generated!')
    }
    if (jobStatus?.status === 'failed') {
      toast.error('Generation failed', {
        description: jobStatus.error || 'Unknown error',
      })
    }
  }, [jobStatus, queryClient])

  // Queue position toast notifications
  useEffect(() => {
    const queuePosition = jobStatus?.queuePosition
    if (queuePosition && queuePosition >= 50) {
      const range = queuePosition >= 200 ? 200 : queuePosition >= 100 ? 100 : 50
      if (lastQueueToastRef.current !== range) {
        lastQueueToastRef.current = range
        if (queuePosition >= 200) {
          toast.error('fal.ai Overloaded', {
            description: `Queue position: ${queuePosition}. Consider trying again later.`,
            duration: 8000,
          })
        } else {
          toast.warning('fal.ai High Demand', {
            description: `Queue position: ${queuePosition}. Generation may take longer.`,
            duration: 6000,
          })
        }
      }
    } else if (!queuePosition) {
      lastQueueToastRef.current = null
    }
  }, [jobStatus?.queuePosition])

  const canGenerate = useCallback(() => {
    const hasImage = !!(characterImage || imageUrl.trim())
    const hasVideo = !!(referenceVideo || videoUrl.trim())
    return hasImage && hasVideo && !isGenerating
  }, [characterImage, imageUrl, referenceVideo, videoUrl])

  const handleGenerate = () => {
    if (!canGenerate()) return

    const finalImageUrl = characterImage?.url || imageUrl.trim()
    const finalVideoUrl = referenceVideo?.url || videoUrl.trim()

    generateMutation.mutate({
      data: {
        imageUrl: finalImageUrl,
        imageAssetId: characterImage?.id,
        videoUrl: finalVideoUrl,
        videoAssetId: referenceVideo?.id,
        prompt: prompt.trim() || undefined,
        model,
        characterOrientation,
        duration,
      },
    })
  }

  const handleImageSelect = (image: {
    id: string
    url: string
    prompt: string | null
  }) => {
    setCharacterImage(image)
    setImageUrl('')
    setImagePickerOpen(false)
  }

  const handleVideoSelect = (video: GeneratedVideo) => {
    setReferenceVideo({ id: video.id, url: video.url, prompt: video.prompt })
    setVideoUrl('')
    setVideoPickerOpen(false)
  }

  // Handle orientation change with duration auto-reset
  const handleOrientationChange = (newOrientation: CharacterOrientation) => {
    setCharacterOrientation(newOrientation)
    // Auto-reset duration to 10s if switching to image mode and current duration > 10s
    if (newOrientation === 'image' && duration > 10) {
      setDuration(10)
    }
  }

  // Handle image file upload
  const handleImageUpload = (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload JPG, PNG, WebP, or GIF.')
      return
    }
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large. Maximum size is 10MB.')
      return
    }

    // Convert to base64 and upload
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64Data = result.split(',')[1]
      uploadImageMutation.mutate({
        data: {
          imageData: base64Data,
          filename: file.name,
          contentType: file.type as
            | 'image/jpeg'
            | 'image/png'
            | 'image/webp'
            | 'image/gif',
        },
      })
    }
    reader.onerror = () => {
      toast.error('Failed to read file')
    }
    reader.readAsDataURL(file)
  }

  // Handle video file upload
  const handleVideoUpload = (file: File) => {
    // Validate file type
    const validTypes = [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
    ]
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload MP4, WebM, MOV, or AVI.')
      return
    }
    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Video too large. Maximum size is 100MB.')
      return
    }

    // Convert to base64 and upload
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64Data = result.split(',')[1]
      uploadVideoMutation.mutate({
        data: {
          videoData: base64Data,
          filename: file.name,
          contentType: file.type as
            | 'video/mp4'
            | 'video/webm'
            | 'video/quicktime'
            | 'video/x-msvideo',
        },
      })
    }
    reader.onerror = () => {
      toast.error('Failed to read file')
    }
    reader.readAsDataURL(file)
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

  const handleDelete = (videoId: string) => {
    setDeleteDialog({ open: true, videoId })
  }

  const handleConfirmDelete = () => {
    if (!deleteDialog.videoId) return
    deleteMutation.mutate({ data: { videoId: deleteDialog.videoId } })
  }

  // Cancel job
  const handleCancelJob = useCallback(() => {
    setCurrentJobId(null)
    lastQueueToastRef.current = null
    toast.info('Generation cancelled')
  }, [])

  const isGenerating =
    generateMutation.isPending ||
    !!(
      currentJobId &&
      jobStatus?.status !== 'completed' &&
      jobStatus?.status !== 'failed'
    )

  const progress = jobStatus?.progress || 0
  const error =
    generateMutation.error instanceof Error
      ? generateMutation.error.message
      : jobStatus?.status === 'failed'
        ? jobStatus.error || 'Generation failed'
        : null

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Motion Control</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} video{total !== 1 ? 's' : ''} - Transfer motion from videos
            to characters
          </p>
        </div>
      </div>

      {/* Main Grid Area - Scrollable */}
      <div className="flex-1 overflow-y-auto pb-80">
        {videosLoading && videos.length === 0 ? (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 px-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-video rounded-2xl" />
            ))}
          </div>
        ) : videos.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-8 border border-primary/10">
              <Move className="h-16 w-16 text-primary/70" />
            </div>
            <h3 className="mt-8 text-xl font-semibold">
              No motion control videos yet
            </h3>
            <p className="mt-3 text-muted-foreground text-center max-w-md">
              Select a character image and a motion reference video to transfer
              the movements to your character.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 px-2">
              {/* Generating placeholder */}
              {isGenerating && (
                <Card className="aspect-video overflow-hidden rounded-2xl border-border/50 bg-card/50 p-0">
                  <div className="relative h-full w-full bg-gradient-to-br from-muted to-muted/50">
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                      <div className="rounded-full bg-primary/10 p-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-foreground">
                        {jobStatus?.status === 'processing'
                          ? 'Transferring motion...'
                          : 'Starting...'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        ~2-5 minutes
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

                      {/* Queue position warning */}
                      {jobStatus?.queuePosition &&
                        jobStatus.queuePosition >= 50 && (
                          <Alert
                            variant={
                              jobStatus.queuePosition >= 200
                                ? 'destructive'
                                : 'default'
                            }
                            className={`mt-4 w-full max-w-xs ${
                              jobStatus.queuePosition >= 200
                                ? ''
                                : 'border-yellow-500/50 bg-yellow-500/10'
                            }`}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle className="text-sm">
                              {jobStatus.queuePosition >= 200
                                ? 'fal.ai Overloaded'
                                : 'High Demand'}
                            </AlertTitle>
                            <AlertDescription className="text-xs">
                              Queue position: {jobStatus.queuePosition}
                              {jobStatus.queuePosition >= 200 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2 w-full"
                                  onClick={handleCancelJob}
                                >
                                  <X className="mr-1 h-3 w-3" />
                                  Cancel
                                </Button>
                              )}
                            </AlertDescription>
                          </Alert>
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
                  onDownload={() => handleDownload(video.url, video.id)}
                  onDelete={() => handleDelete(video.id)}
                  isDownloading={downloadingId === video.id}
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

      {/* Fixed Bottom Panel */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 p-4 pb-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/20 p-5">
          <MotionControlPanel
            characterImage={characterImage}
            onSelectCharacterImage={() => setImagePickerOpen(true)}
            imageUrl={imageUrl}
            onImageUrlChange={setImageUrl}
            referenceVideo={referenceVideo}
            onSelectReferenceVideo={() => setVideoPickerOpen(true)}
            videoUrl={videoUrl}
            onVideoUrlChange={setVideoUrl}
            onUploadImage={handleImageUpload}
            onUploadVideo={handleVideoUpload}
            isUploadingImage={uploadImageMutation.isPending}
            isUploadingVideo={uploadVideoMutation.isPending}
            prompt={prompt}
            onPromptChange={setPrompt}
            model={model}
            onModelChange={setModel}
            characterOrientation={characterOrientation}
            onCharacterOrientationChange={handleOrientationChange}
            duration={duration}
            onDurationChange={setDuration}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            canGenerate={canGenerate()}
            error={error}
          />
        </div>
      </div>

      {/* Image Picker Dialog */}
      <Dialog open={imagePickerOpen} onOpenChange={setImagePickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select a character image</DialogTitle>
          </DialogHeader>
          {imagesLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No images yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Generate some images first or paste a URL
              </p>
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

      {/* Video Picker Dialog */}
      <Dialog open={videoPickerOpen} onOpenChange={setVideoPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select a motion reference video</DialogTitle>
          </DialogHeader>
          {allVideosLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : allVideos.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center">
              <Video className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No videos yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Generate some videos first or paste a URL
              </p>
            </div>
          ) : (
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
              {allVideos.map((video) => (
                <button
                  key={video.id}
                  className="group relative aspect-video overflow-hidden rounded-xl bg-muted"
                  onClick={() => handleVideoSelect(video)}
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
                  {video.durationSeconds && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
                      <Clock className="h-3 w-3" />
                      {video.durationSeconds}s
                    </div>
                  )}
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
            <SheetTitle>Motion Control Video</SheetTitle>
          </SheetHeader>
          {selectedVideo && (
            <div className="space-y-6 px-6 pb-6 pt-6">
              {/* Video Preview */}
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
                          {selectedVideo.model.includes('pro')
                            ? 'Pro'
                            : 'Standard'}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedVideo.metadata?.characterOrientation && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Move className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Orientation
                        </span>
                        <p className="text-sm font-medium capitalize">
                          Match {selectedVideo.metadata.characterOrientation}
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

              {/* Download Button */}
              <Button
                variant="outline"
                className="w-full rounded-xl border-border/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary disabled:opacity-50"
                disabled={downloadingId === selectedVideo.id}
                onClick={() =>
                  handleDownload(selectedVideo.url, selectedVideo.id)
                }
              >
                {downloadingId === selectedVideo.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {downloadingId === selectedVideo.id
                  ? 'Downloading...'
                  : 'Download'}
              </Button>

              {/* Delete Button */}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title="Delete Video?"
        description="This action cannot be undone. The video will be permanently removed."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// Video Card Component
interface VideoCardProps {
  video: GeneratedVideo
  onSelect: () => void
  onDownload: () => void
  onDelete: () => void
  isDownloading?: boolean
}

function VideoCard({
  video,
  onSelect,
  onDownload,
  onDelete,
  isDownloading = false,
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

          {/* Motion control badge */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-primary/80 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white">
            <Move className="h-3 w-3" />
            Motion
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-all duration-300 group-hover:opacity-100 backdrop-blur-[2px]">
            {/* Action buttons */}
            <div className="absolute right-3 top-3 flex gap-2 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white disabled:opacity-50"
                    disabled={isDownloading}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDownload()
                    }}
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isDownloading ? 'Downloading...' : 'Download'}
                </TooltipContent>
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

            {/* Prompt preview */}
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
