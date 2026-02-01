/**
 * Bulk Actions Bar Component
 *
 * Floating action bar that appears when projects are selected.
 * Provides bulk delete and move to folder actions.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderInput, Trash2, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { cn } from '@/lib/utils'

interface BulkActionsBarProps {
  selectedIds: Set<string>
  onClearSelection: () => void
  onActionComplete?: () => void
}

interface FolderData {
  id: string
  name: string
  color: string | null
  projectCount: number
}

export function BulkActionsBar({
  selectedIds,
  onClearSelection,
  onActionComplete,
}: BulkActionsBarProps) {
  const queryClient = useQueryClient()
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isMoveOpen, setIsMoveOpen] = useState(false)

  const selectedCount = selectedIds.size

  // Fetch folders for move dialog
  const { data: folders = [] } = useQuery<FolderData[]>({
    queryKey: ['folders'],
    queryFn: async () => {
      const { listFoldersFn } = await import('../../server/project.server')
      return listFoldersFn({})
    },
    enabled: isMoveOpen,
  })

  // Bulk delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (projectIds: string[]) => {
      const { bulkDeleteProjectsFn } =
        await import('../../server/project.server')
      return bulkDeleteProjectsFn({ data: { projectIds } } as never)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      onClearSelection()
      onActionComplete?.()
      setIsDeleteOpen(false)
    },
  })

  // Bulk move mutation
  const moveMutation = useMutation({
    mutationFn: async ({
      projectIds,
      folderId,
    }: {
      projectIds: string[]
      folderId: string | null
    }) => {
      const { bulkMoveProjectsFn } = await import('../../server/project.server')
      return bulkMoveProjectsFn({ data: { projectIds, folderId } } as never)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      onClearSelection()
      onActionComplete?.()
      setIsMoveOpen(false)
    },
  })

  const handleDelete = () => {
    deleteMutation.mutate(Array.from(selectedIds))
  }

  const handleMove = (folderId: string | null) => {
    moveMutation.mutate({
      projectIds: Array.from(selectedIds),
      folderId,
    })
  }

  if (selectedCount === 0) {
    return null
  }

  return (
    <>
      {/* Floating Bar */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 z-50 -translate-x-1/2',
          'flex items-center gap-3 rounded-full border bg-background px-4 py-2 shadow-lg',
          'animate-in fade-in slide-in-from-bottom-4',
        )}
      >
        {/* Selection Count */}
        <span className="text-sm font-medium">{selectedCount} selected</span>

        {/* Divider */}
        <div className="h-4 w-px bg-border" />

        {/* Move to Folder */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMoveOpen(true)}
          disabled={moveMutation.isPending}
        >
          <FolderInput className="mr-2 h-4 w-4" />
          Move
        </Button>

        {/* Delete */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDeleteOpen(true)}
          disabled={deleteMutation.isPending}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>

        {/* Clear Selection */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Move to Folder Dialog */}
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {/* No Folder option */}
            <button
              onClick={() => handleMove(null)}
              disabled={moveMutation.isPending}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
            >
              <div className="h-4 w-4 rounded-sm border border-dashed" />
              <span>No Folder</span>
            </button>

            {/* Folder options */}
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleMove(folder.id)}
                disabled={moveMutation.isPending}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
              >
                <div
                  className="h-4 w-4 rounded-sm"
                  style={{ backgroundColor: folder.color || '#6b7280' }}
                />
                <span className="flex-1">{folder.name}</span>
                <span className="text-xs text-muted-foreground">
                  {folder.projectCount} projects
                </span>
              </button>
            ))}

            {folders.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No folders yet. Create a folder first.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Projects?"
        description={`This will permanently delete ${selectedCount} project${selectedCount > 1 ? 's' : ''} and all their contents. This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </>
  )
}
