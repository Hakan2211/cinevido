/**
 * 3D Models Page
 *
 * Generate 3D models using AI from text prompts or images.
 * Three modes: Text-to-3D, Image-to-3D, and Image-to-World
 */

import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Box } from 'lucide-react'
import type { Model3DMode } from '@/server/services/types'
import {
  Model3DModeToggle,
  TextTo3DPanel,
  ImageTo3DPanel,
  ImageToWorldPanel,
  Model3DGallery,
  Model3DDetailSheet,
} from '@/components/3d-models'
import { listUser3DModelsFn, delete3DModelFn } from '@/server/model3d.fn'

export const Route = createFileRoute('/_app/3d-models')({
  component: ThreeDModelsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    mode: (search.mode as Model3DMode) || 'text-to-3d',
  }),
})

function ThreeDModelsPage() {
  const navigate = useNavigate()
  const { mode: searchMode } = useSearch({ from: '/_app/3d-models' })
  const queryClient = useQueryClient()

  // Mode state
  const [mode, setMode] = useState<Model3DMode>(searchMode || 'text-to-3d')

  // Detail sheet state
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Fetch models count for display
  const { data: modelsData } = useQuery({
    queryKey: ['3d-models'],
    queryFn: () => listUser3DModelsFn({ data: { limit: 50 } }),
  })

  const total = modelsData?.total ?? 0

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => delete3DModelFn({ data: { assetId } }),
    onSuccess: () => {
      toast.success('Model deleted')
      queryClient.invalidateQueries({ queryKey: ['3d-models'] })
    },
    onError: () => {
      toast.error('Failed to delete model')
    },
  })

  // Update URL when mode changes
  const handleModeChange = useCallback(
    (newMode: Model3DMode) => {
      setMode(newMode)
      navigate({
        to: '/3d-models',
        search: { mode: newMode },
        replace: true,
      })
    },
    [navigate],
  )

  // Handle viewing a model's details
  const handleSelectAsset = (assetId: string) => {
    setSelectedAssetId(assetId)
    setDetailOpen(true)
  }

  // Handle delete from detail sheet
  const handleDelete = (assetId: string) => {
    deleteMutation.mutate(assetId)
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col">
      {/* Header with Mode Toggle */}
      <div className="flex items-center justify-between px-2 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Box className="h-8 w-8" />
            3D Models
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total > 0
              ? `${total} model${total !== 1 ? 's' : ''} in your library`
              : 'Create your first 3D model'}
          </p>
        </div>
        <Model3DModeToggle mode={mode} onModeChange={handleModeChange} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-[400px]">
        {/* Gallery Grid */}
        <Model3DGallery mode={mode} onSelectAsset={handleSelectAsset} />
      </div>

      {/* Fixed Bottom Panel - Generation Controls */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 p-4 pb-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/20 p-5">
          {mode === 'text-to-3d' && <TextTo3DPanel />}
          {mode === 'image-to-3d' && <ImageTo3DPanel />}
          {mode === 'image-to-world' && <ImageToWorldPanel />}
        </div>
      </div>

      {/* Detail Sheet */}
      <Model3DDetailSheet
        assetId={selectedAssetId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDelete={handleDelete}
      />
    </div>
  )
}
