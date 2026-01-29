import Stripe from 'stripe'

/**
 * Stripe Adapter Pattern
 * - When MOCK_PAYMENTS=true or no STRIPE_SECRET_KEY, returns mock responses
 * - This allows development without Stripe credentials
 *
 * NOTE: prisma is dynamically imported inside functions to prevent server-only
 * code from being bundled into the client during dev mode.
 */

async function getPrisma() {
  const { prisma } = await import('../db.server')
  return prisma
}

const MOCK_PAYMENTS = process.env.MOCK_PAYMENTS === 'true'

// Initialize Stripe only if we have a key and not in mock mode
function getStripeClient(): Stripe | null {
  if (MOCK_PAYMENTS) return null
  if (!process.env.STRIPE_SECRET_KEY) return null
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export interface CheckoutResult {
  url: string
}

export interface PlatformStatus {
  hasPlatformAccess: boolean
  purchaseDate: Date | null
}

/**
 * Get platform access status for a user
 */
export async function getPlatformStatus(
  userId: string,
): Promise<PlatformStatus> {
  const stripe = getStripeClient()

  if (!stripe) {
    // In mock mode, always return active platform access
    return { hasPlatformAccess: true, purchaseDate: new Date() }
  }

  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { id: userId } })

  return {
    hasPlatformAccess: user?.hasPlatformAccess ?? false,
    purchaseDate: user?.platformPurchaseDate ?? null,
  }
}

export async function handleWebhook(
  payload: string,
  signature: string,
): Promise<{ received: boolean }> {
  const stripe = getStripeClient()

  if (!stripe) {
    console.log('[MOCK STRIPE] Webhook received')
    return { received: true }
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook secret not configured')
  }

  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET,
  )

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.userId
      const paymentType = session.metadata?.type

      if (
        userId &&
        paymentType === 'platform_access' &&
        session.mode === 'payment'
      ) {
        // Platform access one-time payment completed ($149)
        const prisma = await getPrisma()
        await prisma.user.update({
          where: { id: userId },
          data: {
            hasPlatformAccess: true,
            platformPurchaseDate: new Date(),
            platformStripePaymentId:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : (session.payment_intent?.id ?? null),
          },
        })
        console.log(`[STRIPE] Platform access granted to user: ${userId}`)
      }
      break
    }

    case 'payment_intent.succeeded': {
      // Fallback handler for one-time payments
      // This ensures access is granted even if checkout.session.completed is missed
      const paymentIntent = event.data.object
      const userId = paymentIntent.metadata?.userId
      const paymentType = paymentIntent.metadata?.type

      if (userId && paymentType === 'platform_access') {
        const prisma = await getPrisma()
        const user = await prisma.user.findUnique({ where: { id: userId } })

        // Only update if not already granted (avoid duplicate updates)
        if (user && !user.hasPlatformAccess) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              hasPlatformAccess: true,
              platformPurchaseDate: new Date(),
              platformStripePaymentId: paymentIntent.id,
            },
          })
          console.log(
            `[STRIPE] Platform access granted via payment_intent to user: ${userId}`,
          )
        }
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object
      console.log(
        `[STRIPE] Payment failed for payment intent: ${paymentIntent.id}`,
      )
      break
    }
  }

  return { received: true }
}

export async function createBillingPortalSession(
  userId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripeClient()

  if (!stripe) {
    console.log(`[MOCK STRIPE] Created billing portal for user: ${userId}`)
    return { url: returnUrl }
  }

  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.stripeCustomerId) {
    throw new Error('No Stripe customer found for user')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  })

  return { url: session.url }
}

// =============================================================================
// Platform One-Time Payment ($149)
// =============================================================================

/**
 * Create a Stripe Checkout Session for platform one-time payment ($149)
 * Grants lifetime access to Cinevido platform
 */
export async function createPlatformCheckoutSession(
  userId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<CheckoutResult> {
  const stripe = getStripeClient()

  if (!stripe) {
    // In mock mode, simulate successful purchase
    console.log(
      `[MOCK STRIPE] Created platform checkout session for user: ${userId}`,
    )

    // Update user to have platform access in mock mode
    const prisma = await getPrisma()
    await prisma.user.update({
      where: { id: userId },
      data: {
        hasPlatformAccess: true,
        platformPurchaseDate: new Date(),
        platformStripePaymentId: `mock_pi_${Date.now()}`,
      },
    })

    return {
      url: `${successUrl}?session_id=mock_platform_session_${Date.now()}`,
    }
  }

  // Get or create Stripe customer
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  let customerId = user.stripeCustomerId

  if (!customerId) {
    // Check if customer already exists in Stripe with this email to prevent duplicates
    const existingCustomers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    })

    if (existingCustomers.data.length > 0) {
      // Reuse existing Stripe customer
      customerId = existingCustomers.data[0].id
    } else {
      // Create new customer only if none exists
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId },
      })
      customerId = customer.id
    }

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    })
  }

  // Get the platform price ID from environment
  const priceId = process.env.STRIPE_PLATFORM_PRICE_ID
  if (!priceId) {
    throw new Error(
      'STRIPE_PLATFORM_PRICE_ID environment variable not configured',
    )
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'payment', // One-time payment, not subscription
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      type: 'platform_access', // Identifies this as a platform purchase
    },
    // Pass userId to payment_intent for webhook reliability
    payment_intent_data: {
      metadata: {
        userId,
        type: 'platform_access',
      },
    },
  })

  if (!session.url) {
    throw new Error('Failed to create platform checkout session')
  }

  return { url: session.url }
}

/**
 * Verify and activate platform access directly with Stripe
 * Used as a fallback when webhook doesn't fire (e.g., redirect before webhook)
 */
export async function verifyAndActivatePlatformAccess(userId: string): Promise<{
  success: boolean
  alreadyActive?: boolean
  activatedViaFallback?: boolean
}> {
  const stripe = getStripeClient()

  if (!stripe) {
    // In mock mode, just return success
    return { success: true, alreadyActive: true }
  }

  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return { success: false }
  }

  // Already active? Skip
  if (user.hasPlatformAccess) {
    return { success: true, alreadyActive: true }
  }

  // No Stripe customer ID means they never started checkout
  if (!user.stripeCustomerId) {
    return { success: false }
  }

  // Verify directly with Stripe API
  const paymentIntents = await stripe.paymentIntents.list({
    customer: user.stripeCustomerId,
    limit: 10,
  })

  // Find a successful payment with matching metadata
  const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60

  const matchingPayment = paymentIntents.data.find(
    (pi) =>
      pi.status === 'succeeded' &&
      pi.metadata?.type === 'platform_access' &&
      pi.metadata?.userId === userId,
  )

  // Fallback: Find any recent successful payment from this customer
  const recentPayment = paymentIntents.data.find(
    (pi) => pi.status === 'succeeded' && pi.created > twentyFourHoursAgo,
  )

  if (matchingPayment || recentPayment) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        hasPlatformAccess: true,
        platformPurchaseDate: new Date(),
        platformStripePaymentId: matchingPayment?.id || recentPayment?.id,
      },
    })
    return { success: true, activatedViaFallback: true }
  }

  return { success: false }
}
