/**
 * Library — every image, clip, sound and 3D model the user has, in one grid.
 *
 * Tabs filter by kind (`?kind=`), the grid pages in as you scroll, and a card
 * opens a preview with Download / Open in its lab (and Animate for images).
 * Deleting stays in the labs, where each kind knows what else it touches.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  AudioLines,
  Box,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  Video,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResultCard } from '@/components/generate'
import type { CardAction } from '@/components/generate'
import { downloadFile } from '@/lib/download'
import { cn } from '@/lib/utils'
import type { LibraryItem, LibraryKind } from '@/server/library.server'

const KINDS: Array<{ id: LibraryKind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: '3d', label: '3D' },
]

export const Route = createFileRoute('/_app/library')({
  component: LibraryPage,
  validateSearch: (search: Record<string, unknown>): { kind?: LibraryKind } =>
    KINDS.some((k) => k.id === search.kind && k.id !== 'all')
      ? { kind: search.kind as LibraryKind }
      : {},
})

const TYPE_LABEL: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Voiceover',
  music: 'Music',
  sfx: 'Sound effect',
  '3d': '3D model',
}

const KIND_ICON = {
  image: ImageIcon,
  video: Video,
  audio: AudioLines,
  '3d': Box,
} as const

function itemTitle(item: LibraryItem): string {
  if (item.provider === 'upload') return 'Upload'
  return item.modelName ?? TYPE_LABEL[item.type] ?? 'Creation'
}

function formatSeconds(sec: number): string {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function fileName(item: LibraryItem): string {
  const ext =
    item.url.split('?')[0].split('.').pop()?.slice(0, 5) ||
    (item.kind === 'image' ? 'png' : item.kind === 'video' ? 'mp4' : 'bin')
  return `cinevido-${item.type}-${item.id}.${ext}`
}

/** Where an item's lab lives */
function labLink(item: LibraryItem) {
  switch (item.kind) {
    case 'image':
      return { to: '/images' as const }
    case 'video':
      return { to: '/videos' as const }
    case 'audio':
      return {
        to: '/music' as const,
        search: {
          tab:
            item.type === 'sfx'
              ? ('sfx' as const)
              : item.type === 'audio'
                ? ('voice' as const)
                : ('music' as const),
        },
      }
    case '3d':
      return {
        to: '/3d-models' as const,
        search: { mode: 'text-to-3d' as const },
      }
  }
}

