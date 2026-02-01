/**
 * MotionControlPanel - Premium bottom panel for motion control generation
 *
 * Inputs:
 * - Character image (from library, upload, or URL)
 * - Reference motion video (from library, upload, or URL)
 * - Optional prompt for guidance
 * - Model selection (Standard/Pro)
 * - Character orientation (video/image)
 */

import { useRef } from 'react'
import {
  Clock,
  ImageIcon,
  Loader2,
  Plus,
  Upload,
  Video,
  Wand2,
} from 'lucide-react'
import type { CharacterOrientation } from '@/server/services/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelect } from '@/components/ui/model-select'
import {
  MOTION_CONTROL_MODELS,
  getMotionControlModelById,
} from '@/server/services/types'
import { cn } from '@/lib/utils'

interface SelectedAsset {
  id: string
  url: string
  prompt?: string | null
}

interface MotionControlPanelProps {
  // Character image (required)
  characterImage: SelectedAsset | null
  onSelectCharacterImage: () => void
  imageUrl: string
  onImageUrlChange: (url: string) => void

  // Reference video (required)
  referenceVideo: SelectedAsset | null
  onSelectReferenceVideo: () => void
  videoUrl: string
  onVideoUrlChange: (url: string) => void

  // Upload handlers
  onUploadImage: (file: File) => void
  onUploadVideo: (file: File) => void
  isUploadingImage: boolean
  isUploadingVideo: boolean

  // Optional settings
  prompt: string
  onPromptChange: (prompt: string) => void
  model: string
  onModelChange: (model: string) => void
  characterOrientation: CharacterOrientation
  onCharacterOrientationChange: (orientation: CharacterOrientation) => void
  duration: number
  onDurationChange: (duration: number) => void

  // Actions
  onGenerate: () => void
  isGenerating: boolean
  canGenerate: boolean
  error: string | null
  className?: string
}

const IMAGE_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]
const VIDEO_ACCEPTED_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
]

