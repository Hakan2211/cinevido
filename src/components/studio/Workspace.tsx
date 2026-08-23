/**
 * Video Workspace Component
 *
 * The main 3-column layout for video editing:
 * - Left: Chat/AI Director panel (equal width)
 * - Center: Video preview + Timeline
 * - Right: Asset Library + Generate panel (equal width)
 *
 * Includes polling for:
 * - Active generation jobs
 * - Manifest updates (when AI modifies timeline)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { GripHorizontal } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChatPanel } from './ChatPanel'

// NOTE: Server functions are dynamically imported in queryFn/callbacks
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions
import { VideoPreview } from './VideoPreview'
import { Timeline } from './timeline'
import { AssetPanel } from './AssetPanel'
import { QuickActionsToolbar } from './QuickActionsToolbar'
import { MobileWorkspace } from './mobile'
import { useIsMobile } from '../../hooks'
import type { ProjectManifest } from '../../remotion/types'

// Project type from getProjectFn
interface Project {
  id: string
  name: string
  width: number
  height: number
  fps: number
  duration: number
  status: string
  outputUrl: string | null
  thumbnailUrl: string | null
  manifest: ProjectManifest
  assets: Array<{
    id: string
    type: string
    url: string
    filename: string
    prompt: string | null
    metadata: unknown
    durationSeconds: number | null
    createdAt: Date
  }>
  createdAt: Date
  updatedAt: Date
}

interface WorkspaceProps {
  project: Project
}

// Polling intervals
const JOB_POLL_INTERVAL = 3000 // 3 seconds
const MANIFEST_POLL_INTERVAL = 5000 // 5 seconds

// How long timeline edits settle before they are written to the server
const SAVE_DEBOUNCE = 700

// Timeline zone height (px) — the editor needs room for four lanes
const TIMELINE_MIN_H = 190
const TIMELINE_MAX_H = 700
const TIMELINE_DEFAULT_H = 320

export function Workspace({ project }: WorkspaceProps) {
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()

  // Local state for the manifest (optimistic updates)
  const [manifest, setManifest] = useState<ProjectManifest>(project.manifest)
  const [manifestVersion, setManifestVersion] = useState(0)

  // Track the last known manifest update time for change detection
  const lastManifestUpdate = useRef<Date>(project.updatedAt)

  // Debounced timeline save: the timer, and whether an edit is still in flight
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingSave = useRef(false)

  // Timeline zone height, dragged from the splitter above it
  const [timelineHeight, setTimelineHeight] = useState(TIMELINE_DEFAULT_H)

  // Player state
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Selection state
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)

  // Panel collapse state
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)

  // Active jobs tracking
  const [activeJobs, setActiveJobs] = useState<
    Array<{ id: string; type: string; status: string; progress: number }>
  >([])

  // =============================================================================
  // Job Polling - Check for active generation jobs
  // =============================================================================

  const { data: jobsData } = useQuery({
    queryKey: ['jobs', project.id, 'processing'],
    queryFn: async () => {
      const { listJobsFn } = await import('../../server/generation.server')
      const result = await listJobsFn({
        data: { projectId: project.id, status: 'processing', limit: 10 },
      })
      return result
    },
    refetchInterval: JOB_POLL_INTERVAL,
    enabled: true,
  })

  // Poll individual jobs for status updates
  useEffect(() => {
    if (!jobsData || jobsData.length === 0) {
      setActiveJobs([])
      return
    }

    setActiveJobs(
      jobsData.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress || 0,
      })),
    )

    // Poll each active job for completion
    const pollJob = async (jobId: string) => {
      try {
        const { getJobStatusFn } =
          await import('../../server/generation.server')
        const status = await getJobStatusFn({ data: { jobId } })
        if (status.status === 'completed') {
          // Job completed - refresh assets and manifest
          queryClient.invalidateQueries({ queryKey: ['project', project.id] })
          queryClient.invalidateQueries({ queryKey: ['jobs', project.id] })

          // Force manifest refresh
          refreshManifest()
        }
      } catch (error) {
        console.error('Failed to poll job status:', error)
      }
    }

    // Poll each job
    jobsData.forEach((job) => {
      if (job.status === 'processing') {
        pollJob(job.id)
      }
    })
  }, [jobsData, project.id, queryClient])

  // =============================================================================
  // Manifest Polling - Check for AI-driven manifest updates
  // =============================================================================

  const refreshManifest = useCallback(async () => {
    // A local edit that has not reached the server yet must win: pulling the
    // server's copy on top of it would throw away the cut the user is making.
    if (pendingSave.current) return
    try {
      const { getManifestFn } = await import('../../server/project.server')
      const result = await getManifestFn({ data: { projectId: project.id } })

      // Check if manifest was updated
      const updatedAt = new Date(result.updatedAt)
      if (updatedAt > lastManifestUpdate.current) {
        lastManifestUpdate.current = updatedAt
        setManifest(result.manifest)
        setManifestVersion((v) => v + 1)
      }
    } catch (error) {
      console.error('Failed to refresh manifest:', error)
    }
  }, [project.id])

  // Poll for manifest changes when there are active jobs or chat is being used
  useEffect(() => {
    // Only poll if there are active jobs (AI might be modifying timeline)
    if (activeJobs.length === 0) return

    const interval = setInterval(refreshManifest, MANIFEST_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [activeJobs.length, refreshManifest])

  // =============================================================================
  // Handlers
  // =============================================================================

  // Handle manifest updates (from user actions or AI).
  //
  // Edits apply locally at once and save on a debounce — a timeline drag emits
  // a manifest per pointer move, and none of those deserve a round trip. The
  // save carries the project it belongs to, so a project switch mid-debounce
  // can never write this cut into the next project.
  const handleManifestChange = useCallback(
    (newManifest: ProjectManifest) => {
      setManifest(newManifest)
      setManifestVersion((v) => v + 1)
      lastManifestUpdate.current = new Date()

      pendingSave.current = true
      clearTimeout(saveTimer.current)
      const projectId = project.id
      saveTimer.current = setTimeout(async () => {
        try {
          const { updateManifestFn } =
            await import('../../server/project.server')
          const result = await updateManifestFn({
            data: { projectId, manifest: JSON.stringify(newManifest) },
          })
          lastManifestUpdate.current = new Date(result.updatedAt)
        } catch (error) {
          console.error('Failed to save timeline:', error)
        } finally {
          pendingSave.current = false
        }
      }, SAVE_DEBOUNCE)
    },
    [project.id],
  )

  // Never let a debounced save land after the workspace moved on
  useEffect(() => {
    return () => clearTimeout(saveTimer.current)
  }, [])

  // Handle frame change from timeline
  const handleSeek = useCallback((frame: number) => {
    setCurrentFrame(frame)
  }, [])

  // =============================================================================
  // Render
  // =============================================================================

  // Render mobile workspace on small screens
  if (isMobile) {
    return <MobileWorkspace project={project} />
  }

  return (
    <div className="flex h-full w-full max-w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold truncate max-w-[200px]">
            {project.name}
          </h1>
          <span className="text-xs text-muted-foreground">
            {project.width}x{project.height} @ {project.fps}fps
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Active jobs indicator */}
          {activeJobs.length > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-yellow-500/10 px-3 py-1 text-xs text-yellow-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
              {activeJobs.length} job{activeJobs.length > 1 ? 's' : ''} running
            </div>
          )}
          <span className="text-sm text-muted-foreground">
            {Math.floor(project.duration / project.fps)}s
          </span>
          <button className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90">
            Export
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 w-full max-w-full overflow-hidden">
        {/* Left Panel - Chat */}
        <aside
          className={`border-r bg-muted/30 transition-all overflow-hidden ${
            leftPanelCollapsed ? 'w-12 shrink-0' : 'flex-[0_1_280px] min-w-48'
          }`}
        >
          <ChatPanel
            projectId={project.id}
            manifest={manifest}
            onManifestChange={handleManifestChange}
            collapsed={leftPanelCollapsed}
            onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
          />
        </aside>

        {/* Center - Preview + Timeline */}
        <main className="relative flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Video Preview */}
          <div className="flex-1 overflow-hidden p-4">
            <VideoPreview
              key={manifestVersion} // Force re-render when manifest changes
              manifest={manifest}
              width={project.width}
              height={project.height}
              fps={project.fps}
              currentFrame={currentFrame}
              isPlaying={isPlaying}
              onFrameChange={setCurrentFrame}
              onPlayingChange={setIsPlaying}
            />
          </div>

          {/* Quick Actions Toolbar - Floating above timeline */}
          <div
            className="absolute left-1/2 z-10 -translate-x-1/2"
            style={{ bottom: timelineHeight + 16 }}
          >
            <QuickActionsToolbar
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              onSkipBack={() =>
                setCurrentFrame(Math.max(0, currentFrame - project.fps * 2))
              }
              onSkipForward={() =>
                setCurrentFrame(
                  Math.min(
                    project.duration - 1,
                    currentFrame + project.fps * 2,
                  ),
                )
              }
            />
          </div>

          {/* Splitter — drag to give the cut more room */}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize timeline"
            className="group flex h-2.5 shrink-0 cursor-row-resize items-center justify-center bg-border/40 hover:bg-primary/20"
            onPointerDown={(e) => {
              e.preventDefault()
              const startY = e.clientY
              const startH = timelineHeight
              const onMove = (move: PointerEvent) => {
                setTimelineHeight(
                  Math.max(
                    TIMELINE_MIN_H,
                    Math.min(TIMELINE_MAX_H, startH + (startY - move.clientY)),
                  ),
                )
              }
              const onUp = () => {
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
              }
              window.addEventListener('pointermove', onMove)
              window.addEventListener('pointerup', onUp)
            }}
          >
            <GripHorizontal className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary" />
          </div>

          {/* Timeline */}
          <div
            className="shrink-0 border-t bg-muted/20"
            style={{ height: timelineHeight }}
          >
            <Timeline
              manifest={manifest}
              fps={project.fps}
              currentFrame={currentFrame}
              selectedClipId={selectedClipId}
              onSeek={handleSeek}
              onSelectClip={setSelectedClipId}
              onManifestChange={handleManifestChange}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              assets={project.assets}
            />
          </div>
        </main>

        {/* Right Panel - Assets */}
        <aside
          className={`border-l bg-muted/30 transition-all overflow-hidden ${
            rightPanelCollapsed ? 'w-12 shrink-0' : 'flex-[0_1_280px] min-w-48'
          }`}
        >
          <AssetPanel
            projectId={project.id}
            assets={project.assets}
            manifest={manifest}
            onManifestChange={handleManifestChange}
            fps={project.fps}
            collapsed={rightPanelCollapsed}
            onToggleCollapse={() =>
              setRightPanelCollapsed(!rightPanelCollapsed)
            }
          />
        </aside>
      </div>
    </div>
  )
}
