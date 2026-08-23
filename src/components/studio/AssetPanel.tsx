/**
 * Asset Panel Component
 *
 * Shows user's assets and provides generation controls.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Image,
  LayoutGrid,
  List,
  Loader2,
  Music,
  Plus,
  Search,
  Video,
} from 'lucide-react'
// NOTE: Server functions are dynamically imported in mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions
import { Button } from '../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { KIND, probeDurationSeconds } from './timeline/shared'
import {
  allClips,
  appendClip,
  clipKindForAsset,
  newId,
  trackKindForAsset,
} from '../../remotion/types'
import type { ProjectManifest } from '../../remotion/types'

interface Asset {
  id: string
  type: string
  url: string
  filename: string
  prompt: string | null
  metadata: unknown
  durationSeconds: number | null
  createdAt: Date
}

interface AssetPanelProps {
  projectId: string
  assets: Array<Asset>
  manifest: ProjectManifest
  onManifestChange: (manifest: ProjectManifest) => void
  collapsed: boolean
  onToggleCollapse: () => void
  /** Frames per second of the sequence a take is dropped into */
  fps?: number
  /** Display mode: 'panel' for sidebar, 'fullscreen' for mobile */
  mode?: 'panel' | 'fullscreen'
}

/**
 * The library's type chips. 'audio' deliberately covers both voice and music —
 * from the rail's point of view they are both "a sound", and the lane they land
 * on is decided by the asset's own type, not by this filter.
 */
type TypeFilter = 'all' | 'video' | 'image' | 'audio'

const TYPE_FILTERS: Array<{ id: TypeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'image', label: 'Image' },
]

function matchesTypeFilter(assetType: string, filter: TypeFilter): boolean {
  if (filter === 'audio') return assetType === 'audio' || assetType === 'music'
  return assetType === filter
}

