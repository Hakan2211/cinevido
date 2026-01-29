import { createServerFn } from '@tanstack/react-start'
import {
  createBillingPortalSession,
  createPlatformCheckoutSession,
  getPlatformStatus,
  verifyAndActivatePlatformAccess,
} from '../lib/stripe.server'
import { authMiddleware } from './middleware.server'

/**
 * Get current user's platform access status
 */
export const getPlatformStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // Admin always has platform access
    if (context.user.role === 'admin') {
      return {
        hasPlatformAccess: true,
        purchaseDate: null,
        isAdmin: true,
      }
    }

    const status = await getPlatformStatus(context.user.id)
    return {
      ...status,
      isAdmin: false,
    }
  })

/**
 * Create Stripe Checkout Session for platform one-time payment ($149)
 * Grants lifetime access to Cinevido
 */
export const createPlatformCheckoutFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    const result = await createPlatformCheckoutSession(
      context.user.id,
      `${baseUrl}/purchase-success?success=true`,
      `${baseUrl}/pricing?canceled=true`,
    )

    return result
  })

/**
 * Verify and activate platform access (fallback for when webhook doesn't fire)
 */
export const verifyPlatformAccessFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const result = await verifyAndActivatePlatformAccess(context.user.id)
    return result
  })

/**
 * Create Stripe Billing Portal Session
 * Allows users to manage their payment methods
 */
export const createBillingPortalFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    const result = await createBillingPortalSession(
      context.user.id,
      `${baseUrl}/profile`,
    )

    return result
  })
