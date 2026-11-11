/**
 * Projects: every production, in the same cards as Home's "Recent
 * projects" (16:9 thumbnail, name, last edit, status chip). Folders on the
 * left, search / status / sort above, bulk select for move and delete.
 */

import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Check,
  CheckSquare,
  Film,
  Folder,
  MoreHorizontal,
  Plus,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { Sheet, SheetContent, SheetTrigger } from '../../../components/ui/sheet'
import {
  ProjectSearchBar,
  FolderSidebar,
  BulkActionsBar,
} from '../../../components/projects'
import type {
  ProjectStatus,
  SortBy,
  SortOrder,
} from '../../../components/projects'
import { cn } from '@/lib/utils'

// Search params schema
interface ProjectsSearch {
  q?: string
  status?: ProjectStatus
  folder?: string | null
  sort?: SortBy
  order?: SortOrder
}

export const Route = createFileRoute('/_app/projects/')({
  component: ProjectsPage,
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    status: ['all', 'draft', 'rendering', 'completed', 'failed'].includes(
      search.status as string,
    )
      ? (search.status as ProjectStatus)
      : undefined,
    folder: typeof search.folder === 'string' ? search.folder : undefined,
    sort: ['updatedAt', 'createdAt', 'name'].includes(search.sort as string)
      ? (search.sort as SortBy)
      : undefined,
    order: ['asc', 'desc'].includes(search.order as string)
      ? (search.order as SortOrder)
      : undefined,
  }),
})

// Aspect ratio presets
const ASPECT_RATIOS = [
  { id: 'vertical', name: 'Vertical (9:16)', width: 1080, height: 1920 },
  { id: 'horizontal', name: 'Horizontal (16:9)', width: 1920, height: 1080 },
  { id: 'square', name: 'Square (1:1)', width: 1080, height: 1080 },
]

function ProjectsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const search = Route.useSearch()

  // Local state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [aspectRatio, setAspectRatio] = useState('vertical')
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    projectId: string | null
  }>({ open: false, projectId: null })
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set(),
  )
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [folderCollapsed, setFolderCollapsed] = useState(false)
  const [mobileFolderOpen, setMobileFolderOpen] = useState(false)

  // URL-synced search state
  const searchQuery = search.q || ''
  const statusFilter = search.status || 'all'
  const selectedFolder = search.folder ?? null
  const sortBy = search.sort || 'updatedAt'
  const sortOrder = search.order || 'desc'

  // Update URL params
  const updateSearch = useCallback(
    (updates: Partial<ProjectsSearch>) => {
      navigate({
        to: '/projects',
        search: { ...search, ...updates },
        replace: true,
      })
    },
    [navigate, search],
  )

  // Fetch projects with search/filter
  const { data, isLoading, error } = useQuery({
    queryKey: [
      'projects',
      searchQuery,
      statusFilter,
      selectedFolder,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      const { searchProjectsFn } =
        await import('../../../server/project.server')
      return searchProjectsFn({
        data: {
          query: searchQuery || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          folderId:
            selectedFolder === 'none' ? null : selectedFolder || undefined,
          sortBy,
          sortOrder,
          limit: 50,
        },
      } as never)
    },
  })

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: async (input: {
      data: { name: string; width: number; height: number }
    }) => {
      const { createProjectFn } = await import('../../../server/project.server')
      return createProjectFn(input as never)
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      setIsCreateOpen(false)
      setNewProjectName('')
      navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
      })
    },
  })

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: async (input: { data: { projectId: string } }) => {
      const { deleteProjectFn } = await import('../../../server/project.server')
      return deleteProjectFn(input as never)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return
    const ratio =
      ASPECT_RATIOS.find((r) => r.id === aspectRatio) || ASPECT_RATIOS[0]
    createMutation.mutate({
      data: {
        name: newProjectName,
        width: ratio.width,
        height: ratio.height,
      },
    })
  }

  const handleDeleteProject = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleteDialog({ open: true, projectId })
  }

  const handleConfirmDelete = () => {
    if (!deleteDialog.projectId) return
    deleteMutation.mutate({ data: { projectId: deleteDialog.projectId } })
  }

  const toggleProjectSelection = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      // Exit bulk mode if no selections
      if (next.size === 0) {
        setIsBulkMode(false)
      }
      return next
    })
  }

  const toggleBulkMode = () => {
    setIsBulkMode(!isBulkMode)
    if (isBulkMode) {
      setSelectedProjects(new Set())
    }
  }

  const selectAll = () => {
    if (data?.projects) {
      setSelectedProjects(new Set(data.projects.map((p) => p.id)))
    }
  }

  const projects = data?.projects || []

  // Loading state
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive">Failed to load projects</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ['projects'] })
          }
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-8">
      {/* Folder Sidebar - Desktop */}
      <div className="hidden shrink-0 lg:block">
        <FolderSidebar
          selectedFolderId={selectedFolder}
          onFolderSelect={(folderId) => updateSearch({ folder: folderId })}
          collapsed={folderCollapsed}
          onCollapsedChange={setFolderCollapsed}
        />
      </div>

      {/* Main Content */}
      <div className="min-w-0 flex-1">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile Folder Button */}
              <Sheet open={mobileFolderOpen} onOpenChange={setMobileFolderOpen}>
                <SheetTrigger asChild>
                  <Button variant="secondary" size="icon" className="lg:hidden">
                    <Folder className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <FolderSidebar
                    selectedFolderId={selectedFolder}
                    onFolderSelect={(folderId) => {
                      updateSearch({ folder: folderId })
                      setMobileFolderOpen(false)
                    }}
                  />
                </SheetContent>
              </Sheet>

              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Projects
                </h1>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                  Productions you have started. Open one to continue in the
                  Studio.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Bulk Mode Toggle */}
              {projects.length > 0 && (
                <Button
                  variant={isBulkMode ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={toggleBulkMode}
                  className="hidden sm:flex"
                >
                  {isBulkMode ? (
                    <>
                      <CheckSquare className="mr-2 h-4 w-4" />
                      Exit Select
                    </>
                  ) : (
                    <>
                      <Square className="mr-2 h-4 w-4" />
                      Select
                    </>
                  )}
                </Button>
              )}

              {/* Select All (when in bulk mode) */}
              {isBulkMode && projects.length > 0 && (
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
              )}

              {/* Create Project Dialog */}
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">New Project</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Project Name</Label>
                      <Input
                        id="name"
                        placeholder="My Awesome Video"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateProject()
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Aspect Ratio</Label>
                      <Select
                        value={aspectRatio}
                        onValueChange={setAspectRatio}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASPECT_RATIOS.map((ratio) => (
                            <SelectItem key={ratio.id} value={ratio.id}>
                              {ratio.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleCreateProject}
                      disabled={
                        !newProjectName.trim() || createMutation.isPending
                      }
                    >
                      {createMutation.isPending
                        ? 'Creating...'
                        : 'Create Project'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search Bar */}
          <ProjectSearchBar
            query={searchQuery}
            onQueryChange={(q) => updateSearch({ q })}
            status={statusFilter}
            onStatusChange={(status) => updateSearch({ status })}
            sortBy={sortBy}
            onSortByChange={(sort) => updateSearch({ sort })}
            sortOrder={sortOrder}
            onSortOrderChange={(order) => updateSearch({ order })}
          />

          {/* Projects Grid */}
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16">
              <Film className="h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-4 font-medium">
                {searchQuery || statusFilter !== 'all'
                  ? 'No projects found'
                  : 'No projects yet'}
              </h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Describe an idea on Home and the Director plans it with you.'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button asChild className="mt-5">
                  <Link to="/dashboard">
                    <Sparkles className="h-4 w-4" />
                    Start on Home
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  bulk={isBulkMode}
                  selected={selectedProjects.has(project.id)}
                  onToggleSelect={(e) => toggleProjectSelection(project.id, e)}
                  onDelete={(e) => handleDeleteProject(project.id, e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedProjects}
        onClearSelection={() => {
          setSelectedProjects(new Set())
          setIsBulkMode(false)
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title="Delete Project?"
        description="This action cannot be undone. The project and all its contents will be permanently removed."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

type ProjectRow = {
  id: string
  name: string
  fps: number
  duration: number
  status: string
  thumbnailUrl: string | null
  assetCount: number
  updatedAt: Date | string
}

/** Status chips from the design sheet: Draft · Rendering · Done · Failed */
const STATUS_CHIP: Record<string, { label: string; dot: string }> = {
  draft: { label: 'Draft', dot: 'bg-muted-foreground' },
  rendering: { label: 'Rendering', dot: 'bg-primary animate-pulse' },
  completed: { label: 'Done', dot: 'bg-success' },
  failed: { label: 'Failed', dot: 'bg-destructive' },
}

function ProjectCard({
  project,
  bulk,
  selected,
  onToggleSelect,
  onDelete,
}: {
  project: ProjectRow
  bulk: boolean
  selected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const chip = STATUS_CHIP[project.status] ?? STATUS_CHIP.draft
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="group block"
      onClick={(e) => {
        if (bulk) onToggleSelect(e)
      }}
    >
      <div
        className={cn(
          'relative aspect-video overflow-hidden rounded-xl border bg-card transition-colors',
          selected ? 'border-primary ring-1 ring-primary' : 'border-border',
        )}
      >
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary">
            <Film className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}

        <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white">
          <span className={cn('h-1.5 w-1.5 rounded-full', chip.dot)} />
          {chip.label}
        </span>

        {project.duration > 0 && (
          <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
            {formatFrames(project.duration, project.fps)}
          </span>
        )}

        {bulk && (
          <span
            className={cn(
              'absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md border',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-white/60 bg-black/40',
            )}
          >
            {selected && <Check className="h-4 w-4" />}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="text-xs text-muted-foreground">
            Edited{' '}
            {formatDistanceToNow(new Date(project.updatedAt), {
              addSuffix: true,
            })}
            {project.assetCount > 0 &&
              ` · ${project.assetCount} asset${project.assetCount === 1 ? '' : 's'}`}
          </p>
        </div>
        {!bulk && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Project actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(e)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </Link>
  )
}

/** 900 frames at 30fps → "00:30" */
function formatFrames(frames: number, fps: number): string {
  const total = Math.round(frames / (fps || 30))
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
