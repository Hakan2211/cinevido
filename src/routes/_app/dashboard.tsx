/**
 * Dashboard Page - Gallery-Focused Design
 *
 * Shows recent creations (images, videos, 3D models) as a visual gallery
 * with quick actions for creating new content.
 */

import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GalleryItem, QuickActions, StatsSummary } from '@/components/dashboard'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const routeContext = Route.useRouteContext()
  const user = routeContext.user as { name?: string | null } | undefined
  const userName = user?.name?.split(' ')[0] || 'there'

  // Fetch recent creations
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'recentCreations'],
    queryFn: async () => {
      const { getRecentCreationsFn } = await import('@/server/dashboard.server')
      return getRecentCreationsFn()
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {userName}!
          </h1>
          <div className="mt-2">
            {data ? (
              <StatsSummary counts={data.counts} />
            ) : (
              <p className="text-muted-foreground">Loading your creations...</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Recent Creations Gallery */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Creations</h2>
          {data && data.items.length > 0 && (
            <Link to="/images" search={{ mode: 'generate' }}>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {data.items.map((item) => (
              <GalleryItem key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border/50 bg-muted/20">
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-6 border border-primary/10">
        <Sparkles className="h-12 w-12 text-primary/50" />
      </div>
      <h3 className="mt-6 text-lg font-semibold">No creations yet</h3>
      <p className="mt-2 text-muted-foreground text-center max-w-sm">
        Start creating AI-generated images, videos, and 3D models to see them
        here
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/images" search={{ mode: 'generate' }}>
          <Button>
            <Image className="mr-2 h-4 w-4" />
            Generate Image
          </Button>
        </Link>
      </div>
    </div>
  )
}