function LibraryPage() {
  const navigate = useNavigate()
  const { kind = 'all' } = Route.useSearch()
  const [open, setOpen] = useState<LibraryItem | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const counts = useQuery({
    queryKey: ['library', 'counts'],
    queryFn: async () => {
      const { getLibraryCountsFn } = await import('@/server/library.server')
      return getLibraryCountsFn()
    },
  })

  const list = useInfiniteQuery({
    queryKey: ['library', kind],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { listLibraryFn } = await import('@/server/library.server')
      return listLibraryFn({ data: { kind, cursor: pageParam, limit: 30 } })
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
  const items = list.data?.pages.flatMap((p) => p.items) ?? []

  // Page in as the sentinel under the grid scrolls into view
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          list.hasNextPage &&
          !list.isFetchingNextPage
        ) {
          void list.fetchNextPage()
        }
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [list.hasNextPage, list.isFetchingNextPage, list.fetchNextPage])

  // One audio element for the whole grid
  useEffect(() => () => audioRef.current?.pause(), [])
  const togglePlay = (item: LibraryItem) => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.onended = () => setPlaying(null)
    }
    const audio = audioRef.current
    if (playing === item.id) {
      audio.pause()
      setPlaying(null)
      return
    }
    audio.src = item.url
    void audio.play().catch(() => setPlaying(null))
    setPlaying(item.id)
  }

  const download = (item: LibraryItem) =>
    downloadFile(item.url, fileName(item), {
      onError: (err) => toast.error(`Download failed: ${err.message}`),
    })

  const animate = (item: LibraryItem) => {
    sessionStorage.setItem(
      'animateImage',
      JSON.stringify({ url: item.url, id: item.id }),
    )
    navigate({ to: '/videos' })
  }

  const actionsFor = (item: LibraryItem): Array<CardAction> => {
    const lab = labLink(item)
    return [
      ...(item.kind === 'image'
        ? [{ label: 'Animate', icon: Play, onClick: () => animate(item) }]
        : []),
      { label: 'Download', icon: Download, onClick: () => void download(item) },
      {
        label: 'Open in lab',
        icon: ExternalLink,
        onClick: () => navigate(lab),
      },
    ]
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you've generated or uploaded, newest first.
          </p>
        </div>
        <nav className="flex items-center gap-1 self-start rounded-xl border border-border bg-card p-1 sm:self-auto">
          {KINDS.map((k) => {
            const n = counts.data?.[k.id]
            return (
              <Link
                key={k.id}
                to="/library"
                search={k.id === 'all' ? {} : { kind: k.id }}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  kind === k.id
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {k.label}
                {n !== undefined && (
                  <span className="text-xs tabular-nums opacity-70">{n}</span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {list.isLoading ? (
        <Grid>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </Grid>
      ) : list.error ? (
        <div className="rounded-xl border border-border p-10 text-center text-sm">
          <p className="text-destructive">Couldn't load your library.</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => void list.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyLibrary kind={kind} />
      ) : (
        <>
          <Grid>
            {items.map((item) => (
              <ResultCard
                key={`${item.kind}-${item.id}`}
                title={itemTitle(item)}
                cost={item.durationSec ? formatSeconds(item.durationSec) : null}
                media={
                  <LibraryMedia
                    item={item}
                    playing={playing === item.id}
                    onTogglePlay={() => togglePlay(item)}
                  />
                }
                onSelect={() =>
                  item.kind === 'audio' ? togglePlay(item) : setOpen(item)
                }
                hoverActions={[
                  {
                    label: 'Download',
                    icon: Download,
                    onClick: () => void download(item),
                  },
                ]}
                menuActions={actionsFor(item)}
              />
            ))}
          </Grid>
          <div ref={sentinel} className="flex justify-center py-8">
            {list.isFetchingNextPage && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
        </>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl">
          {open && (
            <>
              <div className="flex max-h-[70vh] items-center justify-center bg-black">
                {open.kind === 'image' ? (
                  <img
                    src={open.url}
                    alt={open.prompt ?? ''}
                    className="max-h-[70vh] w-auto object-contain"
                  />
                ) : open.kind === 'video' ? (
                  <video
                    src={open.url}
                    controls
                    autoPlay
                    className="max-h-[70vh] w-auto"
                  />
                ) : open.thumbnailUrl ? (
                  <img
                    src={open.thumbnailUrl}
                    alt=""
                    className="max-h-[70vh] w-auto object-contain"
                  />
                ) : (
                  <Box className="m-20 h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <DialogTitle>{itemTitle(open)}</DialogTitle>
                  <span className="text-xs text-muted-foreground">
                    {TYPE_LABEL[open.type]}
                    {open.width && open.height
                      ? ` · ${open.width}×${open.height}`
                      : ''}
                    {open.durationSec
                      ? ` · ${formatSeconds(open.durationSec)}`
                      : ''}
                    {' · '}
                    {formatDistanceToNow(new Date(open.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <DialogDescription className="line-clamp-4 whitespace-pre-line">
                  {open.prompt || 'No prompt'}
                </DialogDescription>
                <div className="flex flex-wrap gap-2 pt-1">
                  {actionsFor(open).map((a) => (
                    <Button
                      key={a.label}
                      variant={a.label === 'Download' ? 'default' : 'secondary'}
                      size="sm"
                      onClick={a.onClick}
                    >
                      <a.icon className="h-4 w-4" />
                      {a.label}
                    </Button>
                  ))}
                  {open.projectId && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: open.projectId }}
                      >
                        Open project
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  )
}

function LibraryMedia({
  item,
  playing,
  onTogglePlay,
}: {
  item: LibraryItem
  playing: boolean
  onTogglePlay: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const Icon = KIND_ICON[item.kind]

  if (item.kind === 'image' || (item.kind === '3d' && item.thumbnailUrl)) {
    return (
      <>
        <img
          src={item.kind === 'image' ? item.url : item.thumbnailUrl!}
          alt={item.prompt ?? ''}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <KindTag item={item} />
      </>
    )
  }
  if (item.kind === 'video') {
    return (
      <>
        <video
          ref={videoRef}
          src={`${item.url}#t=0.1`}
          muted
          loop
          playsInline
          preload="metadata"
          onMouseEnter={() => void videoRef.current?.play().catch(() => {})}
          onMouseLeave={() => {
            const v = videoRef.current
            if (v) {
              v.pause()
              v.currentTime = 0.1
            }
          }}
          className="h-full w-full object-cover"
        />
        <KindTag item={item} />
      </>
    )
  }
  // Audio, or a 3D model without a still
  return (
    <div className="flex h-full w-full flex-col justify-between bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {TYPE_LABEL[item.type]}
      </div>
      <p className="line-clamp-3 text-sm text-foreground/90">
        {item.prompt || 'No prompt'}
      </p>
      {item.kind === 'audio' && (
        <span
          role="presentation"
          onClick={(e) => {
            e.stopPropagation()
            onTogglePlay()
          }}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
            playing
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground group-hover:bg-accent',
          )}
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          )}
        </span>
      )}
    </div>
  )
}

function KindTag({ item }: { item: LibraryItem }) {
  const Icon = KIND_ICON[item.kind]
  return (
    <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">
      <Icon className="h-3 w-3" />
      {TYPE_LABEL[item.type]}
    </span>
  )
}

function EmptyLibrary({ kind }: { kind: LibraryKind }) {
  const lab =
    kind === 'video' ? '/videos' : kind === 'audio' ? '/music' : '/images'
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <p className="font-medium">
        {kind === 'all'
          ? 'Nothing here yet'
          : `No ${KINDS.find((k) => k.id === kind)?.label.toLowerCase()} yet`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        What you make in the labs and the Studio shows up here.
      </p>
      <Button asChild size="sm" className="mt-5">
        <Link to={lab}>Open the lab</Link>
      </Button>
    </div>
  )
}
