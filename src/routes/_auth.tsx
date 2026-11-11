import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { Wordmark } from '@/components/common'

// NOTE: Server functions are dynamically imported in beforeLoad
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions

/**
 * Auth Layout
 * Wordmark on top, the form centred below (login, signup)
 * Redirects to dashboard if already authenticated
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ search }) => {
    const { getSessionFn } = await import('../server/auth.server')
    const session = await getSessionFn()
    if (session?.user) {
      const searchParams = search as { redirect?: string }

      // If user is trying to checkout, check if they already have platform access
      if (searchParams?.redirect === 'checkout') {
        // Check platform access
        const { getPlatformStatusFn } = await import('../server/billing.server')
        const platformStatus = await getPlatformStatusFn()

        if (platformStatus.hasPlatformAccess) {
          // Already has access - go directly to dashboard
          throw redirect({ to: '/dashboard' })
        }

        // No access yet - go to checkout
        throw redirect({ to: '/pricing', search: { auto_checkout: 'true' } })
      }

      // Default: go to dashboard
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background px-4">
      <header className="flex justify-center pt-12 pb-10 sm:pt-20">
        <Link to="/" aria-label="Cinevido home">
          <Wordmark />
        </Link>
      </header>
      <main className="flex flex-1 justify-center pb-16">
        <Outlet />
      </main>
    </div>
  )
}
