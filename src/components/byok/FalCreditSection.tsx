/**
 * Profile card: connect a read-only fal key so the app can show the credit
 * balance. Kept separate from the generation key on purpose — the balance
 * endpoint needs `billing:usage:read`, which normal generation keys lack, and a
 * read-only key cannot spend anything if it ever leaks.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Trash2,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { useFalCredits } from './CreditBalance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatUsd } from '@/lib/pricing'

export function FalCreditSection() {
  const queryClient = useQueryClient()
  const [newKey, setNewKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: status } = useQuery({
    queryKey: ['byok-status'],
    queryFn: async () => {
      const { getByokStatusFn } = await import('@/server/byok.server')
      return getByokStatusFn()
    },
  })
  const { data: credits, isLoading: creditsLoading } = useFalCredits()

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['byok-status'] })
    void queryClient.invalidateQueries({ queryKey: ['falCredits'] })
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
    onError: (err: Error) => setError(err.message),
  })

  const hasKey = !!status?.billingKeyLastFour

  return (
    <div className="max-w-2xl rounded-lg border bg-card p-6">
      <h2 className="mb-1 text-xl font-semibold flex items-center gap-2">
        <Wallet className="h-5 w-5" />
        Credit balance
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Shows your fal.ai balance in the sidebar. Uses a separate{' '}
        <strong>read-only</strong> key (fal&apos;s READONLY or BILLING preset)
        that can see billing but cannot run or pay for anything.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {hasKey ? (
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/50 p-4">
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {creditsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : credits?.status === 'ok' ? (
                formatUsd(credits.balance)
              ) : (
                '—'
              )}
            </p>
            <p className="text-sm text-muted-foreground font-mono">
              Billing key: {status.billingKeyLastFour}
              {credits?.status === 'forbidden' &&
                ' · this key can no longer read billing'}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open('https://fal.ai/dashboard/billing', '_blank')
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Top up on fal.ai
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (newKey.trim()) save.mutate(newKey.trim())
          }}
        >
          <Input
            type="password"
            placeholder="Read-only fal key (key_id:key_secret)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            autoComplete="off"
            className="font-mono"
          />
          <Button type="submit" disabled={!newKey.trim() || save.isPending}>
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Connect'
            )}
          </Button>
        </form>
      )}
      {!hasKey && (
        <p className="mt-2 text-xs text-muted-foreground">
          Create one at{' '}
          <a
            href="https://fal.ai/dashboard/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            fal.ai/dashboard/keys
          </a>{' '}
          with the READONLY preset.
        </p>
      )}
    </div>
  )
}
