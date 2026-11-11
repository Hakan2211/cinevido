/**
 * VideoPickerDialog — choose a clip from the video library, upload one, or
 * paste a URL. Used for motion references (and anywhere a lab needs a video).
 */

import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2, Upload, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface PickedVideo {
  id?: string
  url: string
  prompt: string | null
  durationSeconds?: number | null
}

const ACCEPTED = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
]

export function VideoPickerDialog({
  open,
  onOpenChange,
  title,
  onPick,
  onUpload,
  uploading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onPick: (video: PickedVideo) => void
  /** Upload a file; the caller picks the uploaded clip when it lands */
  onUpload?: (file: File) => void
  uploading?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['videos', 'picker'],
    queryFn: async () => {
      const { listUserVideosFn } = await import('@/server/video.server')
      return listUserVideosFn({ data: { limit: 60 } })
    },
    enabled: open,
  })
  const videos: Array<PickedVideo & { id: string }> = data?.videos ?? []

  const urlValid = /^https?:\/\/\S+$/.test(url.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {onUpload && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED.join(',')}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onUpload(file)
                  e.target.value = ''
                }}
              />
              <Button
                variant="secondary"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? 'Uploading…' : 'Upload a video'}
              </Button>
            </>
          )}
          <div className="flex min-w-60 flex-1 gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="…or paste a video URL"
            />
            <Button
              variant="secondary"
              disabled={!urlValid}
              onClick={() => {
                onPick({ url: url.trim(), prompt: null })
                setUrl('')
              }}
            >
              Use
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          MP4, WebM, MOV or AVI · up to 100 MB
        </p>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : videos.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-sm text-muted-foreground">
            <Video className="mb-3 h-10 w-10 text-muted-foreground/50" />
            No videos in your library yet.
          </div>
        ) : (
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
            {videos.map((video) => (
              <button
                key={video.id}
                type="button"
                className="group relative aspect-video overflow-hidden rounded-xl border border-border bg-muted"
                onClick={() => onPick(video)}
              >
                <video
                  src={video.url}
                  className="absolute inset-0 h-full w-full object-cover"
                  muted
                  playsInline
                  onMouseEnter={(e) =>
                    void e.currentTarget.play().catch(() => {})
                  }
                  onMouseLeave={(e) => {
                    e.currentTarget.pause()
                    e.currentTarget.currentTime = 0
                  }}
                />
                {video.durationSeconds && (
                  <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] tabular-nums text-white">
                    {Math.round(video.durationSeconds)}s
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Check className="h-7 w-7 text-white" />
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
