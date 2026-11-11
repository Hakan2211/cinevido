import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui/button'
import { PriceDriftCard } from '../../components/admin/PriceDriftCard'

// NOTE: Server functions are dynamically imported in queryFn/mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions

// Type for users returned from listUsersFn
interface AdminUser {
  id: string
  email: string
  name: string | null
  role: string
  emailVerified: boolean
  createdAt: Date
  subscriptionStatus: string | null
}

export const Route = createFileRoute('/_app/admin')({
  beforeLoad: ({ context }) => {
    // Additional admin check (middleware already checks in server functions)
    const user = context.user as { role?: string } | undefined
    if (user?.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminPage,
})

function AdminPage() {
  const queryClient = useQueryClient()

  const { data: users, isLoading } = useQuery<Array<AdminUser>>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { listUsersFn } = await import('../../server/auth.server')
      return listUsersFn() as Promise<Array<AdminUser>>
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: async (input: { userId: string; role: 'user' | 'admin' }) => {
      const { updateUserRoleFn } = await import('../../server/auth.server')
      return updateUserRoleFn({ data: input })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Users and catalog health</p>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold">Users</h2>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground">
            Loading users...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user: AdminUser) => (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-6 py-4 text-sm">{user.email}</td>
                    <td className="px-6 py-4 text-sm">{user.name ?? '-'}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.emailVerified
                            ? 'bg-success/15 text-success'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {user.emailVerified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.subscriptionStatus === 'active'
                            ? 'bg-success/15 text-success'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {user.subscriptionStatus ?? 'Free'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateRoleMutation.mutate({
                            userId: user.id,
                            role: user.role === 'admin' ? 'user' : 'admin',
                          })
                        }
                        disabled={updateRoleMutation.isPending}
                      >
                        {user.role === 'admin' ? 'Demote' : 'Promote'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PriceDriftCard />

      {/* System Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Total Users
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {users?.length ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Admins</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {users?.filter((u: AdminUser) => u.role === 'admin').length ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Pro Subscribers
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {users?.filter((u: AdminUser) => u.subscriptionStatus === 'active')
              .length ?? 0}
          </p>
        </div>
      </div>
    </div>
  )
}
