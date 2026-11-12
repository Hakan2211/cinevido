/**
 * Layer set viewer (image lab → Layers): the composite on the left, the layer
 * list on the right. Layers can be hidden, dragged to a new place, edited one
 * at a time with Seedream 5.5 Edit (stays a cut-out), downloaded, saved to the
 * library on their own, or baked into a new image ("Save as image").
 *
 * Text layers (fal's text recognition) can have their text replaced by the
 * edit model, or be made editable: drawn by us as live text, free to change,
 * and sent to the timeline as a text clip. "To timeline" stacks the visible
 * layers on a project's video lanes as one 2.5D parallax shot.
 */

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bold,
  Clapperboard,
  Italic,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Paintbrush,
  RotateCcw,
  Save,
  Type,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { CameraMove, Layer, LayerSet, LayerView } from '@/lib/layers'
import {
  CAMERA_MOVES,
  layerRect,
  liveTextFromLayer,
  replaceTextPrompt,
  sortedLayers,
} from '@/lib/layers'
import { layerTextSvg } from '@/remotion/layer-text'
import type { LayerTextProps } from '@/remotion/types'
import { Segmented } from '@/components/generate'
import { estimateCost, formatEstimate } from '@/lib/pricing'
import { downloadFile } from '@/lib/download'
import { cn } from '@/lib/utils'
import { DEFAULT_MODELS, EDIT_MODELS } from '@/server/services/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

type Views = Record<number, LayerView>

const SHOWN: LayerView = { visible: true, dx: 0, dy: 0 }

function initialViews(set: LayerSet): Views {
  const saved = set.views ?? {}
  return Object.fromEntries(
    set.layers.map((l) => [l.z, saved[String(l.z)] ?? SHOWN]),
  )
}

const LAYER_EDIT = EDIT_MODELS.find((m) => m.id === DEFAULT_MODELS.layerEdit)
// one reference (the layer), output size unknown → the 2K default rate
const LAYER_EDIT_COST = formatEstimate(
  estimateCost(LAYER_EDIT?.pricing, { inputImages: 1 }),
)

/** The layers stacked by CSS — used by the viewer and by result cards */
export function LayerComposite({
  set,
  views,
  selected,
  onSelect,
  onMove,
  className,
}: {
  set: LayerSet
  views?: Views
  selected?: number | null
  onSelect?: (z: number) => void
  /** drag deltas in base-image pixels; omit for a static preview */
  onMove?: (z: number, dx: number, dy: number) => void
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ z: number; x: number; y: number } | null>(null)

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const el = box.current
    if (!d || !el || !onMove) return
    const scale = set.width / el.clientWidth
    onMove(d.z, (e.clientX - d.x) * scale, (e.clientY - d.y) * scale)
    drag.current = { ...d, x: e.clientX, y: e.clientY }
  }

  return (
    <div
      ref={box}
      className={cn('relative w-full', className)}
      style={{ aspectRatio: `${set.width} / ${set.height}` }}
      onPointerMove={onPointerMove}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    >
      {sortedLayers(set).map((layer) => {
        const view = views?.[layer.z] ?? SHOWN
        if (!view.visible) return null
        const r = layerRect(set, layer, view)
        const movable = !!onMove && layer.z !== 0
        const common = {
          onPointerDown: (e: React.PointerEvent) => {
            if (!onSelect) return
            e.stopPropagation()
            onSelect(layer.z)
            if (movable) {
              ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
              drag.current = { z: layer.z, x: e.clientX, y: e.clientY }
            }
          },
          className: cn(
            'absolute select-none object-contain',
            movable && 'cursor-move',
            selected === layer.z &&
              layer.z !== 0 &&
              'outline outline-2 outline-primary',
          ),
          style: {
            left: `${r.left}%`,
            top: `${r.top}%`,
            width: `${r.width}%`,
            height: `${r.height}%`,
          },
        }
        if (layer.live && layer.box) {
          const [l, t, rr, b] = layer.box
          return (
            <div
              key={layer.z}
              {...common}
              // layerTextSvg escapes every value it writes
              dangerouslySetInnerHTML={{
                __html: layerTextSvg(layer.live, rr - l, b - t),
              }}
            />
          )
        }
        return (
          <img
            key={layer.z}
            src={layer.url}
            alt={layer.name ?? (layer.z === 0 ? 'Base' : `Layer ${layer.z}`)}
            draggable={false}
            {...common}
          />
        )
      })}
    </div>
  )
}

