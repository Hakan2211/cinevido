/**
 * Motion Lab — transfer the motion of a reference video onto a character
 * image (Kling motion control).
 *
 * Same layout as the other labs: settings on the left (character, reference
 * clip, model, orientation, prompt) with Generate · ≈ $X, results on the right.
 * There is no duration control: the output follows the reference clip, capped
 * at 30s ("match video" orientation) or 10s ("match image"), and it is priced
 * at that length.
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
  Clock,
  Download,
  Loader2,
  MessageSquare,
  Move,
  Play,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { estimateCost, formatEstimate, formatUsd } from '@/lib/pricing'
import {
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
  VideoPickerDialog,
} from '@/components/generate'
import type { PickedVideo, SlotImage } from '@/components/generate'
// NOTE: Server functions are dynamically imported in queryFn/mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { Switch } from '../../../components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../../components/ui/sheet'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import {
  DEFAULT_MODELS,
  MOTION_CONTROL_MODELS,
} from '../../../server/services/types'
import type {
  CharacterOrientation,
  MotionControlModelConfig,
} from '../../../server/services/types'
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
    sourceVideoUrl?: string
    characterOrientation?: string
  } | null
  createdAt: Date
}

const ORIENTATIONS: ReadonlyArray<{
  value: CharacterOrientation
  label: string
  hint: string
}> = [
  {
    value: 'video',
    label: 'Match video',
    hint: 'Follows the reference clip’s framing — best for complex moves. Up to 30s.',
  },
  {
    value: 'image',
    label: 'Match image',
    hint: 'Keeps your character’s pose and framing — best for camera moves. Up to 10s.',
  },
]

const limit = 12

function MotionControlPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Inputs
  const [characterImage, setCharacterImage] = useState<SlotImage | null>(null)
  const [referenceVideo, setReferenceVideo] = useState<PickedVideo | null>(null)
  /** the reference clip's length as the browser measured it */
  const [referenceDuration, setReferenceDuration] = useState<number | null>(
    null,
  )
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<string>(DEFAULT_MODELS.motionControl)
  const [orientation, setOrientation] = useState<CharacterOrientation>('video')
  const [keepSound, setKeepSound] = useState(true)

  // UI
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(
    null,
  )
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const lastQueueToastRef = useRef<number | null>(null)

  const selectedModel: MotionControlModelConfig | undefined =
    MOTION_CONTROL_MODELS.find((m) => m.id === model)
  const cap =
    orientation === 'image'
      ? (selectedModel?.maxDurationImage ?? 10)
      : (selectedModel?.maxDurationVideo ?? 30)
  const outputSeconds =
    referenceDuration !== null ? Math.min(referenceDuration, cap) : null

  // Priced at the output length; before the clip's length is known, the cap
  const costLabel =
    outputSeconds !== null
      ? formatEstimate(
          estimateCost(selectedModel?.pricing, { durationSec: outputSeconds }),
        )
      : selectedModel?.pricing
        ? `≤ ${formatUsd(estimateCost(selectedModel.pricing, { durationSec: cap })!.max)}`
        : null

  // ---- library ----

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
      const loaded = allPages.length * limit
      return loaded < lastPage.total ? allPages.length : undefined
    },
    initialPageParam: 0,
  })
  const videos: Array<GeneratedVideo> =
    videosData?.pages.flatMap((page) => page.videos) ?? []
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

  // ---- mutations ----

  const generateMutation = useMutation({
    mutationFn: async (input: { data: Record<string, unknown> }) => {
      const { generateMotionControlFn } =
        await import('../../../server/motion-control.server')
      return generateMotionControlFn(input as never)
    },
    onSuccess: (result) => setCurrentJobId(result.jobId),
  })

  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { deleteVideoFn } = await import('../../../server/video.server')
      return deleteVideoFn({ data: { videoId } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motion-control-videos'] })
      setSelectedVideo(null)
    },
  })

  const uploadVideoMutation = useMutation({
    mutationFn: async (input: {
      videoData: string
      filename: string
      contentType:
        | 'video/mp4'
        | 'video/webm'
        | 'video/quicktime'
        | 'video/x-msvideo'
    }) => {
      const { uploadUserVideoFn } = await import('../../../server/video.server')
      return uploadUserVideoFn({ data: input })
    },
    onSuccess: (result) => {
      pickReference({
        id: result.video.id,
        url: result.video.url,
        prompt: result.video.prompt,
      })
      toast.success('Video uploaded')
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to upload video'),
  })

  // ---- job polling ----

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
      return status === 'completed' || status === 'failed' ? false : 3000
    },
  })

  useEffect(() => {
    if (jobStatus?.status === 'completed') {
      setCurrentJobId(null)
      queryClient.invalidateQueries({ queryKey: ['motion-control-videos'] })
      queryClient.invalidateQueries({ queryKey: ['falCredits'] })
      toast.success('Motion clip ready')
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
            description: `Queue position ${queuePosition}. Consider trying again later.`,
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

  const isGenerating =
    generateMutation.isPending ||
    !!(
      currentJobId &&
      jobStatus?.status !== 'completed' &&
      jobStatus?.status !== 'failed'
    )

  const canGenerate =
    !!characterImage && !!referenceVideo && !!selectedModel && !isGenerating

  // ---- actions ----

  const pickReference = (video: PickedVideo) => {
    setReferenceVideo(video)
    setReferenceDuration(video.durationSeconds ?? null)
    setVideoPickerOpen(false)
  }

  const handleGenerate = () => {
    if (!canGenerate) return
    generateMutation.mutate({
      data: {
        imageUrl: characterImage.url,
        imageAssetId: characterImage.id,
        videoUrl: referenceVideo.url,
        videoAssetId: referenceVideo.id,
        prompt: prompt.trim() || undefined,
        model,
        characterOrientation: orientation,
        keepOriginalSound: keepSound,
        referenceDurationSec: referenceDuration ?? undefined,
      },
    })
  }

  const handleVideoUpload = (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Video too large. Maximum size is 100 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      uploadVideoMutation.mutate({
        videoData: (reader.result as string).split(',')[1],
        filename: file.name,
        contentType: file.type as
          | 'video/mp4'
          | 'video/webm'
          | 'video/quicktime'
          | 'video/x-msvideo',
      })
    }
    reader.onerror = () => toast.error('Failed to read file')
    reader.readAsDataURL(file)
  }

  const handleDownload = async (url: string, videoId: string) => {
    await downloadFile(url, generateFilename(url, 'motion'), {
      onStart: () => setDownloadingId(videoId),
      onComplete: () => {
        setDownloadingId(null)
        toast.success('Download complete')
      },
      onError: (error) => {
        setDownloadingId(null)
        toast.error(`Download failed: ${error.message}`)
      },
    })
  }

  const handleStopWaiting = useCallback(() => {
    setCurrentJobId(null)
    lastQueueToastRef.current = null
    toast.info('Stopped waiting for this clip')
  }, [])

  const error =
    generateMutation.error instanceof Error
      ? generateMutation.error.message
      : jobStatus?.status === 'failed'
        ? jobStatus.error || 'Generation failed'
        : null

  const nameOf = (id: string | null) =>
    MOTION_CONTROL_MODELS.find((m) => m.id === id)?.name ??
    id?.split('/').slice(-3, -1).join(' ') ??
    'Motion clip'

  const costOf = (video: GeneratedVideo) => {
    const rule = MOTION_CONTROL_MODELS.find(
      (m) => m.id === video.model,
    )?.pricing
    return video.durationSeconds
      ? (formatEstimate(
          estimateCost(rule, { durationSec: video.durationSeconds }),
        )?.replace('≈ ', '') ?? null)
      : null
  }

  return (
    <LabShell>
      {/* ================= Settings panel ================= */}
      <LabPanel
        title="Motion Control"
        subtitle="Make your character move like the reference clip."
        footer={
          <GenerateButton
            label="Generate"
            icon={Move}
            busy={isGenerating}
            busyLabel="Generating…"
            costLabel={costLabel}
            disabled={!canGenerate}
            onClick={handleGenerate}
            hint={
              outputSeconds !== null
                ? `Priced for ${Math.round(outputSeconds)}s · billed to your fal account`
                : 'Priced at the longest output until the clip loads'
            }
          />
        }
      >
        <Field label="Inputs">
          <div className="grid grid-cols-2 gap-3">
            <FrameSlot
              image={characterImage}
              label="Character"
              onPick={() => setImagePickerOpen(true)}
              onClear={() => setCharacterImage(null)}
            />
            {referenceVideo ? (
              <div className="group relative aspect-video overflow-hidden rounded-xl border border-border bg-black">
                <video
                  src={referenceVideo.url}
                  className="h-full w-full object-cover"
                  muted
                  loop
                  autoPlay
                  playsInline
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration
                    if (Number.isFinite(d) && d > 0) setReferenceDuration(d)
                  }}
                />
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                  Motion
                  {referenceDuration !== null &&
                    ` · ${Math.round(referenceDuration)}s`}
                </span>
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => setVideoPickerOpen(true)}
                    className="rounded-md bg-white/15 px-2 py-1 text-xs font-medium text-white hover:bg-white/25"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReferenceVideo(null)
                      setReferenceDuration(null)
                    }}
                    className="rounded-md bg-white/15 px-2 py-1 text-xs font-medium text-white hover:bg-white/25"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setVideoPickerOpen(true)}
                className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:bg-accent/40 hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                <span className="text-xs font-medium">Motion clip</span>
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A clear, full-body character image works best. The clip’s movement —
            and its length — carry over.
          </p>
          {referenceDuration !== null && referenceDuration > cap && (
            <p className="mt-1 text-xs text-muted-foreground">
              The clip is {Math.round(referenceDuration)}s; the output stops at{' '}
              {cap}s.
            </p>
          )}
        </Field>

        <Field label="Model">
          <ModelRadioList
            models={MOTION_CONTROL_MODELS}
            value={model}
            onChange={setModel}
            footnote="Billed per second of output."
          />
        </Field>

        <Field label="Orientation">
          <Segmented
            options={ORIENTATIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={orientation}
            onChange={setOrientation}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {ORIENTATIONS.find((o) => o.value === orientation)?.hint}
          </p>
        </Field>

        <Field label="Prompt" hint="optional">
          <PromptBox
            value={prompt}
            onChange={setPrompt}
            max={500}
            rows={3}
            placeholder="Describe the scene or style — the motion comes from the clip"
          />
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Keep original sound</p>
            <p className="text-xs text-muted-foreground">
              Carry the reference clip’s audio into the result
            </p>
          </div>
          <Switch checked={keepSound} onCheckedChange={setKeepSound} />
        </div>

        {error && <FieldError>{error}</FieldError>}
      </LabPanel>

      {/* ================= Results ================= */}
      <LabResults count={total}>
        {videosLoading && videos.length === 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-video rounded-xl" />
            ))}
          </div>
        ) : videos.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-28 text-center">
            <Move className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-5 text-lg font-medium">No motion clips yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Pick a character image and a clip of someone moving on the left —
              a dance, a walk, a gesture.
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
                  eta="Usually 2–6 minutes"
                  progress={jobStatus?.progress || 0}
                  queuePosition={jobStatus?.queuePosition}
                  onStopWaiting={handleStopWaiting}
                  title={selectedModel?.name}
                  cost={costLabel}
                />
              )}
              {videos.map((video) => (
                <MotionCard
                  key={video.id}
                  video={video}
                  title={nameOf(video.model)}
                  cost={costOf(video)}
                  onSelect={() => setSelectedVideo(video)}
                  onDownload={() => void handleDownload(video.url, video.id)}
                  onDelete={() => setDeleteId(video.id)}
                  downloading={downloadingId === video.id}
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

      <ImagePickerDialog
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        title="Choose the character"
        onPick={([image]) => {
          setCharacterImage(image)
          setImagePickerOpen(false)
        }}
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

      <VideoPickerDialog
        open={videoPickerOpen}
        onOpenChange={setVideoPickerOpen}
        title="Choose the motion clip"
        onPick={pickReference}
        onUpload={handleVideoUpload}
        uploading={uploadVideoMutation.isPending}
      />

      {/* Detail panel */}
      <Sheet open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-b border-border px-6 pt-6 pb-4">
            <SheetTitle>Motion clip</SheetTitle>
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

              {(selectedVideo.metadata?.sourceImageUrl ||
                selectedVideo.metadata?.sourceVideoUrl) && (
                <div className="grid grid-cols-2 gap-3">
                  {selectedVideo.metadata.sourceImageUrl && (
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        Character
                      </p>
                      <img
                        src={selectedVideo.metadata.sourceImageUrl}
                        alt="Character"
                        className="aspect-video w-full rounded-lg border border-border object-cover"
                      />
                    </div>
                  )}
                  {selectedVideo.metadata.sourceVideoUrl && (
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        Motion clip
                      </p>
                      <video
                        src={selectedVideo.metadata.sourceVideoUrl}
                        className="aspect-video w-full rounded-lg border border-border object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    </div>
                  )}
                </div>
              )}

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
                <Meta icon={Zap} label="Model">
                  {nameOf(selectedVideo.model)}
                </Meta>
                {selectedVideo.metadata?.characterOrientation && (
                  <Meta icon={Move} label="Orientation">
                    {selectedVideo.metadata.characterOrientation === 'image'
                      ? 'Match image'
                      : 'Match video'}
                  </Meta>
                )}
                {selectedVideo.durationSeconds && (
                  <Meta icon={Clock} label="Duration">
                    {Math.round(selectedVideo.durationSeconds)}s
                  </Meta>
                )}
                <Meta icon={Calendar} label="Created">
                  {new Date(selectedVideo.createdAt).toLocaleDateString(
                    'en-US',
                    { month: 'short', day: 'numeric', year: 'numeric' },
                  )}
                </Meta>
              </div>

              <Button
                variant="secondary"
                className="w-full"
                disabled={downloadingId === selectedVideo.id}
                onClick={() =>
                  void handleDownload(selectedVideo.url, selectedVideo.id)
                }
              >
                {downloadingId === selectedVideo.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download
              </Button>

              <div className="border-t border-border pt-3">
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteId(selectedVideo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete clip
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete motion clip?"
        description="This action cannot be undone. The clip will be permanently removed from your library."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId)
          setDeleteId(null)
        }}
        isLoading={deleteMutation.isPending}
      />
    </LabShell>
  )
}

function MotionCard({
  video,
  title,
  cost,
  onSelect,
  onDownload,
  onDelete,
  downloading,
}: {
  video: GeneratedVideo
  title: string
  cost: string | null
  onSelect: () => void
  onDownload: () => void
  onDelete: () => void
  downloading: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  return (
    <ResultCard
      title={title}
      cost={cost}
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
      menuLabel="Clip actions"
      menuActions={[
        {
          label: 'Download',
          icon: Download,
          onClick: onDownload,
          disabled: downloading,
        },
        { label: 'Delete', icon: Trash2, onClick: onDelete, destructive: true },
      ]}
      media={
        <>
          <video
            ref={videoRef}
            src={video.url}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            loop
            playsInline
          />
          <span className="absolute bottom-2.5 left-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 transition-opacity group-hover:opacity-0">
            <Play className="h-3.5 w-3.5 fill-white text-white" />
          </span>
        </>
      }
    />
  )
}
