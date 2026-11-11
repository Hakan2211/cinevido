import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Sparkles, Wallet } from 'lucide-react'
import {
  SettingsCard,
  SettingsHeader,
  StatusBadge,
} from '@/components/settings/SettingsCard'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_app/settings/billing')({
  component: BillingPage,
})

function BillingPage() {
  const { data: platform, isLoading } = useQuery({
    queryKey: ['platform-status'],
    queryFn: async () => {
      const { getPlatformStatusFn } = await import('@/server/billing.server')
      return getPlatformStatusFn()
    },
  })

  const active = !!platform?.hasPlatformAccess

  return (
    <div>
      <SettingsHeader
        title="Plans & Billing"
        description="Your Cinevido plan. Generations are billed by fal, on your own fal account."
      />
      <div className="max-w-2xl space-y-4">
        <SettingsCard
          icon={Sparkles}
          title="Cinevido lifetime access"
          badge={
            !isLoading && (
              <StatusBadge
                ok={active}
                label={active ? 'Active' : 'Not purchased'}
              />
            )
          }
          description={
            isLoading
              ? 'Checking…'
              : platform?.isAdmin
                ? 'Admin account — full access.'
                : active
                  ? platform.purchaseDate
                    ? `One-time purchase on ${new Date(platform.purchaseDate).toLocaleDateString()}. No subscription, nothing renews.`
                    : 'One-time purchase. No subscription, nothing renews.'
                  : 'A one-time purchase unlocks the studio for good.'
          }
          actions={
            !isLoading &&
            !active && (
              <Button asChild>
                <Link to="/pricing">See pricing</Link>
              </Button>
            )
          }
        />
        <SettingsCard
          icon={Wallet}
          title="Generation credits"
          description="Images, video, audio and 3D run on your fal key and are paid from your fal balance. Balance, spend and per-job costs are under Providers."
          actions={
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings/providers">Usage</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://fal.ai/dashboard/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Top up on fal
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            </>
          }
        />
      </div>
    </div>
  )
}
