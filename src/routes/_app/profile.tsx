import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  HardDrive,
  Key,
  Loader2,
  Shield,
  Sparkles,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react'
import { useSession } from '../../lib/auth-client'

// NOTE: Server functions are dynamically imported in mutationFn
// to prevent Prisma and other server-only code from being bundled into the client.
// See: https://tanstack.com/router/latest/docs/framework/react/start/server-functions
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog'

// Type for user
interface ProfileUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  role?: string
}

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
})

function ProfilePage() {
  const routeContext = Route.useRouteContext()
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [success, setSuccess] = useState(false)

  // User from session takes precedence, fallback to route context
  const sessionUser = session?.user as ProfileUser | undefined
  const contextUser = routeContext.user as ProfileUser | undefined
  const user = sessionUser ?? contextUser
  const userName = user?.name || ''
  const userEmail = user?.email || ''
  const userRole = user?.role || 'user'

  // Get platform status
  const { data: platformStatus } = useQuery({
    queryKey: ['platform-status'],
    queryFn: async () => {
      const { getPlatformStatusFn } =
        await import('../../server/billing.server')
      return getPlatformStatusFn()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (input: { name: string }) => {
      const { updateProfileFn } = await import('../../server/auth.server')
      return updateProfileFn({ data: input })
    },
    onSuccess: () => {
      setSuccess(true)
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      setTimeout(() => setSuccess(false), 3000)
    },
  })

  const form = useForm({
    defaultValues: {
      name: userName,
    },
    onSubmit: ({ value }) => {
      updateMutation.mutate(value)
    },
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Platform Access Status */}
      <div className="max-w-2xl rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Platform Access
        </h2>

        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Lifetime Access Active</p>
                <p className="text-sm text-muted-foreground">
                  {platformStatus?.isAdmin
                    ? 'Admin account - full access'
                    : platformStatus?.purchaseDate
                      ? `Purchased on ${new Date(platformStatus.purchaseDate).toLocaleDateString()}`
                      : 'You have full access to Cinevido'}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600">
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="max-w-2xl rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Personal Information</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-6"
        >
          {success && (
            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
              Profile updated successfully!
            </div>
          )}

          {updateMutation.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {updateMutation.error.message}
            </div>
          )}

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={userEmail}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => {
                const result = profileSchema.shape.name.safeParse(value)
                return result.success
                  ? undefined
                  : result.error.issues[0]?.message
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors.join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={userRole} disabled className="bg-muted capitalize" />
          </div>

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </div>

      {/* fal.ai Connection (BYOK) */}
      <FalApiKeySection />

      {/* Bunny.net Storage Configuration */}
      <BunnyStorageSection />
    </div>
  )
}

// =============================================================================
// fal.ai API Key Management Section
// =============================================================================

function FalApiKeySection() {
  const queryClient = useQueryClient()
  const [newApiKey, setNewApiKey] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Get BYOK status
  // Dynamic import to prevent server code from being bundled into client
  const { data: byokStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['byok-status'],
    queryFn: async () => {
      const { getByokStatusFn } = await import('../../server/byok.server')
      return getByokStatusFn()
    },
  })

  // Get fal.ai usage
  // Dynamic import to prevent server code from being bundled into client
  const { data: falUsage } = useQuery({
    queryKey: ['fal-usage'],
    queryFn: async () => {
      const { getFalUsageFn } = await import('../../server/byok.server')
      return getFalUsageFn()
    },
    enabled: !!byokStatus?.hasApiKey,
    refetchInterval: 60000, // Refresh every minute
  })

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const { testApiKeyConnectionFn } =
        await import('../../server/byok.server')
      return testApiKeyConnectionFn()
    },
    onSuccess: (data) => {
      if (data.connected) {
        setSuccessMessage('Connection successful!')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError('Connection failed. Your API key may be invalid.')
      }
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  // Save API key mutation
  const saveMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const { saveApiKeyFn } = await import('../../server/byok.server')
      return saveApiKeyFn({ data: { apiKey } })
    },
    onSuccess: () => {
      setNewApiKey('')
      setIsUpdating(false)
      setSuccessMessage('API key saved successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
      void queryClient.invalidateQueries({ queryKey: ['byok-status'] })
      void queryClient.invalidateQueries({ queryKey: ['fal-usage'] })
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  // Remove API key mutation
  const removeMutation = useMutation({
    mutationFn: async () => {
      const { removeApiKeyFn } = await import('../../server/byok.server')
      return removeApiKeyFn()
    },
    onSuccess: () => {
      setSuccessMessage('API key removed')
      setTimeout(() => setSuccessMessage(null), 3000)
      void queryClient.invalidateQueries({ queryKey: ['byok-status'] })
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSaveKey = () => {
    if (!newApiKey.trim()) {
      setError('Please enter an API key')
      return
    }
    setError(null)
    saveMutation.mutate(newApiKey)
  }

  if (statusLoading) {
    return (
      <div className="max-w-2xl rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    )
  }

  // User has platform access - show API key management
  return (
    <div className="max-w-2xl rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
        <Key className="h-5 w-5" />
        fal.ai Connection
      </h2>

      {/* Success/Error messages */}
      {successMessage && (
        <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-auto p-1"
            onClick={() => setError(null)}
          >
            &times;
          </Button>
        </div>
      )}

      {byokStatus?.hasApiKey && !isUpdating ? (
        // Show connected state
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Connected</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    API Key: {byokStatus.apiKeyLastFour}
                  </p>
                </div>
              </div>

              {/* Usage display */}
              {falUsage && (
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      ${falUsage.monthlyUsage.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">this month</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUpdating(true)}
            >
              <Key className="mr-2 h-4 w-4" />
              Update Key
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open('https://fal.ai/dashboard/billing', '_blank')
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View on fal.ai
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove Key
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove API Key?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove your fal.ai API key. You won't be able to
                    generate content until you add a new key.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => removeMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remove Key
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : (
        // Show setup/update form
        <div className="space-y-4">
          {!byokStatus?.hasApiKey && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-4 mb-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Connect your fal.ai API key to start generating AI content. Get
                your key from{' '}
                <a
                  href="https://fal.ai/dashboard/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  fal.ai dashboard
                </a>
                .
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="api-key">fal.ai API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="fal-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={newApiKey}
              onChange={(e) => {
                setNewApiKey(e.target.value)
                setError(null)
              }}
              className="font-mono"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSaveKey}
              disabled={!newApiKey.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save API Key'
              )}
            </Button>

            {isUpdating && (
              <Button
                variant="outline"
                onClick={() => {
                  setIsUpdating(false)
                  setNewApiKey('')
                  setError(null)
                }}
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Your key is encrypted and stored securely</span>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Bunny.net Storage Configuration Section
// =============================================================================

function BunnyStorageSection() {
  const queryClient = useQueryClient()
  const [storageZone, setStorageZone] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [cdnUrl, setCdnUrl] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Get storage config status
  const { data: storageStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['storage-config-status'],
    queryFn: async () => {
      const { getStorageConfigStatusFn } =
        await import('../../server/storage-config.server')
      return getStorageConfigStatusFn()
    },
  })

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const { testStorageConnectionFn } =
        await import('../../server/storage-config.server')
      return testStorageConnectionFn()
    },
    onSuccess: (data) => {
      if (data.connected) {
        setSuccessMessage('Storage connection successful!')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError('Connection failed. Please check your credentials.')
      }
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  // Save storage config mutation
  const saveMutation = useMutation({
    mutationFn: async (input: {
      storageZone: string
      apiKey: string
      cdnUrl: string
    }) => {
      const { saveStorageConfigFn } =
        await import('../../server/storage-config.server')
      return saveStorageConfigFn({ data: input })
    },
    onSuccess: () => {
      setStorageZone('')
      setApiKey('')
      setCdnUrl('')
      setIsUpdating(false)
      setSuccessMessage('Storage configuration saved!')
      setTimeout(() => setSuccessMessage(null), 3000)
      void queryClient.invalidateQueries({
        queryKey: ['storage-config-status'],
      })
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  // Remove storage config mutation
  const removeMutation = useMutation({
    mutationFn: async () => {
      const { removeStorageConfigFn } =
        await import('../../server/storage-config.server')
      return removeStorageConfigFn()
    },
    onSuccess: () => {
      setSuccessMessage('Storage configuration removed')
      setTimeout(() => setSuccessMessage(null), 3000)
      void queryClient.invalidateQueries({
        queryKey: ['storage-config-status'],
      })
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSave = () => {
    if (!storageZone.trim() || !apiKey.trim() || !cdnUrl.trim()) {
      setError('All fields are required')
      return
    }
    // Basic CDN URL validation
    if (!cdnUrl.startsWith('https://')) {
      setError('CDN URL must start with https://')
      return
    }
    if (cdnUrl.endsWith('/')) {
      setError('CDN URL should not end with a trailing slash')
      return
    }
    setError(null)
    saveMutation.mutate({ storageZone, apiKey, cdnUrl })
  }

  if (statusLoading) {
    return (
      <div className="max-w-2xl rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
        <HardDrive className="h-5 w-5" />
        Storage Configuration
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect your own Bunny.net storage to store generated assets in your
        account. Without this, assets are stored on the platform's storage.
      </p>

      {/* Success/Error messages */}
      {successMessage && (
        <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-auto p-1"
            onClick={() => setError(null)}
          >
            &times;
          </Button>
        </div>
      )}

      {storageStatus?.hasStorageConfig && !isUpdating ? (
        // Connected state
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">Connected</p>
                <p className="text-sm text-muted-foreground">
                  Zone:{' '}
                  <span className="font-mono">{storageStatus.storageZone}</span>
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  CDN: <span className="font-mono">{storageStatus.cdnUrl}</span>
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  API Key: {storageStatus.apiKeyLastFour}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUpdating(true)}
            >
              <HardDrive className="mr-2 h-4 w-4" />
              Update
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open('https://dash.bunny.net/storage', '_blank')
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Bunny Dashboard
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Storage Config?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove your Bunny.net storage configuration. New
                    assets will be stored on the platform's default storage.
                    Existing assets on your storage will remain accessible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => removeMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : (
        // Setup/update form
        <div className="space-y-4">
          {!storageStatus?.hasStorageConfig && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-4 mb-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                To use your own storage, create a storage zone and pull zone on{' '}
                <a
                  href="https://dash.bunny.net/storage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Bunny.net
                </a>
                . You'll need the storage zone name, API key, and CDN URL.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="storage-zone">Storage Zone Name</Label>
            <Input
              id="storage-zone"
              type="text"
              placeholder="my-storage-zone"
              value={storageZone}
              onChange={(e) => {
                setStorageZone(e.target.value)
                setError(null)
              }}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bunny-api-key">Storage API Key</Label>
            <Input
              id="bunny-api-key"
              type="password"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxx-xxxx-xxxx"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                setError(null)
              }}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cdn-url">CDN URL</Label>
            <Input
              id="cdn-url"
              type="url"
              placeholder="https://my-zone.b-cdn.net"
              value={cdnUrl}
              onChange={(e) => {
                setCdnUrl(e.target.value)
                setError(null)
              }}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The pull zone URL without trailing slash
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={
                !storageZone.trim() ||
                !apiKey.trim() ||
                !cdnUrl.trim() ||
                saveMutation.isPending
              }
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating & Saving...
                </>
              ) : (
                'Save Storage Config'
              )}
            </Button>

            {isUpdating && (
              <Button
                variant="outline"
                onClick={() => {
                  setIsUpdating(false)
                  setStorageZone('')
                  setApiKey('')
                  setCdnUrl('')
                  setError(null)
                }}
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Your API key is encrypted and stored securely</span>
          </div>
        </div>
      )}
    </div>
  )
}
