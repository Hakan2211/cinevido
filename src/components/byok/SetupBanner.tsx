import { Link } from '@tanstack/react-router'
import { ArrowRight, Key } from 'lucide-react'
import { Button } from '../ui/button'

/**
 * Banner shown to users who have purchased BYOK access but haven't
 * connected their fal.ai API key yet.
 */
export function SetupBanner() {
  return (
    <div className="border-b border-primary/20 bg-primary/[0.07]">
      <div className="flex items-center justify-between px-4 py-2 md:px-6">
        <div className="flex items-center gap-2 text-sm">
          <Key className="h-4 w-4 text-primary" />
          <span className="text-foreground/90">
            <span className="font-medium">Almost there!</span>
            <span className="hidden sm:inline">
              {' '}
              — connect your fal.ai API key to start generating
            </span>
          </span>
        </div>
        <Button size="sm" variant="default" className="h-7 text-xs" asChild>
          <Link to="/setup">
            Complete Setup
            <ArrowRight className="ml-1.5 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
