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
import { AppTopbar } from '../components/app-topbar'
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
 * Includes the top bar (navigation, credit balance, account menu)
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
  // Studio and the labs manage their own panels and scrolling (full-bleed)
  const FULL_BLEED_ROUTES = [
    '/_app/projects/$projectId',
    '/_app/videos/',
    '/_app/images/',
    '/_app/music/',
    '/_app/3d-models',
    '/_app/motion-control/',
  ]
  const isFullBleed = matches.some((match) =>
    FULL_BLEED_ROUTES.includes(match.routeId),
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
  // (admins without a key fall back to the server's FAL_KEY, so they can generate)
  const showSetupBanner =
    currentByokStatus?.hasPlatformAccess &&
    !currentByokStatus?.hasApiKey &&
    user.role !== 'admin'

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <AppTopbar user={user} />

      {/* Setup Banner - shown when user needs to add API key */}
      {showSetupBanner && <SetupBanner />}

      {/* Page Content */}
      <main
        className={
          isFullBleed
            ? 'flex-1 min-h-0 min-w-0 w-full max-w-full overflow-hidden' // full-bleed, page scrolls itself
            : 'flex-1 min-h-0 overflow-auto px-4 py-6 md:px-8 md:py-8' // Normal pages
        }
      >
        <Outlet />
      </main>
    </div>
  )
}
