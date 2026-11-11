/**
 * Settings → Providers: the fal generation key, the optional read-only fal
 * billing key, and the optional Bunny.net storage.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink,
  HardDrive,
  KeyRound,
  Loader2,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  InlineMessage,
  MaskedKey,
  SettingsCard,
  StatusBadge,
} from './SettingsCard'
import { useFalCredits } from '@/components/byok'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatUsd } from '@/lib/pricing'

export function useByokStatus() {
  return useQuery({
    queryKey: ['byok-status'],
    queryFn: async () => {
      const { getByokStatusFn } = await import('@/server/byok.server')
      return getByokStatusFn()
    },
  })
}

// =============================================================================
// fal API key
// =============================================================================

export function FalKeyCard({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient()
  const { data: status, isLoading } = useByokStatus()
  const [replacing, setReplacing] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const test = useMutation({
    mutationFn: async () => {
      const { testApiKeyConnectionFn } = await import('@/server/byok.server')
      return testApiKeyConnectionFn()
    },
  })

  const save = useMutation({
    mutationFn: async (apiKey: string) => {
      const { saveApiKeyFn } = await import('@/server/byok.server')
      return saveApiKeyFn({ data: { apiKey } })
    },
    onSuccess: () => {
      setNewKey('')
      setReplacing(false)
      setError(null)
      test.reset()
      toast.success('fal key saved')
      void queryClient.invalidateQueries({ queryKey: ['byok-status'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { removeApiKeyFn } = await import('@/server/byok.server')
      return removeApiKeyFn()
    },
    onSuccess: () => {
      test.reset()
      toast.success('fal key removed')
      void queryClient.invalidateQueries({ queryKey: ['byok-status'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const hasKey = !!status?.hasApiKey
  const showForm = !hasKey || replacing

  return (
    <SettingsCard
      icon={KeyRound}
      title="fal"
      badge={
        !isLoading && (
          <StatusBadge
            ok={hasKey}
            label={hasKey ? 'Connected' : 'Not connected'}
          />
        )
      }
      description="Runs every image, video, audio and 3D generation — on your own fal account."
      actions={
        hasKey &&
        !replacing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmRemove(true)}
            disabled={remove.isPending}
          >
            Remove
          </Button>
        )
      }
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : showForm ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (newKey.trim()) save.mutate(newKey.trim())
          }}
        >
          <Label htmlFor="fal-key">API key</Label>
          <div className="flex gap-2">
            <Input
              id="fal-key"
              type="password"
              autoComplete="off"
              placeholder="key_id:key_secret"
              value={newKey}
              onChange={(e) => {
                setNewKey(e.target.value)
                setError(null)
              }}
              className="font-mono"
            />
            <Button type="submit" disabled={!newKey.trim() || save.isPending}>
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Save'
              )}
            </Button>
            {replacing && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setReplacing(false)
                  setNewKey('')
                  setError(null)
                }}
              >
                Cancel
              </Button>
            )}
          </div>
          {error ? (
            <InlineMessage tone="error">{error}</InlineMessage>
          ) : (
            <p className="text-xs text-muted-foreground">
              Create one at{' '}
              <a
                href="https://fal.ai/dashboard/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                fal.ai/dashboard/keys
              </a>
              . We check it with fal, then store it encrypted.
            </p>
          )}
        </form>
      ) : (
        <div className="space-y-3">
          <div>
            <Label className="mb-2 block">API key</Label>
            <MaskedKey lastFour={status?.apiKeyLastFour ?? null} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => test.mutate()}
              disabled={test.isPending}
            >
              {test.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Test connection
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplacing(true)}
            >
              Replace key
            </Button>
            <div className="ml-auto">
              {test.data &&
                (test.data.connected ? (
                  <InlineMessage tone="ok">Connection healthy</InlineMessage>
                ) : (
                  <InlineMessage tone="error">
                    fal rejected this key
                  </InlineMessage>
                ))}
              {test.error && (
                <InlineMessage tone="error">{test.error.message}</InlineMessage>
              )}
            </div>
          </div>
        </div>
      )}
      {isAdmin && (
        <p className="mt-3 text-xs text-muted-foreground">
          Admin: while the server has a <code>FAL_KEY</code>, your generations
          run on it instead of this key.
        </p>
      )}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove your fal key?"
        description="You won't be able to generate anything until you add a key again."
        confirmText="Remove key"
        variant="destructive"
        onConfirm={() => remove.mutate()}
      />
    </SettingsCard>
  )
}

// =============================================================================
// Read-only billing key
// =============================================================================

/**
 * A second, read-only fal key (READONLY or BILLING preset) used only to read
 * the credit balance and usage. Kept apart from the generation key: the
 * billing endpoints need `billing:usage:read`, which generation keys lack, and
 * a read-only key can't spend anything if it leaks.
 */
