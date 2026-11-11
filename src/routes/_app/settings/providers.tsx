import { createFileRoute } from '@tanstack/react-router'
import { SettingsHeader } from '@/components/settings/SettingsCard'
import {
  BillingKeyCard,
  FalKeyCard,
  StorageCard,
} from '@/components/settings/ProviderCards'
import { UsageSection } from '@/components/settings/UsageSection'

export const Route = createFileRoute('/_app/settings/providers')({
  component: ProvidersPage,
})

function ProvidersPage() {
  const { user } = Route.useRouteContext()
  return (
    <div>
      <SettingsHeader
        title="Providers"
        description="Connect the accounts Cinevido runs on and keep an eye on what it costs."
      />
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <FalKeyCard isAdmin={user.role === 'admin'} />
          <BillingKeyCard />
        </div>
        <UsageSection />
        <StorageCard />
      </div>
    </div>
  )
}