export function AssetPanel({
  projectId,
  assets,
  manifest,
  onManifestChange,
  collapsed,
  onToggleCollapse,
  fps = 30,
  mode = 'panel',
}: AssetPanelProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'library' | 'generate'>('library')
  const [generateTab, setGenerateTab] = useState<'image' | 'video' | 'audio'>(
    'image',
  )

  // Library rail state
  const [search, setSearch] = useState('')
  const [onlyUncut, setOnlyUncut] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  /**
   * How many times each asset is in the cut. Deliberately ONE list rather than
   * "footage" beside "used in the cut": the same take living in two panels
   * means searching twice. Being in the sequence is state on the card.
   */
  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { clip } of allClips(manifest)) {
      if (!clip.assetId) continue
      counts.set(clip.assetId, (counts.get(clip.assetId) ?? 0) + 1)
    }
    return counts
  }, [manifest])

  /**
   * Tracks written in the Music lab belong to the user, not to a project, so
   * the panel shows the whole music library here and adopts a track into this
   * project the moment it is used. Without this a score could be made but
   * never cut in.
   */
  const { data: libraryMusic = [] } = useQuery({
    queryKey: ['music', 'library'],
    queryFn: async () => {
      const { listUserMusicFn } = await import('../../server/music.server')
      return listUserMusicFn({ data: { limit: 50 } })
    },
  })

  /** Click a take and it lands at the end of its own lane. */
  const addToTimeline = async (asset: Asset) => {
    // adopt a library track into this project before it joins the cut
    if (asset.type === 'music' && !assets.some((a) => a.id === asset.id)) {
      try {
        const { attachTrackToProjectFn } =
          await import('../../server/music.server')
        await attachTrackToProjectFn({
          data: { trackId: asset.id, projectId },
        })
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      } catch (error) {
        console.error('Failed to attach track to project:', error)
      }
    }

    const seconds =
      asset.durationSeconds ??
      (await probeDurationSeconds(asset.url, clipKindForAsset(asset.type)))

    const { manifest: next } = appendClip(
      manifest,
      trackKindForAsset(asset.type),
      {
        id: newId(),
        kind: clipKindForAsset(asset.type),
        assetId: asset.id,
        url: asset.url,
        label: asset.filename,
        durationFrames: Math.max(1, Math.round(seconds * fps)),
        sourceInFrame: 0,
        transitionFrames: 0,
        gain: 1,
      },
    )
    onManifestChange(next)
  }

  // Generation form state
  const [imagePrompt, setImagePrompt] = useState('')
  const [videoPrompt, setVideoPrompt] = useState('')
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [audioText, setAudioText] = useState('')

  // Mutations
  const createImageMutation = useMutation({
    mutationFn: async (input: {
      data: { prompt: string; projectId: string }
    }) => {
      const { createImageJobFn } =
        await import('../../server/generation.server')
      return createImageJobFn(input as never)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setImagePrompt('')
    },
  })

  const createVideoMutation = useMutation({
    mutationFn: async (input: {
      data: { prompt: string; imageUrl: string; projectId: string }
    }) => {
      const { createVideoJobFn } =
        await import('../../server/generation.server')
      return createVideoJobFn(input as never)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setVideoPrompt('')
      setSelectedImageUrl('')
    },
  })

  const createAudioMutation = useMutation({
    mutationFn: async (input: {
      data: { text: string; voice?: string; projectId: string }
    }) => {
      const { createAudioJobFn } =
        await import('../../server/generation.server')
      return createAudioJobFn(input as never)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setAudioText('')
    },
  })

  const handleGenerateImage = () => {
    if (!imagePrompt.trim()) return
    createImageMutation.mutate({
      data: {
        prompt: imagePrompt,
        projectId,
      },
    })
  }

  const handleGenerateVideo = () => {
    if (!videoPrompt.trim() || !selectedImageUrl) return
    createVideoMutation.mutate({
      data: {
        prompt: videoPrompt,
        imageUrl: selectedImageUrl,
        projectId,
      },
    })
  }

  const handleGenerateAudio = () => {
    if (!audioText.trim()) return
    createAudioMutation.mutate({
      data: {
        text: audioText,
        voice: '21m00Tcm4TlvDq8ikWAM', // Rachel voice
        projectId,
      },
    })
  }

  // The library the rail lists: this project's assets plus every music track
  // the user owns (a lab track has no project until it is used).
  const allAssets: Array<Asset> = [
    ...assets,
    ...libraryMusic
      .filter((track) => !assets.some((a) => a.id === track.id))
      .map((track) => ({
        id: track.id,
        type: 'music',
        url: track.url,
        filename: track.title,
        prompt: track.prompt,
        metadata: null,
        durationSeconds: track.durationSeconds,
        createdAt: new Date(track.createdAt),
      })),
  ]

  // Filter assets by type, honouring the rail's search and "not in cut" filter
  const visible = allAssets.filter((a) => {
    if (onlyUncut && (usage.get(a.id) ?? 0) > 0) return false
    if (typeFilter !== 'all' && !matchesTypeFilter(a.type, typeFilter)) {
      return false
    }
    if (!search.trim()) return true
    const needle = search.toLowerCase()
    return (
      a.filename.toLowerCase().includes(needle) ||
      (a.prompt ?? '').toLowerCase().includes(needle)
    )
  })

  // Collapsed state (only for panel mode)
  if (collapsed && mode === 'panel') {
    return (
      <div className="flex h-full flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="rounded-full p-2 hover:bg-muted"
          title="Expand assets"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-3">
          <Image className="h-5 w-5 text-muted-foreground" />
          <Video className="h-5 w-5 text-muted-foreground" />
          <Music className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-medium">Assets</span>
        {mode === 'panel' && (
          <button
            onClick={onToggleCollapse}
            className="rounded-full p-1 hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'library' | 'generate')}
        className="flex-1 flex flex-col"
      >
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4">
          <TabsTrigger value="library" className="data-[state=active]:bg-muted">
            Library
          </TabsTrigger>
          <TabsTrigger
            value="generate"
            className="data-[state=active]:bg-muted"
          >
            Generate
          </TabsTrigger>
        </TabsList>

        {/* Library Tab */}
        <TabsContent
          value="library"
          className="flex-1 overflow-y-auto p-4 mt-0"
        >
          {allAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Image className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                No assets yet. Generate some using the Generate tab!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search, then the filter row: one flat library, not four
                  stacked type sections. Type and "Uncut" are orthogonal, so
                  Uncut sits apart from the exclusive type chips. */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search media…"
                    className="w-full rounded border bg-background py-1 pr-2 pl-7 text-xs"
                  />
                </div>
                <div className="flex rounded border">
                  <button
                    type="button"
                    onClick={() => setView('grid')}
                    title="Grid view"
                    className={`rounded-l p-1 ${
                      view === 'grid'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    title="List view"
                    className={`rounded-r p-1 ${
                      view === 'list'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {TYPE_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setTypeFilter(filter.id)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      typeFilter === filter.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
                <span className="mx-0.5 h-4 w-px bg-border" />
                <button
                  type="button"
                  onClick={() => setOnlyUncut((v) => !v)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    onlyUncut
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  title="Show only takes that are not in the cut"
                >
                  Uncut
                </button>
              </div>

              {visible.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Nothing matches that filter.
                </p>
              ) : view === 'grid' ? (
                <div className="grid grid-cols-2 gap-2">
                  {visible.map((asset) =>
                    asset.type === 'image' || asset.type === 'video' ? (
                      <AssetThumbnail
                        key={asset.id}
                        asset={asset}
                        usedCount={usage.get(asset.id) ?? 0}
                        onAdd={() => void addToTimeline(asset)}
                        onUseAsSource={
                          asset.type === 'image'
                            ? () => setSelectedImageUrl(asset.url)
                            : undefined
                        }
                        isSelected={selectedImageUrl === asset.url}
                      />
                    ) : (
                      <AudioTile
                        key={asset.id}
                        asset={asset}
                        usedCount={usage.get(asset.id) ?? 0}
                        onAdd={() => void addToTimeline(asset)}
                      />
                    ),
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {visible.map((asset) => (
                    <AssetRow
                      key={asset.id}
                      asset={asset}
                      usedCount={usage.get(asset.id) ?? 0}
                      onAdd={() => void addToTimeline(asset)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Generate Tab */}
        <TabsContent
          value="generate"
          className="flex-1 overflow-y-auto p-4 mt-0"
        >
          <Tabs
            value={generateTab}
            onValueChange={(v) =>
              setGenerateTab(v as 'image' | 'video' | 'audio')
            }
          >
            <TabsList className="w-full">
              <TabsTrigger value="image" className="flex-1">
                <Image className="h-3 w-3 mr-1" />
                Image
              </TabsTrigger>
              <TabsTrigger value="video" className="flex-1">
                <Video className="h-3 w-3 mr-1" />
                Video
              </TabsTrigger>
              <TabsTrigger value="audio" className="flex-1">
                <Music className="h-3 w-3 mr-1" />
                Audio
              </TabsTrigger>
            </TabsList>

            {/* Image Generation */}
            <TabsContent value="image" className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Prompt</label>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Describe the image you want to generate..."
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleGenerateImage}
                disabled={!imagePrompt.trim() || createImageMutation.isPending}
              >
                {createImageMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Image (~5 credits)
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Video Generation */}
            <TabsContent value="video" className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Source Image</label>
                {selectedImageUrl ? (
                  <div className="relative aspect-video bg-muted rounded overflow-hidden">
                    <img
                      src={selectedImageUrl}
                      alt="Selected"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setSelectedImageUrl('')}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded px-2 py-0.5 text-xs"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="aspect-video bg-muted rounded flex items-center justify-center text-sm text-muted-foreground">
                    Select an image from the Library tab
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Motion Prompt</label>
                <textarea
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="Describe the motion/animation..."
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleGenerateVideo}
                disabled={
                  !videoPrompt.trim() ||
                  !selectedImageUrl ||
                  createVideoMutation.isPending
                }
              >
                {createVideoMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Video (~20 credits)
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Audio Generation */}
            <TabsContent value="audio" className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Script / Text</label>
                <textarea
                  value={audioText}
                  onChange={(e) => setAudioText(e.target.value)}
                  placeholder="Enter the text for voiceover..."
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[100px] resize-none"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleGenerateAudio}
                disabled={!audioText.trim() || createAudioMutation.isPending}
              >
                {createAudioMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Voiceover (~3 credits)
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// =============================================================================
// Sub-components
// =============================================================================

interface AssetThumbnailProps {
  asset: Asset
  /** how many times this take is already in the cut */
  usedCount: number
  /** click: append it to its lane */
  onAdd: () => void
  /** images double as the source frame for image-to-video */
  onUseAsSource?: () => void
  isSelected?: boolean
}

function AssetThumbnail({
  asset,
  usedCount,
  onAdd,
  onUseAsSource,
  isSelected,
}: AssetThumbnailProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/asset-id', asset.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={onAdd}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onAdd()
      }}
      title={`${asset.filename} — click to add to the timeline`}
      className={`relative aspect-square cursor-grab overflow-hidden rounded bg-muted transition-all hover:ring-2 hover:ring-primary ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
    >
      {asset.type === 'image' ? (
        <img
          src={asset.url}
          alt={asset.filename}
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : asset.type === 'video' ? (
        <video src={asset.url} className="h-full w-full object-cover" muted />
      ) : null}

      {usedCount > 0 && (
        <div className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-primary/90 px-1 text-[10px] text-primary-foreground">
          <Check className="h-2.5 w-2.5" />
          {usedCount > 1 ? `×${usedCount}` : ''}
        </div>
      )}

      {onUseAsSource && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onUseAsSource()
          }}
          className="absolute top-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white hover:bg-black/80"
          title="Use as the source image for video generation"
        >
          Source
        </button>
      )}

      {asset.type === 'video' && (
        <div className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] text-white">
          {asset.durationSeconds
            ? `${Math.floor(asset.durationSeconds)}s`
            : 'Video'}
        </div>
      )}
    </div>
  )
}

/** A sound in the grid: no thumbnail to show, so the lane's colour stands in. */
function AudioTile({
  asset,
  usedCount,
  onAdd,
}: {
  asset: Asset
  usedCount: number
  onAdd: () => void
}) {
  const kind = asset.type === 'music' ? KIND.music : KIND.voice
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/asset-id', asset.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={onAdd}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onAdd()
      }}
      title={`${asset.filename} — click to add to the timeline`}
      className="relative flex aspect-square cursor-grab flex-col items-center justify-center gap-1 overflow-hidden rounded p-2 text-center transition-all hover:ring-2 hover:ring-primary"
      style={{ background: kind.tint, border: `1px solid ${kind.accent}44` }}
    >
      <Music className="h-5 w-5" style={{ color: kind.accent }} />
      <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
        {asset.filename}
      </span>
      {asset.durationSeconds != null && (
        <span className="text-[10px] tabular-nums text-muted-foreground/70">
          {Math.floor(asset.durationSeconds)}s
        </span>
      )}
      {usedCount > 0 && <InCutBadge count={usedCount} />}
    </div>
  )
}

/** The list row — one line per take, where a long filename is legible. */
function AssetRow({
  asset,
  usedCount,
  onAdd,
}: {
  asset: Asset
  usedCount: number
  onAdd: () => void
}) {
  const visual = asset.type === 'image' || asset.type === 'video'
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/asset-id', asset.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={onAdd}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onAdd()
      }}
      title={`${asset.filename} — click to add to the timeline`}
      className="flex cursor-grab items-center gap-2 rounded bg-muted/40 p-1.5 text-xs hover:bg-muted"
    >
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
        {asset.type === 'image' ? (
          <img
            src={asset.url}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : asset.type === 'video' ? (
          <video src={asset.url} className="h-full w-full object-cover" muted />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
      <span className="min-w-0 flex-1 truncate">{asset.filename}</span>
      {usedCount > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-primary">
          <Check className="h-3 w-3" />
          {usedCount > 1 ? `×${usedCount}` : ''}
        </span>
      )}
      {asset.durationSeconds != null && !visual && (
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {Math.floor(asset.durationSeconds)}s
        </span>
      )}
    </div>
  )
}

/** The badge the mockup puts on anything already in the sequence. */
function InCutBadge({ count }: { count: number }) {
  return (
    <div className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-primary/90 px-1 text-[10px] text-primary-foreground">
      in cut
      <Check className="h-2.5 w-2.5" />
      {count > 1 ? `×${count}` : ''}
    </div>
  )
}