export function BillingKeyCard() {
  const queryClient = useQueryClient()
  const { data: status } = useByokStatus()
  const { data: credits } = useFalCredits()
  const [newKey, setNewKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['byok-status'] })
    void queryClient.invalidateQueries({ queryKey: ['falCredits'] })
    void queryClient.invalidateQueries({ queryKey: ['usage'] })
  }

  const save = useMutation({
    mutationFn: async (apiKey: string) => {
      const { saveBillingKeyFn } = await import('@/server/byok.server')
      return saveBillingKeyFn({ data: { apiKey } })
    },
    onSuccess: () => {
      setNewKey('')
      setError(null)
      toast.success('Billing key connected')
      refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { removeBillingKeyFn } = await import('@/server/byok.server')
      return removeBillingKeyFn()
    },
    onSuccess: () => {
      toast.success('Billing key removed')
      refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const hasKey = !!status?.billingKeyLastFour
  // admins without their own key read the server's FAL_BILLING_KEY
  const serverKey = !hasKey && credits?.status === 'ok'

  return (
    <SettingsCard
      icon={Wallet}
      title="Billing key"
      badge={
        <span className="text-xs text-muted-foreground">
          read-only · optional
        </span>
      }
      description="Shows your fal balance and real monthly spend. It can read billing but can't run or pay for anything."
      actions={
        hasKey && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            Remove
          </Button>
        )
      }
    >
      {hasKey ? (
        <div className="space-y-2">
          <Label className="block">Billing key</Label>
          <MaskedKey lastFour={status.billingKeyLastFour} />
          {credits?.status === 'forbidden' ? (
            <InlineMessage tone="error">
              This key can no longer read billing — replace it.
            </InlineMessage>
          ) : credits?.status === 'ok' ? (
            <InlineMessage tone="ok">
              Reading balance · {formatUsd(credits.balance)}
            </InlineMessage>
          ) : null}
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (newKey.trim()) save.mutate(newKey.trim())
          }}
        >
          <Label htmlFor="billing-key">Billing key</Label>
          <div className="flex gap-2">
            <Input
              id="billing-key"
              type="password"
              autoComplete="off"
              placeholder="Read-only key (key_id:key_secret)"
              value={newKey}
              onChange={(e) => {
                setNewKey(e.target.value)
                setError(null)
              }}
              className="font-mono"
            />
            <Button type="submit" disabled={!newKey.trim() || save.isPending}>
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Connect'
              )}
            </Button>
          </div>
          {error ? (
            <InlineMessage tone="error">{error}</InlineMessage>
          ) : (
            <p className="text-xs text-muted-foreground">
              {serverKey
                ? 'Admin: using the server’s FAL_BILLING_KEY until you add your own. '
                : ''}
              Create one at{' '}
              <a
                href="https://fal.ai/dashboard/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                fal.ai/dashboard/keys
              </a>{' '}
              with the READONLY preset.
            </p>
          )}
        </form>
      )}
    </SettingsCard>
  )
}

// =============================================================================
// Bunny.net storage
// =============================================================================

