import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  Box,
  FolderKanban,
  Image,
  LayoutDashboard,
  LogOut,
  Move,
  Shield,
  User,
  Video,
} from 'lucide-react'
import { signOut } from '../lib/auth-client'

// NOTE: Server functions are dynamically imported in queryFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions
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
import { Logo } from '@/components/common'
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
          <Logo size={32} className="shrink-0" />
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent group-data-[collapsible=icon]:hidden transition-opacity duration-200">
            Cinevido
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/motion-control')}
                  tooltip="Motion Control"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/motion-control">
                    <Move className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      Motion Control
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/3d-models')}
                  tooltip="3D Models"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/3d-models" search={{ mode: 'text-to-3d' }}>
                    <Box className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      3D Models
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
