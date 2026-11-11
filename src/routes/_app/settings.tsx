/**
 * Settings (mockup 6): a left sub-nav and one section per page. Only sections
 * that do something are listed — the app is dark-only, so no Appearance.
 */

import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { CreditCard, Plug, UserRound } from 'lucide-react'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsLayout,
})

const SECTIONS = [
  { to: '/settings/general', label: 'General', icon: UserRound },
  { to: '/settings/providers', label: 'Providers', icon: Plug },
  { to: '/settings/billing', label: 'Plans & Billing', icon: CreditCard },
] as const

function SettingsLayout() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:gap-10">
      <nav
        aria-label="Settings"
        className="flex gap-1 overflow-x-auto md:w-52 md:shrink-0 md:flex-col"
      >
        {SECTIONS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-2.5 whitespace-nowrap rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:border-primary data-[status=active]:bg-accent data-[status=active]:text-foreground"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
