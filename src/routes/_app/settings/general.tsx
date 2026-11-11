import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from '@/lib/auth-client'
import {
  InlineMessage,
  SettingsCard,
  SettingsHeader,
} from '@/components/settings/SettingsCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_app/settings/general')({
  component: GeneralPage,
})

function GeneralPage() {
  const context = Route.useRouteContext()
  const { data: session } = useSession()
  const user = session?.user ?? context.user
  const queryClient = useQueryClient()
  const [name, setName] = useState(user.name ?? '')

  const save = useMutation({
    mutationFn: async (input: { name: string }) => {
      const { updateProfileFn } = await import('@/server/auth.server')
      return updateProfileFn({ data: input })
    },
    onSuccess: () => {
      toast.success('Profile saved')
      void queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })

  const trimmed = name.trim()
  const invalid = trimmed.length === 0 || trimmed.length > 100

  return (
    <div>
      <SettingsHeader title="General" description="Your account details." />
      <SettingsCard icon={UserRound} title="Profile" className="max-w-2xl">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!invalid) save.mutate({ name: trimmed })
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} disabled />
            <p className="text-xs text-muted-foreground">
              Your sign-in email can&apos;t be changed here.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={invalid || save.isPending}>
              {save.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
            {save.error && (
              <InlineMessage tone="error">{save.error.message}</InlineMessage>
            )}
          </div>
        </form>
      </SettingsCard>
    </div>
  )
}