export function LayerStack({
  assetId,
  onClose,
}: {
  assetId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['layerSet', assetId],
    queryFn: async () => {
      const { getLayerSetFn } = await import('@/server/layers.server')
      return getLayerSetFn({ data: { assetId } })
    },
  })
  const set = data?.set
  const [views, setViews] = useState<Views>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editJob, setEditJob] = useState<{ jobId: string; z: number } | null>(
    null,
  )
  /** a text layer whose words are being replaced (paid) or edited live (free) */
  const [textEdit, setTextEdit] = useState<{
    z: number
    mode: 'replace' | 'live'
    value: LayerTextProps
  } | null>(null)
  const [timelineOpen, setTimelineOpen] = useState(false)

  useEffect(() => {
    if (set) setViews(initialViews(set))
    // re-init only when another set opens, not after a layer edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id])

  const view = (z: number) => views[z] ?? SHOWN
  const setView = (z: number, next: Partial<LayerView>) =>
    setViews((v) => ({ ...v, [z]: { ...(v[z] ?? SHOWN), ...next } }))
  const moved = Object.values(views).some(
    (v) => !v.visible || v.dx !== 0 || v.dy !== 0,
  )

  // ---- edit one layer ----
  const startEdit = useMutation({
    mutationFn: async ({ layer, prompt }: { layer: Layer; prompt: string }) => {
      const { editImageFn } = await import('@/server/edit.server')
      return editImageFn({
        data: {
          imageUrls: [layer.url],
          prompt: prompt.trim(),
          model: DEFAULT_MODELS.layerEdit,
          sourceAssetIds: [assetId],
          // separated layers stay cut-outs; the base is a full image
          background: layer.z === 0 ? undefined : 'transparent',
        },
      })
    },
    onSuccess: (res, { layer }) => {
      setEditJob({ jobId: res.jobId, z: layer.z })
      setEditing(null)
      setEditPrompt('')
      setTextEdit(null)
    },
    onError: (err) => toast.error(err.message),
  })

  const { data: editStatus } = useQuery({
    queryKey: ['layerEditJob', editJob?.jobId],
    queryFn: async () => {
      const { getEditJobStatusFn } = await import('@/server/edit.server')
      return getEditJobStatusFn({ data: { jobId: editJob!.jobId } })
    },
    enabled: !!editJob,
    refetchInterval: (q) =>
      q.state.data?.status === 'completed' || q.state.data?.status === 'failed'
        ? false
        : 2500,
  })

  useEffect(() => {
    if (!editJob || !editStatus) return
    if (editStatus.status === 'failed') {
      toast.error(editStatus.error || 'The layer edit failed')
      setEditJob(null)
      return
    }
    if (editStatus.status !== 'completed') return
    const { jobId, z } = editJob
    setEditJob(null)
    ;(async () => {
      try {
        const { applyLayerEditFn } = await import('@/server/layers.server')
        const res = await applyLayerEditFn({
          data: { assetId, z, editJobId: jobId },
        })
        queryClient.setQueryData(['layerSet', assetId], (old: typeof data) =>
          old ? { ...old, set: res.set } : old,
        )
        queryClient.invalidateQueries({ queryKey: ['images'] })
        queryClient.invalidateQueries({ queryKey: ['falCredits'] })
        toast.success('Layer updated')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not apply edit')
      }
    })()
  }, [editStatus, editJob, assetId, queryClient, data])

  // ---- save ----
  const compose = useMutation({
    mutationFn: async () => {
      const { composeLayersFn } = await import('@/server/layers.server')
      return composeLayersFn({
        data: {
          assetId,
          views: Object.entries(views).map(([z, v]) => ({
            z: Number(z),
            ...v,
          })),
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
      queryClient.invalidateQueries({ queryKey: ['layerSet', assetId] })
      toast.success('Saved to your library')
    },
    onError: (err) => toast.error(err.message),
  })

  const saveLayer = useMutation({
    mutationFn: async (z: number) => {
      const { saveLayerFn } = await import('@/server/layers.server')
      return saveLayerFn({ data: { assetId, z } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
      toast.success('Layer saved to your library')
    },
    onError: (err) => toast.error(err.message),
  })

  const liveText = useMutation({
    mutationFn: async (args: { z: number; live: LayerTextProps | null }) => {
      const { setLayerLiveTextFn } = await import('@/server/layers.server')
      return setLayerLiveTextFn({ data: { assetId, ...args } })
    },
    onSuccess: (res, { live }) => {
      queryClient.setQueryData(['layerSet', assetId], (old: typeof data) =>
        old ? { ...old, set: res.set } : old,
      )
      queryClient.invalidateQueries({ queryKey: ['images'] })
      setTextEdit(null)
      toast.success(live ? 'Text updated' : 'Back to the original pixels')
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) {
    return <Skeleton className="aspect-video w-full rounded-xl" />
  }
  if (error || !set) {
    return (
      <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : 'Layer set not found'}
        <Button variant="ghost" size="sm" className="ml-3" onClick={onClose}>
          Back
        </Button>
      </div>
    )
  }

  // top of the stack first, like an editor's layer panel
  const list = sortedLayers(set).reverse()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
          All images
        </Button>
        <div className="flex items-center gap-2">
          {moved && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setViews(
                  Object.fromEntries(set.layers.map((l) => [l.z, SHOWN])),
                )
              }
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTimelineOpen((o) => !o)}
          >
            <Clapperboard className="h-4 w-4" />
            To timeline
          </Button>
          <Button
            size="sm"
            onClick={() => compose.mutate()}
            disabled={compose.isPending}
          >
            {compose.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save as image
          </Button>
        </div>
      </div>

      {timelineOpen && (
        <SendToTimeline
          assetId={assetId}
          defaultProjectId={data?.projectId ?? null}
          views={views}
          layerCount={
            set.layers.filter((l) => (views[l.z] ?? SHOWN).visible).length
          }
          onDone={() => setTimelineOpen(false)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="bg-checker overflow-hidden rounded-xl border border-border">
          <LayerComposite
            set={set}
            views={views}
            selected={selected}
            onSelect={setSelected}
            onMove={(z, dx, dy) =>
              setViews((v) => {
                const cur = v[z] ?? SHOWN
                return {
                  ...v,
                  [z]: { ...cur, dx: cur.dx + dx, dy: cur.dy + dy },
                }
              })
            }
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {set.layers.length} layers · drag a layer to move it · nothing is
            billed until you edit one
          </p>
          <ul className="space-y-1.5">
            {list.map((layer) => {
              const v = view(layer.z)
              const isEditing = editing === layer.z
              const busy = editJob?.z === layer.z
              return (
                <li
                  key={layer.z}
                  className={cn(
                    'rounded-xl border px-3 py-2',
                    selected === layer.z
                      ? 'border-primary/60 bg-card'
                      : 'border-border',
                  )}
                  onClick={() => setSelected(layer.z)}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-checker relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border">
                      <img
                        src={layer.url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                      {busy && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {(layer.text || layer.live) && (
                          <Type className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        {layer.z === 0
                          ? 'Base'
                          : (layer.name ?? `Layer ${layer.z}`)}
                      </p>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        title={layer.text?.text ?? layer.description}
                      >
                        {layer.live
                          ? `“${layer.live.text.replace(/\n/g, ' ')}” · editable`
                          : layer.text?.text
                            ? `“${layer.text.text}”`
                            : (layer.description ??
                              (layer.z === 0
                                ? 'Background with the layers removed'
                                : ''))}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={v.visible ? 'Hide layer' : 'Show layer'}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        setView(layer.z, { visible: !v.visible })
                      }}
                    >
                      {v.visible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {selected === layer.z &&
                    !isEditing &&
                    textEdit?.z !== layer.z &&
                    layer.z !== 0 &&
                    (layer.live || layer.text?.text) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {layer.live ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setTextEdit({
                                  z: layer.z,
                                  mode: 'live',
                                  value: { ...layer.live! },
                                })
                              }}
                            >
                              <Type className="h-3.5 w-3.5" />
                              Edit text
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={liveText.isPending}
                              onClick={(e) => {
                                e.stopPropagation()
                                liveText.mutate({ z: layer.z, live: null })
                              }}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              Original pixels
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!!editJob}
                              onClick={(e) => {
                                e.stopPropagation()
                                const live = liveTextFromLayer(layer)
                                if (live)
                                  setTextEdit({
                                    z: layer.z,
                                    mode: 'replace',
                                    value: live,
                                  })
                              }}
                            >
                              <Paintbrush className="h-3.5 w-3.5" />
                              Replace text
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                const live = liveTextFromLayer(layer)
                                if (live)
                                  setTextEdit({
                                    z: layer.z,
                                    mode: 'live',
                                    value: live,
                                  })
                              }}
                            >
                              <Type className="h-3.5 w-3.5" />
                              Make editable
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                  {textEdit?.z === layer.z && (
                    <TextLayerForm
                      layer={layer}
                      edit={textEdit}
                      onChange={(value) => setTextEdit({ ...textEdit, value })}
                      onCancel={() => setTextEdit(null)}
                      busy={startEdit.isPending || liveText.isPending}
                      onSubmit={() => {
                        if (textEdit.mode === 'live') {
                          liveText.mutate({ z: layer.z, live: textEdit.value })
                        } else {
                          const before = liveTextFromLayer(layer)?.text ?? ''
                          startEdit.mutate({
                            layer,
                            prompt: replaceTextPrompt(
                              before,
                              textEdit.value.text,
                            ),
                          })
                        }
                      }}
                    />
                  )}

                  {selected === layer.z &&
                    !isEditing &&
                    textEdit?.z !== layer.z && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!!editJob}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditing(layer.z)
                          }}
                        >
                          <Paintbrush className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={saveLayer.isPending}
                          onClick={(e) => {
                            e.stopPropagation()
                            saveLayer.mutate(layer.z)
                          }}
                        >
                          <ImagePlus className="h-3.5 w-3.5" />
                          To library
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadFile(
                              layer.url,
                              `${(layer.name ?? `layer-${layer.z}`).replace(/[^\w-]+/g, '-').toLowerCase()}.png`,
                              { onError: (err) => toast.error(err.message) },
                            )
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          PNG
                        </Button>
                      </div>
                    )}

                  {isEditing && (
                    <div
                      className="mt-2 space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        autoFocus
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        maxLength={2000}
                        rows={2}
                        placeholder={
                          layer.text
                            ? 'e.g. change the text to “EVENING BLEND”'
                            : 'e.g. make it red leather'
                        }
                        className="block w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-muted-foreground/60"
                      />
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={!editPrompt.trim() || startEdit.isPending}
                          onClick={() =>
                            startEdit.mutate({ layer, prompt: editPrompt })
                          }
                        >
                          {startEdit.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Paintbrush className="h-3.5 w-3.5" />
                          )}
                          Edit layer
                          {LAYER_EDIT_COST && (
                            <span className="font-normal tabular-nums opacity-80">
                              · {LAYER_EDIT_COST}
                            </span>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {LAYER_EDIT?.name} Edit, billed to your fal account
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

/**
 * Replace text (re-rendered by the edit model, paid) or edit it live (drawn
 * by us, free): the words, and for live text its colour, weight and slant.
 */
function TextLayerForm({
  layer,
  edit,
  onChange,
  onSubmit,
  onCancel,
  busy,
}: {
  layer: Layer
  edit: { mode: 'replace' | 'live'; value: LayerTextProps }
  onChange: (value: LayerTextProps) => void
  onSubmit: () => void
  onCancel: () => void
  busy: boolean
}) {
  const v = edit.value
  const live = edit.mode === 'live'
  const original = liveTextFromLayer(layer)?.text ?? ''
  const unchanged = !live && v.text.trim() === original.trim()
  return (
    <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <textarea
        autoFocus
        value={v.text}
        onChange={(e) => onChange({ ...v, text: e.target.value })}
        maxLength={500}
        rows={Math.min(4, Math.max(2, v.text.split('\n').length))}
        className="block w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-muted-foreground/60"
      />
      {live && (
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            aria-label="Text colour"
            value={/^#[0-9a-f]{6}$/i.test(v.color ?? '') ? v.color : '#ffffff'}
            onChange={(e) => onChange({ ...v, color: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded-md border border-border bg-background p-0.5"
          />
          <Button
            type="button"
            size="sm"
            variant={v.bold ? 'secondary' : 'ghost'}
            aria-pressed={!!v.bold}
            aria-label="Bold"
            onClick={() => onChange({ ...v, bold: !v.bold })}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={v.italic ? 'secondary' : 'ghost'}
            aria-pressed={!!v.italic}
            aria-label="Italic"
            onClick={() => onChange({ ...v, italic: !v.italic })}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <span
            className="min-w-0 truncate text-xs text-muted-foreground"
            title={v.fontFamily}
          >
            {v.fontFamily ?? 'Sans serif'}
          </span>
        </div>
      )}
      <div className="flex gap-1.5">
        <Button
          size="sm"
          className="flex-1"
          disabled={!v.text.trim() || busy || unchanged}
          onClick={onSubmit}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : live ? (
            <Type className="h-3.5 w-3.5" />
          ) : (
            <Paintbrush className="h-3.5 w-3.5" />
          )}
          {live ? 'Save text · free' : 'Replace text'}
          {!live && LAYER_EDIT_COST && (
            <span className="font-normal tabular-nums opacity-80">
              · {LAYER_EDIT_COST}
            </span>
          )}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {live
          ? 'Drawn as live text where the words sat. Stays editable on the timeline as a text clip.'
          : `${LAYER_EDIT?.name} Edit re-draws the words in the same type, billed to your fal account`}
      </p>
    </div>
  )
}

const LENGTHS = [3, 5, 8, 10] as const

/** "To timeline": pick a project, a length and a camera move; free */
function SendToTimeline({
  assetId,
  defaultProjectId,
  views,
  layerCount,
  onDone,
}: {
  assetId: string
  defaultProjectId: string | null
  views: Views
  layerCount: number
  onDone: () => void
}) {
  const navigate = useNavigate()
  const { data: projects } = useQuery({
    queryKey: ['projects', 'picker'],
    queryFn: async () => {
      const { listProjectsFn } = await import('@/server/project.server')
      return (await listProjectsFn({ data: { limit: 50 } })).projects
    },
  })
  const [projectId, setProjectId] = useState<string>('')
  const [length, setLength] = useState<number>(5)
  const [move, setMove] = useState<CameraMove>('push-in')
  const chosen = projectId || defaultProjectId || projects?.[0]?.id || ''

  const send = useMutation({
    mutationFn: async () => {
      const { sendLayersToTimelineFn } = await import('@/server/layers.server')
      return sendLayersToTimelineFn({
        data: {
          assetId,
          projectId: chosen,
          durationSec: length,
          move,
          views: Object.entries(views).map(([z, v]) => ({
            z: Number(z),
            ...v,
          })),
        },
      })
    },
    onSuccess: (res) => {
      onDone()
      toast.success(`${res.clips} layers added to ${res.projectName}`, {
        action: {
          label: 'Open',
          onClick: () =>
            navigate({
              to: '/projects/$projectId',
              params: { projectId: res.projectId },
            }),
        },
      })
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
      <label className="block min-w-0">
        <span className="mb-2 block text-sm font-medium">Project</span>
        <select
          value={chosen}
          onChange={(e) => setProjectId(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
        >
          {!projects?.length && <option value="">No projects yet</option>}
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="mb-2 block text-sm font-medium">Length</span>
        <Segmented
          size="sm"
          options={LENGTHS.map((l) => ({ value: l, label: `${l}s` }))}
          value={length}
          onChange={setLength}
        />
      </div>
      <div>
        <span className="mb-2 block text-sm font-medium">Camera</span>
        <Segmented
          size="sm"
          options={CAMERA_MOVES.map((m) => ({ value: m.id, label: m.label }))}
          value={move}
          onChange={setMove}
        />
      </div>
      <Button
        onClick={() => send.mutate()}
        disabled={!chosen || send.isPending || layerCount === 0}
      >
        {send.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Clapperboard className="h-4 w-4" />
        )}
        Add {layerCount} layers · free
      </Button>
      <p className="text-xs text-muted-foreground md:col-span-4">
        Each visible layer goes on its own video lane (V1 is the base), editable
        text on the overlay lane, all at the end of the cut. Nearer layers move
        more than the base, so the still plays as a shot with depth — no video
        model, no cost.
      </p>
    </div>
  )
}
