/**
 * 3D Lab — meshes from text or images, and explorable worlds from a picture.
 *
 * Same layout as the other labs: the settings panel on the left with tabs
 * Text / Image / World (`?mode=`), the results grid on the right. Each tab's
 * panel owns its form and its Generate button (with the run's cost).
 */

import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Model3DMode } from '@/server/services/types'
import { LabResults, LabShell } from '@/components/generate'
import {
  ImageTo3DPanel,
  ImageToWorldPanel,
  MODEL_3D_TABS,
  Model3DDetailSheet,
  Model3DGallery,
  TextTo3DPanel,
} from '@/components/3d-models'

// NOTE: Server functions are dynamically imported in queryFn/mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions

const MODES: ReadonlyArray<Model3DMode> = [
  'text-to-3d',
  'image-to-3d',
  'image-to-world',
]

export const Route = createFileRoute('/_app/3d-models')({
  component: ThreeDModelsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    mode: MODES.includes(search.mode as Model3DMode)
      ? (search.mode as Model3DMode)
      : ('text-to-3d' as Model3DMode),
  }),
})

function ThreeDModelsPage() {
  const navigate = useNavigate()
  const { mode } = useSearch({ from: '/_app/3d-models' })
  const queryClient = useQueryClient()

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Count for the results header (the gallery fetches its own page per mode)
  const { data: modelsData } = useQuery({
    queryKey: ['3d-models', mode],
    queryFn: async () => {
      const { listUser3DModelsFn } = await import('@/server/model3d.server')
      return listUser3DModelsFn({ data: { limit: 50, mode } })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const { delete3DModelFn } = await import('@/server/model3d.server')
      return delete3DModelFn({ data: { assetId } })
    },
    onSuccess: () => {
      toast.success('Model deleted')
      queryClient.invalidateQueries({ queryKey: ['3d-models'] })
    },
    onError: () => toast.error('Failed to delete model'),
  })

  const tabs = {
    tabs: MODEL_3D_TABS,
    tab: mode,
    onTabChange: (next: Model3DMode) =>
      navigate({ to: '/3d-models', search: { mode: next }, replace: true }),
  }

  return (
    <LabShell>
      {mode === 'text-to-3d' && <TextTo3DPanel {...tabs} />}
      {mode === 'image-to-3d' && <ImageTo3DPanel {...tabs} />}
      {mode === 'image-to-world' && <ImageToWorldPanel {...tabs} />}

      <LabResults
        title={mode === 'image-to-world' ? 'Worlds' : 'Models'}
        count={modelsData?.total}
      >
        <Model3DGallery
          mode={mode}
          onSelectAsset={(assetId) => {
            setSelectedAssetId(assetId)
            setDetailOpen(true)
          }}
        />
      </LabResults>

      <Model3DDetailSheet
        assetId={selectedAssetId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDelete={(assetId) => deleteMutation.mutate(assetId)}
      />
    </LabShell>
  )
}
