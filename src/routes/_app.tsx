import {
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
} from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '../lib/auth-client'

// NOTE: Server functions are dynamically imported in beforeLoad and queryFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../components/ui/sidebar'
import { AppSidebar } from '../components/app-sidebar'
import { Separator } from '../components/ui/separator'
import { SetupBanner } from '../components/byok'

// Type for the user from Better-Auth session
interface AppUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  emailVerified: boolean
  role?: string
}

// Type for BYOK status (avoid importing from server file)
interface ByokStatus {
  hasPlatformAccess: boolean
  hasApiKey: boolean
  apiKeyLastFour: string | null
  purchaseDate: Date | null
}

/**
 * Protected App Layout
 * Requires authentication - redirects to login if not authenticated
 * Requires platform access - redirects to pricing if not paid
 * Includes sidebar navigation and user dropdown
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const { getSessionFn } = await import('../server/auth.server')
    const session = await getSessionFn()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }

    const user = session.user as AppUser

    // Admin users bypass platform access check
    if (user.role === 'admin') {
      return {
        user,
        hasPlatformAccess: true,
      }
    }

    // Check platform access for non-admin users
    const { getPlatformStatusFn } = await import('../server/billing.server')
    const platformStatus = await getPlatformStatusFn()

    if (!platformStatus.hasPlatformAccess) {
      throw redirect({ to: '/pricing' })
    }

    return {
      user,
      hasPlatformAccess: true,
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const routeContext = Route.useRouteContext()
  const { data: session } = useSession()
  const matches = useMatches()

  // User from session takes precedence, fallback to route context
  const sessionUser = session?.user as AppUser | undefined
  const user = sessionUser ?? routeContext.user

  // Detect if we're on a studio/project workspace route (needs full-bleed layout)
  const isStudioRoute = matches.some((match) =>
    match.routeId.includes('/projects/$projectId'),
  )

  // Fetch BYOK status client-side only (avoids server import leak)
  const { data: currentByokStatus } = useQuery({
    queryKey: ['byok-status'],
    queryFn: async (): Promise<ByokStatus> => {
      // Dynamic import to avoid bundling server code in client
      const { getByokStatusFn } = await import('../server/byok.server')
      return getByokStatusFn()
    },
    staleTime: 30000, // Consider fresh for 30 seconds
  })

  // Show setup banner if user has platform access but no API key configured
  const showSetupBanner =
    currentByokStatus?.hasPlatformAccess && !currentByokStatus?.hasApiKey

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <div className="flex flex-1 flex-col overflow-hidden h-full">
          {/* Setup Banner - shown when user needs to add API key */}
          {showSetupBanner && <SetupBanner />}

          {/* Header with Sidebar Trigger */}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/60 backdrop-blur-md px-4 sticky top-0 z-10 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
            </div>
          </header>

          {/* Page Content */}
          <main
            className={
              isStudioRoute
                ? 'flex-1 min-w-0 w-full max-w-full overflow-hidden' // Studio: no padding, no scroll, full-bleed
                : 'flex-1 overflow-auto bg-muted/5 p-6 md:p-8' // Normal pages
            }
          >
            <Outlet />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
