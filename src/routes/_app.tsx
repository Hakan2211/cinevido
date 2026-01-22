import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '../server/auth.fn'
import { useSession } from '../lib/auth-client'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../components/ui/sidebar'
import { AppSidebar } from '../components/app-sidebar'
import { Separator } from '../components/ui/separator'

// Type for the user from Better-Auth session
interface AppUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  emailVerified: boolean
  role?: string
}

/**
 * Protected App Layout
 * Requires authentication - redirects to login if not authenticated
 * Includes sidebar navigation and user dropdown
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
    return { user: session.user as AppUser }
  },
  component: AppLayout,
})

function AppLayout() {
  const routeContext = Route.useRouteContext()
  const { data: session } = useSession()

  // User from session takes precedence, fallback to route context
  const sessionUser = session?.user as AppUser | undefined
  const user = sessionUser ?? routeContext.user

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <div className="flex flex-1 flex-col overflow-hidden h-full">
          {/* Header with Sidebar Trigger */}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/60 backdrop-blur-md px-4 sticky top-0 z-10 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto bg-muted/5 p-6 md:p-8">
            <Outlet />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
