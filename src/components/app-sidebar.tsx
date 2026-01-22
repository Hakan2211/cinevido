import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  FolderKanban,
  Image,
  LayoutDashboard,
  LogOut,
  Shield,
  User,
  Video,
} from 'lucide-react'
import { signOut } from '../lib/auth-client'
import { getUserCreditsFn } from '../server/generation.fn'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from './ui/sidebar'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface AppUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  emailVerified: boolean
  role?: string
}

interface AppSidebarProps {
  user: AppUser
}

export function AppSidebar({ user }: AppSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setOpenMobile } = useSidebar()
  const userName = user.name || 'User'
  const userEmail = user.email
  const userRole = user.role
  const isAdmin = userRole === 'admin'

  // Fetch user credits
  const { data: creditsData } = useQuery({
    queryKey: ['user-credits'],
    queryFn: () => getUserCreditsFn(),
    refetchInterval: 30000,
  })

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  // Helper to check active state - supports nested routes
  const isActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + '/')
    )
  }

  // Helper to close mobile sheet on navigation
  const handleNavClick = () => {
    setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:mb-10 transition-all">
        <Link
          to="/"
          className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center"
        >
          <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20 flex items-center justify-center text-primary-foreground font-bold text-sm transition-all">
            D
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent group-data-[collapsible=icon]:hidden transition-opacity duration-200">
            DirectorAI
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 group-data-[collapsible=icon]:px-0">
        {/* Main Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-sm font-semibold tracking-wider text-muted-foreground/80">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/dashboard')}
                  tooltip="Dashboard"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/dashboard">
                    <LayoutDashboard className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      Dashboard
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Create Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-sm font-semibold tracking-wider text-muted-foreground/80">
            Create
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/images')}
                  tooltip="Images"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/images" search={{ mode: 'generate' }}>
                    <Image className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      Images
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/videos')}
                  tooltip="Videos"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/videos">
                    <Video className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      Videos
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Edit Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-sm font-semibold tracking-wider text-muted-foreground/80">
            Edit
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/projects')}
                  tooltip="Projects"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/projects">
                    <FolderKanban className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      Projects
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-sm font-semibold tracking-wider text-muted-foreground/80">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/profile')}
                  tooltip="Profile"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/profile">
                    <User className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      Profile
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {userRole === 'admin' && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin')}
                    tooltip="Admin"
                    size="lg"
                    className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                    onClick={handleNavClick}
                  >
                    <Link to="/admin">
                      <Shield className="h-5! w-5!" />
                      <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                        Admin
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
        {/* Credits Display */}
        <div className="mb-3 rounded-lg bg-muted/50 px-3 py-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Credits</span>
            {isAdmin ? (
              <span className="text-sm font-medium text-green-600">
                Unlimited
              </span>
            ) : (
              <span
                className={`text-sm font-medium ${
                  (creditsData?.credits ?? 0) < 10
                    ? 'text-red-500'
                    : (creditsData?.credits ?? 0) < 25
                      ? 'text-yellow-500'
                      : 'text-foreground'
                }`}
              >
                {creditsData?.credits ?? '...'}
              </span>
            )}
          </div>
        </div>

        {/* User Section */}
        <div className="rounded-2xl bg-gradient-to-br from-muted/50 to-muted/80 p-4 border border-border/50 shadow-sm group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:shadow-none transition-all group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-3 mb-3 group-data-[collapsible=icon]:mb-0 group-data-[collapsible=icon]:justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary border border-primary/20 shadow-sm transition-all cursor-pointer hover:bg-primary/20">
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={userName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="font-semibold text-sm">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-48">
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-bold text-foreground">
                {userName}
              </p>
              <p className="truncate text-xs text-muted-foreground font-medium">
                {userEmail}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors group-data-[collapsible=icon]:hidden font-medium"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