export function StorageCard() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [zone, setZone] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [cdnUrl, setCdnUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const { data: status, isLoading } = useQuery({
    queryKey: ['storage-config-status'],
    queryFn: async () => {
      const { getStorageConfigStatusFn } =
        await import('@/server/storage-config.server')
      return getStorageConfigStatusFn()
    },
  })
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['storage-config-status'] })

  const test = useMutation({
    mutationFn: async () => {
      const { testStorageConnectionFn } =
        await import('@/server/storage-config.server')
      return testStorageConnectionFn()
    },
  })

  const save = useMutation({
    mutationFn: async (input: {
      storageZone: string
      apiKey: string
      cdnUrl: string
    }) => {
      const { saveStorageConfigFn } =
        await import('@/server/storage-config.server')
      return saveStorageConfigFn({ data: input })
    },
    onSuccess: () => {
      setZone('')
      setApiKey('')
      setCdnUrl('')
      setEditing(false)
      setError(null)
      test.reset()
      toast.success('Storage connected')
      invalidate()
    },
    onError: (err: Error) => setError(err.message),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { removeStorageConfigFn } =
        await import('@/server/storage-config.server')
      return removeStorageConfigFn()
    },
    onSuccess: () => {
      test.reset()
      toast.success('Storage removed')
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSave = () => {
    const url = cdnUrl.trim()
    if (!zone.trim() || !apiKey.trim() || !url) {
      setError('All three fields are required')
      return
    }
    if (!url.startsWith('https://')) {
      setError('The CDN URL must start with https://')
      return
    }
    setError(null)
    save.mutate({
      storageZone: zone.trim(),
      apiKey: apiKey.trim(),
      cdnUrl: url.replace(/\/+$/, ''),
    })
  }

  const connected = !!status?.hasStorageConfig
  const showForm = !connected || editing

  return (
    <SettingsCard
      icon={HardDrive}
      title="Bunny storage"
      badge={
        !isLoading && (
          <StatusBadge
            ok={connected}
            label={connected ? 'Connected' : 'Using Cinevido storage'}
          />
        )
      }
      description="Optional. Keep generated files in your own Bunny.net storage zone instead of ours."
      actions={
        connected &&
        !editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmRemove(true)}
            disabled={remove.isPending}
          >
            Remove
          </Button>
        )
      }
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : showForm ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bunny-zone">Storage zone</Label>
              <Input
                id="bunny-zone"
                placeholder="my-storage-zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bunny-key">Storage API key</Label>
              <Input
                id="bunny-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bunny-cdn">CDN URL</Label>
              <Input
                id="bunny-cdn"
                type="url"
                placeholder="https://my-zone.b-cdn.net"
                value={cdnUrl}
                onChange={(e) => setCdnUrl(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Check & save
            </Button>
            {editing && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(false)
                  setError(null)
                }}
              >
                Cancel
              </Button>
            )}
            {error && <InlineMessage tone="error">{error}</InlineMessage>}
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Zone</dt>
            <dd className="font-mono">{status.storageZone}</dd>
            <dt className="text-muted-foreground">CDN</dt>
            <dd className="truncate font-mono">{status.cdnUrl}</dd>
            <dt className="text-muted-foreground">API key</dt>
            <dd className="font-mono">
              ••••{status.apiKeyLastFour?.replace(/^\.+/, '')}
            </dd>
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => test.mutate()}
              disabled={test.isPending}
            >
              {test.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Test connection
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Change
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://dash.bunny.net/storage"
                target="_blank"
                rel="noopener noreferrer"
              >
                Bunny dashboard
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
            <div className="ml-auto">
              {test.data &&
                (test.data.connected ? (
                  <InlineMessage tone="ok">Connection healthy</InlineMessage>
                ) : (
                  <InlineMessage tone="error">
                    Bunny rejected these credentials
                  </InlineMessage>
                ))}
              {test.error && (
                <InlineMessage tone="error">{test.error.message}</InlineMessage>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove your storage?"
        description="New files go to Cinevido's storage. Files already in your zone stay where they are and keep working."
        confirmText="Remove"
        variant="destructive"
        onConfirm={() => remove.mutate()}
      />
    </SettingsCard>
  )
}
