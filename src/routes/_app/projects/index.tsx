/**
 * Projects List Page
 *
 * Displays user's video projects with search, folders, and bulk actions.
 * Responsive grid layout with mobile-first design.
 */

import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import {
  Calendar,
  CheckSquare,
  Folder,
  Layers,
  Play,
  Plus,
  Square,
  Trash2,
  Video,
} from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
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
  beforeLoad: ({ context }) => {
    // Only admins can access projects for now (feature in development)
    if (context.user?.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
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

  const formatDuration = (frames: number, fps: number = 30) => {
    const seconds = Math.floor(frames / fps)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const projects = data?.projects || []

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full">
        {/* Folder Sidebar - Hidden on mobile */}
        <div className="hidden lg:block">
          <div className="w-56 animate-pulse bg-muted/30" />
        </div>
        <div className="flex-1 space-y-6 p-4 md:p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold md:text-3xl">Projects</h1>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-64 animate-pulse bg-muted" />
            ))}
          </div>
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
    <div className="flex h-full">
      {/* Folder Sidebar - Desktop */}
      <div className="hidden lg:block">
        <FolderSidebar
          selectedFolderId={selectedFolder}
          onFolderSelect={(folderId) => updateSearch({ folder: folderId })}
          collapsed={folderCollapsed}
          onCollapsedChange={setFolderCollapsed}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4 md:space-y-6 md:p-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile Folder Button */}
              <Sheet open={mobileFolderOpen} onOpenChange={setMobileFolderOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden">
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
                <h1 className="text-2xl font-bold md:text-3xl">Projects</h1>
                <p className="hidden text-muted-foreground sm:block">
                  Create and manage your video projects
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Bulk Mode Toggle */}
              {projects.length > 0 && (
                <Button
                  variant={isBulkMode ? 'secondary' : 'outline'}
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
                <Button variant="outline" size="sm" onClick={selectAll}>
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
            <Card className="flex flex-col items-center justify-center py-12">
              <Video className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">
                {searchQuery || statusFilter !== 'all'
                  ? 'No projects found'
                  : 'No projects yet'}
              </h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first video project to get started'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => {
                const isSelected = selectedProjects.has(project.id)

                return (
                  <Link
                    key={project.id}
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="group"
                    onClick={(e) => {
                      if (isBulkMode) {
                        e.preventDefault()
                        toggleProjectSelection(project.id, e)
                      }
                    }}
                  >
                    <Card
                      className={cn(
                        'overflow-hidden transition-all',
                        'hover:shadow-lg',
                        isSelected && 'ring-2 ring-primary',
                      )}
                    >
                      {/* Thumbnail */}
                      <div
                        className="relative bg-muted"
                        style={{
                          aspectRatio:
                            project.width > project.height
                              ? '16/9'
                              : project.width === project.height
                                ? '1/1'
                                : '9/16',
                          maxHeight: '200px',
                        }}
                      >
                        {project.thumbnailUrl ? (
                          <img
                            src={project.thumbnailUrl}
                            alt={project.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Video className="h-12 w-12 text-muted-foreground/50" />
                          </div>
                        )}

                        {/* Status badge */}
                        <div className="absolute left-2 top-2">
                          <span
                            className={cn(
                              'rounded-full px-2 py-1 text-xs font-medium',
                              project.status === 'completed' &&
                                'bg-green-500/90 text-white',
                              project.status === 'rendering' &&
                                'bg-yellow-500/90 text-white',
                              project.status === 'failed' &&
                                'bg-red-500/90 text-white',
                              project.status === 'draft' &&
                                'bg-gray-500/90 text-white',
                            )}
                          >
                            {project.status}
                          </span>
                        </div>

                        {/* Selection checkbox / Hover overlay */}
                        {isBulkMode ? (
                          <button
                            onClick={(e) =>
                              toggleProjectSelection(project.id, e)
                            }
                            className="absolute inset-0 flex items-center justify-center bg-black/30"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-8 w-8 text-primary" />
                            ) : (
                              <Square className="h-8 w-8 text-white" />
                            )}
                          </button>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                            <Play className="h-12 w-12 text-white" />
                          </div>
                        )}

                        {/* Delete button (non-bulk mode) */}
                        {!isBulkMode && (
                          <button
                            onClick={(e) => handleDeleteProject(project.id, e)}
                            className="absolute right-2 top-2 rounded-full bg-red-500/90 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3 md:p-4">
                        <h3 className="truncate font-medium">{project.name}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground md:text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(project.updatedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {project.assetCount}
                          </span>
                          {project.duration > 0 && (
                            <span>{formatDuration(project.duration)}</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              })}
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
