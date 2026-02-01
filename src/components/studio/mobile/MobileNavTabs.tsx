/**
 * Mobile Navigation Tabs Component
 *
 * Fixed bottom navigation for mobile workspace.
 * Tabs: Preview, Chat, Assets, Timeline
 */

import { Film, Layers, MessageSquare, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MobileTab = 'preview' | 'chat' | 'assets' | 'timeline'

interface MobileNavTabsProps {
  activeTab: MobileTab
  onTabChange: (tab: MobileTab) => void
  hasActiveJobs?: boolean
}

const TABS: Array<{ id: MobileTab; label: string; icon: typeof Film }> = [
  { id: 'preview', label: 'Preview', icon: Film },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'assets', label: 'Assets', icon: Layers },
  { id: 'timeline', label: 'Timeline', icon: SlidersHorizontal },
]

export function MobileNavTabs({
  activeTab,
  onTabChange,
  hasActiveJobs,
}: MobileNavTabsProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background safe-area-pb">
      <div className="flex h-14">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const showBadge = tab.id === 'preview' && hasActiveJobs

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5',
                'transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
