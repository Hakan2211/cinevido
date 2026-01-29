import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
// NOTE: byok.fn imports are done dynamically to prevent server code from being
// bundled into the client. See below in beforeLoad and query functions.
import {
  CheckCircle2,
  ExternalLink,
  Key,
  Loader2,
  Shield,
  Wallet,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'

export const Route = createFileRoute('/_app/setup')({
  beforeLoad: async () => {
    // Dynamic import to prevent server code from being bundled into client
    const { getByokStatusFn } = await import('../../server/byok.server')

    // Check if user already has API key set up
    const status = await getByokStatusFn()

    // If user doesn't have platform access (and isn't admin), redirect to pricing
    // Note: This is redundant with _app.tsx check but provides extra safety
    if (!status.hasPlatformAccess) {
      throw redirect({ to: '/pricing' })
    }

    // If user already has API key, redirect to dashboard
    if (status.hasApiKey) {
      throw redirect({ to: '/dashboard' })
    }

    return { byokStatus: status }
  },
  component: SetupPage,
})

function SetupPage() {
  const navigate = useNavigate()
  const [apiKey, setApiKey] = useState('')
  const [step1Done, setStep1Done] = useState(false)
  const [step2Done, setStep2Done] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refresh BYOK status (in case it changes)
  // Dynamic import to prevent server code from being bundled into client
  useQuery({
    queryKey: ['byok-status'],
    queryFn: async () => {
      const { getByokStatusFn } = await import('../../server/byok.server')
      return getByokStatusFn()
    },
  })

  const validateMutation = useMutation({
    mutationFn: async (key: string) => {
      const { validateApiKeyFn } = await import('../../server/byok.server')
      return validateApiKeyFn({ data: { apiKey: key } })
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      const { saveApiKeyFn } = await import('../../server/byok.server')
      return saveApiKeyFn({ data: { apiKey: key } })
    },
    onSuccess: () => {
      navigate({ to: '/dashboard' })
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleValidateAndSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key')
      return
    }

    setError(null)

    // First validate
    const validation = await validateMutation.mutateAsync(apiKey)
    if (!validation.valid) {
      setError('Invalid API key. Please check your key and try again.')
      return
    }

    // Then save
    saveMutation.mutate(apiKey)
  }

  const isLoading = validateMutation.isPending || saveMutation.isPending

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="w-full max-w-2xl mx-auto">
        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Key className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome to Cinevido!</CardTitle>
            <CardDescription className="text-base">
              Let's connect your fal.ai account in 3 simple steps.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {/* Step 1: Create fal.ai Account */}
            <div
              className={`rounded-lg border p-4 transition-colors ${
                step1Done
                  ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      step1Done
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step1Done ? <CheckCircle2 className="h-5 w-5" /> : '1'}
                  </div>
                  <div>
                    <h3 className="font-semibold">Create fal.ai Account</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      If you don't have one yet, create a free account on fal.ai
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 ml-11 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://fal.ai', '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Create Free Account
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep1Done(true)}
                >
                  I already have an account
                </Button>
              </div>
            </div>

            {/* Step 2: Add Funds */}
            <div
              className={`rounded-lg border p-4 transition-colors ${
                step2Done
                  ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      step2Done
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step2Done ? <CheckCircle2 className="h-5 w-5" /> : '2'}
                  </div>
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Add Funds to fal.ai
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add credits to your fal.ai account. We recommend starting
                      with $5-10.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 ml-11">
                <div className="rounded-md bg-muted/50 p-3 mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Typical costs:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>Images: $0.01-0.05 each</li>
                    <li>Videos: $0.05-0.20 each</li>
                    <li>3D Models: $0.03-0.10 each</li>
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open('https://fal.ai/dashboard/billing', '_blank')
                    }
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Go to fal.ai Billing
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep2Done(true)}
                  >
                    I've added funds
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 3: Connect API Key */}
            <div className="rounded-lg border p-4 border-primary/50 bg-primary/5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Connect Your API Key
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Get your API key from fal.ai and paste it below.
                  </p>
                </div>
              </div>

              <div className="mt-4 ml-11 space-y-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open('https://fal.ai/dashboard/keys', '_blank')
                  }
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Get API Key from fal.ai
                </Button>

                <div className="space-y-2">
                  <Label htmlFor="api-key">Your fal.ai API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="fal-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value)
                      setError(null)
                    }}
                    className="font-mono"
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <Button
                  onClick={handleValidateAndSave}
                  disabled={!apiKey.trim() || isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {validateMutation.isPending
                        ? 'Validating...'
                        : 'Saving...'}
                    </>
                  ) : (
                    'Verify & Connect'
                  )}
                </Button>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  <span>Your key is encrypted and stored securely</span>
                </div>
              </div>
            </div>

            {/* Skip option */}
            <div className="text-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: '/dashboard' })}
                className="text-muted-foreground"
              >
                Skip for now (you can set this up later in Settings)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