export function MotionControlPanel({
  characterImage,
  onSelectCharacterImage,
  imageUrl,
  onImageUrlChange,
  referenceVideo,
  onSelectReferenceVideo,
  videoUrl,
  onVideoUrlChange,
  onUploadImage,
  onUploadVideo,
  isUploadingImage,
  isUploadingVideo,
  prompt,
  onPromptChange,
  model,
  onModelChange,
  characterOrientation,
  onCharacterOrientationChange,
  duration,
  onDurationChange,
  onGenerate,
  isGenerating,
  canGenerate,
  error,
  className,
}: MotionControlPanelProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const hasImage = !!(characterImage || imageUrl.trim())
  const hasVideo = !!(referenceVideo || videoUrl.trim())

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onUploadImage(files[0])
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onUploadVideo(files[0])
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept={IMAGE_ACCEPTED_TYPES.join(',')}
        onChange={handleImageFileSelect}
        className="sr-only"
        disabled={isUploadingImage}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={VIDEO_ACCEPTED_TYPES.join(',')}
        onChange={handleVideoFileSelect}
        className="sr-only"
        disabled={isUploadingVideo}
      />

      {/* Two-column layout for image + video inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Character Image Column */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            Character Image
            <span className="text-xs text-muted-foreground">(required)</span>
          </label>
          <div className="flex gap-2">
            {/* Thumbnail picker - Library */}
            <button
              onClick={onSelectCharacterImage}
              disabled={isUploadingImage}
              className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-border/50 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploadingImage ? (
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Uploading
                  </span>
                </div>
              ) : characterImage ? (
                <>
                  <img
                    src={characterImage.url}
                    alt="Character"
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
                  <Plus className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Library
                  </span>
                </div>
              )}
            </button>

            {/* Upload button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingImage}
              className="h-[72px] w-[72px] shrink-0 rounded-xl border-border/50 hover:border-primary/50 hover:bg-primary/5"
            >
              {isUploadingImage ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Upload
                  </span>
                </div>
              )}
            </Button>

            {/* URL input */}
            <Input
              placeholder="Or paste image URL..."
              value={imageUrl}
              onChange={(e) => onImageUrlChange(e.target.value)}
              className="flex-1 rounded-xl border-border/50 bg-background/50"
            />
          </div>
        </div>

        {/* Reference Video Column */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            Motion Reference
            <span className="text-xs text-muted-foreground">(required)</span>
          </label>
          <div className="flex gap-2">
            {/* Thumbnail picker - Library */}
            <button
              onClick={onSelectReferenceVideo}
              disabled={isUploadingVideo}
              className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-border/50 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploadingVideo ? (
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Uploading
                  </span>
                </div>
              ) : referenceVideo ? (
                <>
                  <video
                    src={referenceVideo.url}
                    className="h-full w-full object-cover"
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px] opacity-0 transition-opacity hover:opacity-100">
                    <span className="text-xs font-medium text-white">
                      Change
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Library
                  </span>
                </div>
              )}
            </button>

            {/* Upload button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploadingVideo}
              className="h-[72px] w-[72px] shrink-0 rounded-xl border-border/50 hover:border-primary/50 hover:bg-primary/5"
            >
              {isUploadingVideo ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Upload
                  </span>
                </div>
              )}
            </Button>

            {/* URL input */}
            <Input
              placeholder="Or paste video URL..."
              value={videoUrl}
              onChange={(e) => onVideoUrlChange(e.target.value)}
              className="flex-1 rounded-xl border-border/50 bg-background/50"
            />
          </div>
        </div>
      </div>

      {/* Prompt Input (optional) */}
      <div className="relative">
        <Textarea
          placeholder="Optional: Describe the desired motion or scene..."
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={isGenerating}
          className="min-h-[60px] resize-none pr-28 text-base rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60 disabled:opacity-50 disabled:cursor-not-allowed"
          rows={2}
        />
        <Button
          size="default"
          className="absolute bottom-3 right-3 rounded-xl bg-primary hover:bg-primary/90 btn-primary-glow transition-all duration-200"
          onClick={onGenerate}
          disabled={!canGenerate}
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

      {/* Settings Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Model selector */}
        <ModelSelect
          value={model}
          onValueChange={onModelChange}
          models={MOTION_CONTROL_MODELS}
          showDescription={true}
          showProvider={true}
        />

        {/* Character Orientation */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Orientation:</span>
          <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
            <button
              onClick={() => onCharacterOrientationChange('video')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded-lg',
                characterOrientation === 'video'
                  ? 'bg-primary text-primary-foreground active-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              Match Video
            </button>
            <button
              onClick={() => onCharacterOrientationChange('image')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded-lg',
                characterOrientation === 'image'
                  ? 'bg-primary text-primary-foreground active-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              Match Image
            </button>
          </div>
        </div>

        {/* Duration Selector */}
        {(() => {
          const modelConfig = getMotionControlModelById(model)
          const allDurations = modelConfig?.durations || [5, 10]
          const maxDuration =
            characterOrientation === 'video'
              ? modelConfig?.maxDurationVideo || 30
              : modelConfig?.maxDurationImage || 10
          const availableDurations = allDurations.filter(
            (d) => d <= maxDuration,
          )

          return (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Duration:</span>
              <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
                {availableDurations.map((d) => (
                  <button
                    key={d}
                    onClick={() => onDurationChange(d)}
                    className={cn(
                      'px-2.5 py-1.5 text-xs font-medium transition-all duration-200 rounded-lg',
                      duration === d
                        ? 'bg-primary text-primary-foreground active-glow'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Status indicators */}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              'flex items-center gap-1',
              hasImage ? 'text-green-500' : 'text-muted-foreground',
            )}
          >
            <ImageIcon className="h-3 w-3" />
            {hasImage ? 'Image ready' : 'Need image'}
          </span>
          <span className="text-border">|</span>
          <span
            className={cn(
              'flex items-center gap-1',
              hasVideo ? 'text-green-500' : 'text-muted-foreground',
            )}
          >
            <Video className="h-3 w-3" />
            {hasVideo ? 'Video ready' : 'Need video'}
          </span>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {characterOrientation === 'video'
            ? 'Match Video: Character orientation follows reference video - best for complex motions (max 30s)'
            : 'Match Image: Character orientation matches source image - best for camera movements (max 10s)'}
        </span>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}
