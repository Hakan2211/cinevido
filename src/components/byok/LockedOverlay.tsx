import { useState } from 'react'
import { Lock, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'

interface LockedOverlayProps {
  /**
   * The feature name to display (e.g., "Generate Images", "Create Videos")
   */
  featureName?: string
  /**
   * Whether to show as an inline button or as an overlay
   */
  variant?: 'overlay' | 'button'
  /**
   * Custom class name for the overlay
   */
  className?: string
  /**
   * Callback when the user clicks the unlock button.
   * Should trigger the checkout flow.
   */
  onUnlock?: () => void
  /**
   * Whether the unlock action is pending (loading state)
   */
  isUnlocking?: boolean
}

/**
 * Overlay/button shown on locked features for users without BYOK access.
 * Prompts them to purchase access.
 *
 * NOTE: This component does NOT import server functions directly to avoid
 * bundling server code into the client. The parent component should provide
 * the onUnlock callback that handles the checkout mutation.
 */
export function LockedOverlay({
  featureName = 'this feature',
  variant = 'overlay',
  className = '',
  onUnlock,
  isUnlocking = false,
}: LockedOverlayProps) {
  const [open, setOpen] = useState(false)

  const handleUnlock = () => {
    onUnlock?.()
  }

  const content = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === 'overlay' ? (
          <div
            className={`absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm cursor-pointer group ${className}`}
          >
            <div className="flex flex-col items-center gap-2 text-center p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                <Lock className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm font-medium">Unlock to {featureName}</p>
              <p className="text-xs text-muted-foreground">
                Click to learn more
              </p>
            </div>
          </div>
        ) : (
          <Button variant="outline" className={className}>
            <Lock className="mr-2 h-4 w-4" />
            Unlock {featureName}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Unlock Cinevido
          </DialogTitle>
          <DialogDescription>
            Get full access to all AI generation features with a one-time
            payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Pricing */}
          <div className="rounded-lg border bg-muted/50 p-4 text-center">
            <div className="text-3xl font-bold">$99</div>
            <div className="text-sm text-muted-foreground">
              One-time payment, lifetime access
            </div>
          </div>

          {/* What's included */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">What you get:</h4>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Full access to the Cinevido platform
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Connect your own fal.ai API key
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Pay fal.ai directly for generations
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                No subscription fees ever
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Access to all future updates
              </li>
            </ul>
          </div>

          <Button
            onClick={handleUnlock}
            className="w-full"
            disabled={isUnlocking}
          >
            {isUnlocking ? (
              'Redirecting to checkout...'
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Unlock Now - $99
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Secure payment via Stripe. 30-day money-back guarantee.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )

  return content
}
