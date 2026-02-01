/**
 * Folder Sidebar Component
 *
 * Displays folder list with create/edit/delete functionality.
 * Collapsible on desktop, sheet-based on mobile.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { cn } from '@/lib/utils'

interface FolderSidebarProps {
  selectedFolderId: string | null // null = "All Projects", 'none' = "No Folder"
  onFolderSelect: (folderId: string | null) => void
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

interface FolderData {
  id: string
  name: string
  color: string | null
  projectCount: number
}

const FOLDER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6b7280', // gray
]

export function FolderSidebar({
  selectedFolderId,
  onFolderSelect,
  collapsed = false,
  onCollapsedChange,
}: FolderSidebarProps) {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editFolder, setEditFolder] = useState<FolderData | null>(null)
  const [deleteFolder, setDeleteFolder] = useState<FolderData | null>(null)
  const [folderName, setFolderName] = useState('')
  const [folderColor, setFolderColor] = useState<string | null>(null)

  // Fetch folders
  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const { listFoldersFn } = await import('../../server/project.server')
      return listFoldersFn({})
    },
  })

  // Create folder mutation
  const createMutation = useMutation({
    mutationFn: async (input: { name: string; color?: string }) => {
      const { createFolderFn } = await import('../../server/project.server')
      return createFolderFn({ data: input } as never)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      setIsCreateOpen(false)
      setFolderName('')
      setFolderColor(null)
    },
  })

  // Update folder mutation
  const updateMutation = useMutation({
    mutationFn: async (input: {
      folderId: string
      name?: string
      color?: string | null
    }) => {
      const { updateFolderFn } = await import('../../server/project.server')
      return updateFolderFn({ data: input } as never)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      setEditFolder(null)
      setFolderName('')
      setFolderColor(null)
    },
  })

  // Delete folder mutation
  const deleteMutation = useMutation({
    mutationFn: async (folderId: string) => {
      const { deleteFolderFn } = await import('../../server/project.server')
      return deleteFolderFn({ data: { folderId } } as never)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      // If the deleted folder was selected, go back to all projects
      if (deleteFolder && selectedFolderId === deleteFolder.id) {
        onFolderSelect(null)
      }
      setDeleteFolder(null)
    },
  })

  const handleCreateFolder = () => {
    if (!folderName.trim()) return
    createMutation.mutate({
      name: folderName.trim(),
      ...(folderColor && { color: folderColor }),
    })
  }

  const handleUpdateFolder = () => {
    if (!editFolder || !folderName.trim()) return
    updateMutation.mutate({
      folderId: editFolder.id,
      name: folderName.trim(),
      color: folderColor,
    })
  }

  const openEditDialog = (folder: FolderData) => {
    setEditFolder(folder)
    setFolderName(folder.name)
    setFolderColor(folder.color)
  }

  const handleToggleCollapse = () => {
    onCollapsedChange?.(!collapsed)
  }

  // Total project count across all folders
  const totalProjectCount = folders.reduce((sum, f) => sum + f.projectCount, 0)

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-r bg-muted/30 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleCollapse}
          className="mb-2"
          title="Expand folders"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedFolderId === null ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => onFolderSelect(null)}
          title="All Projects"
        >
          <Folder className="h-4 w-4" />
        </Button>
        {folders.map((folder) => (
          <Button
            key={folder.id}
            variant={selectedFolderId === folder.id ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => onFolderSelect(folder.id)}
            title={folder.name}
          >
            <Folder
              className="h-4 w-4"
              style={{ color: folder.color || undefined }}
            />
          </Button>
        ))}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCreateOpen(true)}
          title="Create folder"
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex w-56 flex-col border-r bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Folders</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsCreateOpen(true)}
            title="Create folder"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          {onCollapsedChange && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleToggleCollapse}
              title="Collapse"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Folder List */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* All Projects */}
        <button
          onClick={() => onFolderSelect(null)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
            selectedFolderId === null
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-muted',
          )}
        >
          <Folder className="h-4 w-4" />
          <span className="flex-1 text-left">All Projects</span>
          <span className="text-xs text-muted-foreground">
            {totalProjectCount}
          </span>
        </button>

        {/* No Folder */}
        <button
          onClick={() => onFolderSelect('none')}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
            selectedFolderId === 'none'
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-muted',
          )}
        >
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-left text-muted-foreground">
            No Folder
          </span>
        </button>

        {/* Folders */}
        {isLoading ? (
          <div className="space-y-1 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={cn(
                  'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  selectedFolderId === folder.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted',
                )}
              >
                <button
                  onClick={() => onFolderSelect(folder.id)}
                  className="flex flex-1 items-center gap-2"
                >
                  <Folder
                    className="h-4 w-4"
                    style={{ color: folder.color || undefined }}
                  />
                  <span className="flex-1 truncate text-left">
                    {folder.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {folder.projectCount}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(folder)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteFolder(folder)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Folder Dialog */}
      <Dialog
        open={isCreateOpen || !!editFolder}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false)
            setEditFolder(null)
            setFolderName('')
            setFolderColor(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editFolder ? 'Edit Folder' : 'Create Folder'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                placeholder="My Folder"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    editFolder ? handleUpdateFolder() : handleCreateFolder()
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Color (optional)</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFolderColor(null)}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 bg-muted',
                    folderColor === null
                      ? 'border-primary'
                      : 'border-transparent',
                  )}
                  title="No color"
                />
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setFolderColor(color)}
                    className={cn(
                      'h-6 w-6 rounded-full border-2',
                      folderColor === color
                        ? 'border-primary'
                        : 'border-transparent',
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={editFolder ? handleUpdateFolder : handleCreateFolder}
              disabled={
                !folderName.trim() ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editFolder
                  ? 'Save Changes'
                  : 'Create Folder'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteFolder}
        onOpenChange={(open) => !open && setDeleteFolder(null)}
        title="Delete Folder?"
        description={`This will delete the folder "${deleteFolder?.name}". Projects in this folder will be moved to "No Folder".`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => deleteFolder && deleteMutation.mutate(deleteFolder.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
