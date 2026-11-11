/**
 * App top bar — replaces the old sidebar.
 *
 * Wordmark · primary nav (Home / Projects / Create) · on Create pages a
 * segmented switch between the labs · fal credit pill · account menu.
 * Below `md` the nav folds into a sheet.
 */

import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  AudioLines,
  Box,
  Image as ImageIcon,
  LogOut,
  Menu,
  Move,
  Settings,
  Shield,
  Video,
} from 'lucide-react'
import { useState } from 'react'
import { signOut } from '../lib/auth-client'
import { Wordmark } from '@/components/common'
import { CreditPill } from '@/components/byok'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

interface AppUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  role?: string
}

/** The labs reachable from "Create", in switcher order */
const LABS = [
  { to: '/images', label: 'Image', icon: ImageIcon },
  { to: '/videos', label: 'Video', icon: Video },
  { to: '/music', label: 'Audio', icon: AudioLines },
  { to: '/3d-models', label: '3D', icon: Box },
  { to: '/motion-control', label: 'Motion', icon: Move },
] as const

const NAV = [
  { to: '/dashboard', label: 'Home', match: ['/dashboard'] },
  { to: '/projects', label: 'Projects', match: ['/projects'] },
  { to: '/images', label: 'Create', match: LABS.map((l) => l.to) },
] as const

function useIsActive() {
  const { pathname } = useLocation()
  return (paths: ReadonlyArray<string>) =>
    paths.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export function AppTopbar({ user }: { user: AppUser }) {
  const navigate = useNavigate()
  const isActive = useIsActive()
  const [mobileOpen, setMobileOpen] = useState(false)
  const inLab = isActive(LABS.map((l) => l.to))
  const initial = (user.name || user.email).charAt(0).toUpperCase()

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-6 border-b border-border bg-background/90 px-4 backdrop-blur-md md:px-6">
      {/* Mobile menu */}
      <button
        className="-ml-1 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link to="/dashboard" className="shrink-0">
        <Wordmark />
      </Link>

      {/* Center: lab switcher on Create pages */}
      <div className="hidden flex-1 justify-center lg:flex">
        {inLab && (
          <nav className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            {LABS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                  isActive([to])
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        {/* Primary nav */}
        <nav className="mr-2 hidden items-center md:flex">
          {NAV.map(({ to, label, match }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative px-3.5 py-5 text-sm font-medium transition-colors',
                isActive(match)
                  ? 'text-foreground after:absolute after:inset-x-3.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <CreditPill className="hidden sm:flex" />

        {/* Account */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-foreground outline-none transition-colors hover:border-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Account menu"
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initial
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">
                {user.name || 'Account'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            {user.role === 'admin' && (
              <DropdownMenuItem asChild>
                <Link to="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="border-b border-border p-5">
            <Wordmark tagline={false} />
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {NAV.filter((n) => n.label !== 'Create').map(
              ({ to, label, match }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive(match)
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {label}
                </Link>
              ),
            )}
            <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Create
            </p>
            {LABS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                  isActive([to])
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border p-4 sm:hidden">
            <CreditPill />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
