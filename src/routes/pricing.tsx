import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { z } from 'zod'
import {
  Check,
  CreditCard,
  Infinity as InfinityIcon,
  Key,
  Loader2,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useSession } from '../lib/auth-client'
import { Button } from '../components/ui/button'

// Search params validation for auto-checkout flow
// Search schema that handles both string and boolean values for auto_checkout
// This is needed because TanStack Router's Link component may serialize booleans differently
const searchSchema = z.object({
  auto_checkout: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => (v === true || v === 'true' ? 'true' : undefined)),
  checkout_error: z.string().optional(),
  canceled: z.string().optional(),
})

export const Route = createFileRoute('/pricing')({
  validateSearch: searchSchema,
  component: PricingPage,
})

function PricingPage() {
  const navigate = useNavigate()
  const { auto_checkout } = Route.useSearch()
  const { data: session, isPending: sessionLoading } = useSession()
  const isLoggedIn = !!session?.user
  const autoCheckoutTriggered = useRef(false)

  // Check if user already has platform access
  const { data: platformStatus, isLoading: platformStatusLoading } = useQuery({
    queryKey: ['platform-status'],
    queryFn: async () => {
      const { getPlatformStatusFn } = await import('../server/billing.server')
      return getPlatformStatusFn()
    },
    enabled: isLoggedIn,
  })

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const { createPlatformCheckoutFn } =
        await import('../server/billing.server')
      return createPlatformCheckoutFn()
    },
    onSuccess: (data) => {
      window.location.href = data.url
    },
  })

  // Auto-trigger checkout when redirected from signup with auto_checkout flag
  useEffect(() => {
    if (
      auto_checkout === 'true' &&
      isLoggedIn &&
      !sessionLoading &&
      !platformStatusLoading &&
      !platformStatus?.hasPlatformAccess &&
      !checkoutMutation.isPending &&
      !autoCheckoutTriggered.current
    ) {
      autoCheckoutTriggered.current = true
      checkoutMutation.mutate()
    }
  }, [
    auto_checkout,
    isLoggedIn,
    sessionLoading,
    platformStatusLoading,
    platformStatus?.hasPlatformAccess,
    checkoutMutation.isPending,
  ])

  const handleGetAccess = () => {
    if (!isLoggedIn) {
      // Redirect to signup with checkout redirect
      navigate({ to: '/signup', search: { redirect: 'checkout' } })
      return
    }

    if (platformStatus?.hasPlatformAccess) {
      // Already has access, go to dashboard
      navigate({ to: '/dashboard' })
      return
    }

    // Start checkout
    checkoutMutation.mutate()
  }

  const hasAccess = platformStatus?.hasPlatformAccess
  const isAutoCheckoutInProgress =
    auto_checkout === 'true' && checkoutMutation.isPending

  // Show loading screen during auto-checkout
  if (isAutoCheckoutInProgress) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Preparing checkout...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Cinevido</span>
          </Link>
          <nav className="flex items-center space-x-4">
            {sessionLoading ? (
              // Show placeholder while loading to avoid hydration mismatch
              <div className="h-9 w-20" />
            ) : isLoggedIn ? (
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Zap className="h-4 w-4" />
              One-Time Payment, Lifetime Access
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Unlock Cinevido
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Create stunning AI-generated images, videos, and 3D models. Pay
              once, use forever. Bring your own fal.ai API key.
            </p>
          </div>

          {/* Pricing Card */}
          <div className="mx-auto max-w-lg">
            <div className="relative rounded-2xl border-2 border-primary bg-card p-8 shadow-xl">
              {/* Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="rounded-full bg-primary px-4 py-1 text-sm font-semibold text-primary-foreground shadow-lg">
                  Lifetime Access
                </div>
              </div>

              <div className="text-center mb-8 pt-4">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold">$149</span>
                  <span className="text-muted-foreground">/one-time</span>
                </div>
                <p className="mt-2 text-muted-foreground">
                  No subscriptions. No hidden fees.
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                <PricingFeature icon={InfinityIcon}>
                  Unlimited AI generations
                </PricingFeature>
                <PricingFeature icon={Sparkles}>
                  All AI models included (Flux Pro, Kling, Luma, etc.)
                </PricingFeature>
                <PricingFeature icon={Key}>
                  Bring your own fal.ai API key (BYOK)
                </PricingFeature>
                <PricingFeature icon={CreditCard}>
                  Pay only for what you use on fal.ai
                </PricingFeature>
                <PricingFeature icon={Shield}>
                  Lifetime platform updates
                </PricingFeature>
                <PricingFeature icon={Check}>
                  Full access to all features
                </PricingFeature>
              </ul>

              {/* CTA Button */}
              {hasAccess ? (
                <Button
                  size="lg"
                  className="w-full text-lg h-14"
                  onClick={() => navigate({ to: '/dashboard' })}
                >
                  <Check className="mr-2 h-5 w-5" />
                  You Have Access - Go to Dashboard
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="w-full text-lg h-14"
                  onClick={handleGetAccess}
                  disabled={checkoutMutation.isPending || sessionLoading}
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Redirecting to checkout...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Get Lifetime Access - $149
                    </>
                  )}
                </Button>
              )}

              {!hasAccess && (
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Secure checkout powered by Stripe
                </p>
              )}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="border-t bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center text-3xl font-bold">
              How it Works
            </h2>
            <div className="mx-auto max-w-4xl grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                  1
                </div>
                <h3 className="mb-2 font-semibold">Pay Once</h3>
                <p className="text-sm text-muted-foreground">
                  Make a one-time payment of $149 to unlock lifetime access to
                  Cinevido.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                  2
                </div>
                <h3 className="mb-2 font-semibold">Connect fal.ai</h3>
                <p className="text-sm text-muted-foreground">
                  Create a free fal.ai account, add credits, and connect your
                  API key.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                  3
                </div>
                <h3 className="mb-2 font-semibold">Start Creating</h3>
                <p className="text-sm text-muted-foreground">
                  Generate unlimited AI content. You only pay fal.ai for actual
                  usage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="mb-12 text-center text-3xl font-bold">
            Frequently Asked Questions
          </h2>
          <div className="mx-auto max-w-2xl space-y-6">
            <FAQItem question="What is fal.ai and why do I need it?">
              fal.ai is a cloud platform that runs AI models. Cinevido uses
              fal.ai to generate images, videos, and 3D models. You bring your
              own fal.ai API key and pay them directly for usage (typically
              $0.01-0.20 per generation).
            </FAQItem>
            <FAQItem question="Is this really a one-time payment?">
              Yes! You pay $149 once and get lifetime access to Cinevido. No
              subscriptions, no recurring fees. The only ongoing cost is your
              fal.ai usage, which you pay directly to fal.ai.
            </FAQItem>
            <FAQItem question="How much does fal.ai cost?">
              fal.ai charges per generation: images are typically $0.01-0.05,
              videos $0.05-0.20, and 3D models $0.03-0.10. We recommend starting
              with $5-10 in credits.
            </FAQItem>
            <FAQItem question="What AI models are included?">
              All models available on fal.ai: Flux Pro, Flux Schnell for images;
              Kling 1.5, Luma for videos; Hunyuan 3D and more for 3D models.
              Plus any new models fal.ai adds in the future.
            </FAQItem>
            <FAQItem question="Do I get updates?">
              Yes! Your $149 payment includes all future updates to Cinevido.
              New features, UI improvements, and new model integrations are all
              included.
            </FAQItem>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Cinevido. All rights reserved.
          </p>
          <nav className="flex items-center space-x-4">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Home
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

function PricingFeature({
  children,
  icon: Icon,
}: {
  children: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <li className="flex items-center gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <span>{children}</span>
    </li>
  )
}

function FAQItem({
  question,
  children,
}: {
  question: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-2 font-semibold">{question}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
