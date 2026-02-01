/**
 * Mobile Workspace Component
 *
 * Tab-based layout for mobile devices, replacing the 3-column desktop layout.
 * Uses bottom navigation tabs and sheets for panels.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, MoreVertical } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { MobileNavTabs, type MobileTab } from './MobileNavTabs'
import { ChatPanel } from '../ChatPanel'
import { VideoPreview } from '../VideoPreview'
import { Timeline } from '../Timeline'
import { AssetPanel } from '../AssetPanel'
import { Button } from '../../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import type { ProjectManifest } from '../../../remotion/types'

// Project type matching desktop Workspace
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

interface MobileWorkspaceProps {
  project: Project
}

// Polling intervals
const JOB_POLL_INTERVAL = 3000
const MANIFEST_POLL_INTERVAL = 5000

export function MobileWorkspace({ project }: MobileWorkspaceProps) {
  const queryClient = useQueryClient()

  // Active tab
  const [activeTab, setActiveTab] = useState<MobileTab>('preview')

  // Local state for the manifest
  const [manifest, setManifest] = useState<ProjectManifest>(project.manifest)
  const [manifestVersion, setManifestVersion] = useState(0)
  const lastManifestUpdate = useRef<Date>(project.updatedAt)

  // Player state
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Selection state
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)

  // Active jobs tracking
  const [activeJobs, setActiveJobs] = useState<
    Array<{ id: string; type: string; status: string; progress: number }>
  >([])

  // =============================================================================
  // Job Polling
  // =============================================================================

  const { data: jobsData } = useQuery({
    queryKey: ['jobs', project.id, 'processing'],
    queryFn: async () => {
      const { listJobsFn } = await import('../../../server/generation.server')
      return listJobsFn({
        data: { projectId: project.id, status: 'processing', limit: 10 },
      })
    },
    refetchInterval: JOB_POLL_INTERVAL,
    enabled: true,
  })

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

    const pollJob = async (jobId: string) => {
      try {
        const { getJobStatusFn } =
          await import('../../../server/generation.server')
        const status = await getJobStatusFn({ data: { jobId } })
        if (status.status === 'completed') {
          queryClient.invalidateQueries({ queryKey: ['project', project.id] })
          queryClient.invalidateQueries({ queryKey: ['jobs', project.id] })
          refreshManifest()
        }
      } catch (error) {
        console.error('Failed to poll job status:', error)
      }
    }

    jobsData.forEach((job) => {
      if (job.status === 'processing') {
        pollJob(job.id)
      }
    })
  }, [jobsData, project.id, queryClient])

  // =============================================================================
  // Manifest Polling
  // =============================================================================

  const refreshManifest = useCallback(async () => {
    try {
      const { getManifestFn } = await import('../../../server/project.server')
      const result = await getManifestFn({ data: { projectId: project.id } })

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

  useEffect(() => {
    if (activeJobs.length === 0) return
    const interval = setInterval(refreshManifest, MANIFEST_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [activeJobs.length, refreshManifest])

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleManifestChange = useCallback((newManifest: ProjectManifest) => {
    setManifest(newManifest)
    setManifestVersion((v) => v + 1)
    lastManifestUpdate.current = new Date()
  }, [])

  const handleSeek = useCallback((frame: number) => {
    setCurrentFrame(frame)
  }, [])

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b px-2 safe-area-pt">
        <div className="flex items-center gap-2">
          <Link to="/projects">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{project.name}</h1>
            <p className="text-[10px] text-muted-foreground">
              {project.width}x{project.height}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Active jobs indicator */}
          {activeJobs.length > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
              {activeJobs.length}
            </div>
          )}

          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Download className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Project Settings</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content Area - switches based on active tab */}
      <main className="flex-1 overflow-hidden pb-14">
        {activeTab === 'preview' && (
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-hidden p-2">
              <VideoPreview
                key={manifestVersion}
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
            {/* Mini timeline for quick scrubbing */}
            <div className="h-16 border-t bg-muted/20 px-2">
              <div className="flex h-full items-center">
                <input
                  type="range"
                  min={0}
                  max={Math.max(project.duration - 1, 0)}
                  value={currentFrame}
                  onChange={(e) => setCurrentFrame(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="h-full">
            <ChatPanel
              projectId={project.id}
              manifest={manifest}
              onManifestChange={handleManifestChange}
              collapsed={false}
              onToggleCollapse={() => {}}
              mode="fullscreen"
            />
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="h-full">
            <AssetPanel
              projectId={project.id}
              assets={project.assets}
              manifest={manifest}
              onManifestChange={handleManifestChange}
              collapsed={false}
              onToggleCollapse={() => {}}
              mode="fullscreen"
            />
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="h-full">
            <Timeline
              manifest={manifest}
              fps={project.fps}
              currentFrame={currentFrame}
              selectedClipId={selectedClipId}
              onSeek={handleSeek}
              onSelectClip={setSelectedClipId}
              onManifestChange={handleManifestChange}
            />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <MobileNavTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasActiveJobs={activeJobs.length > 0}
      />
    </div>
  )
}
