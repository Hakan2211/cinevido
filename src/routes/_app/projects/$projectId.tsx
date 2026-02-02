/**
 * Project Workspace Page
 *
 * The main video editing workspace with 3-column layout:
 * - Left: Chat/AI Director panel
 * - Center: Video preview + Timeline
 * - Right: Asset Library + Generate panel
 */

import { useEffect, useRef } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Workspace } from '../../../components/studio/Workspace'
import { useSidebar } from '../../../components/ui/sidebar'

// NOTE: Server functions are dynamically imported in queryFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions

export const Route = createFileRoute('/_app/projects/$projectId')({
  beforeLoad: ({ context }) => {
    // Only admins can access projects for now (feature in development)
    if (context.user?.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: ProjectWorkspacePage,
})

function ProjectWorkspacePage() {
  const { projectId } = Route.useParams()
  const { setOpen, open } = useSidebar()
  const wasOpenRef = useRef(open)

  // Auto-collapse sidebar on mount, restore on unmount
  useEffect(() => {
    // Save current state on mount
    wasOpenRef.current = open
    // Collapse sidebar for more workspace space
    setOpen(false)

    return () => {
      // Restore previous state when leaving the page
      if (wasOpenRef.current) {
        setOpen(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount/unmount

  // Fetch project data
  const {
    data: project,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { getProjectFn } = await import('../../../server/project.server')
      return getProjectFn({ data: { projectId } })
    },
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Failed to load project</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Project not found'}
          </p>
        </div>
      </div>
    )
  }

  return <Workspace project={project} />
}
