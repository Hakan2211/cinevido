/**
 * BYOK (Bring Your Own Key) Server Functions
 *
 * Handles API key management, BYOK access status, and fal.ai usage tracking.
 *
 * NOTE: Encryption utilities are imported dynamically inside handlers to prevent
 * Node.js 'crypto' module from being bundled into the client. This is critical
 * because the route tree statically imports all routes, and any top-level
 * Node.js imports would break client-side hydration.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './middleware.server'

// NOTE: Server-only dependencies (prisma, encryption) are dynamically imported
// inside handlers to prevent them from being bundled into the client during dev mode.

// Dynamic import helpers for server-only modules
async function getPrisma() {
  const { prisma } = await import('../db.server')
  return prisma
}

async function getEncryption() {
  return await import('../lib/encryption.server')
}

// =============================================================================
// Types
// =============================================================================

export interface ByokStatus {
  hasPlatformAccess: boolean
  hasApiKey: boolean
  apiKeyLastFour: string | null
  purchaseDate: Date | null
  billingKeyLastFour: string | null
}

export interface FalUsage {
  monthlyUsage: number
  currency: string
}

// =============================================================================
// Get BYOK Status
// =============================================================================

/**
 * Get the current user's BYOK (API key) status
 * Note: Platform access is checked separately via getPlatformStatusFn
 */
export const getByokStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ByokStatus> => {
    const prisma = await getPrisma()
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: {
        hasPlatformAccess: true,
        falApiKeyLastFour: true,
        falBillingKeyLastFour: true,
        platformPurchaseDate: true,
        role: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Admins always have platform access
    const isAdmin = user.role === 'admin'
    const hasPlatformAccess = isAdmin || user.hasPlatformAccess

    return {
      hasPlatformAccess,
      hasApiKey: !!user.falApiKeyLastFour,
      apiKeyLastFour: user.falApiKeyLastFour,
      purchaseDate: user.platformPurchaseDate,
      billingKeyLastFour: user.falBillingKeyLastFour,
    }
  })

// =============================================================================
// Save API Key
// =============================================================================

const saveApiKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
})

/**
 * Validate, encrypt, and save the user's fal.ai API key
 */
export const saveApiKeyFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(saveApiKeySchema)
  .handler(async ({ data, context }) => {
    // Check if user has platform access (or is admin)
    const prisma = await getPrisma()
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { hasPlatformAccess: true, role: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const isAdmin = user.role === 'admin'
    if (!isAdmin && !user.hasPlatformAccess) {
      throw new Error('Platform access required. Please purchase access first.')
    }

    // Dynamic import encryption utilities (server-only)
    const { encryptApiKey, getApiKeyLastChars, isEncryptionConfigured } =
      await getEncryption()

    // Check encryption is configured
    if (!isEncryptionConfigured()) {
      throw new Error(
        'Encryption is not configured on this server. Please contact support.',
      )
    }

    // Validate the API key by making a test call to fal.ai
    const isValid = await validateFalApiKey(data.apiKey)
    if (!isValid) {
      throw new Error(
        'Invalid fal.ai API key. Please check your key and try again.',
      )
    }

    // Encrypt and save the key
    const encryptedKey = encryptApiKey(data.apiKey)
    const lastFour = getApiKeyLastChars(data.apiKey)

    await prisma.user.update({
      where: { id: context.user.id },
      data: {
        falApiKey: encryptedKey,
        falApiKeyLastFour: lastFour,
        falApiKeyAddedAt: new Date(),
      },
    })

    return { success: true, apiKeyLastFour: lastFour }
  })

// =============================================================================
// Validate API Key
// =============================================================================

const validateApiKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
})

/**
 * Test if an API key is valid without saving it
 */
export const validateApiKeyFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(validateApiKeySchema)
  .handler(async ({ data }) => {
    const isValid = await validateFalApiKey(data.apiKey)
    return { valid: isValid }
  })

/**
 * Internal function to validate a fal.ai API key
 * Makes a lightweight request to check if the key works
 */
async function validateFalApiKey(apiKey: string): Promise<boolean> {
  try {
    // Use the models endpoint which is lightweight and requires auth
    const response = await fetch('https://api.fal.ai/v1/models?limit=1', {
      method: 'GET',
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    })

    return response.ok
  } catch (error) {
    console.error('[BYOK] Error validating fal.ai API key:', error)
    return false
  }
}

// =============================================================================
// Remove API Key
// =============================================================================

/**
 * Remove the user's stored fal.ai API key
 */
export const removeApiKeyFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const prisma = await getPrisma()
    await prisma.user.update({
      where: { id: context.user.id },
      data: {
        falApiKey: null,
        falApiKeyLastFour: null,
        falApiKeyAddedAt: null,
      },
    })

    return { success: true }
  })

// =============================================================================
// Test Connection
// =============================================================================

/**
 * Test if the user's stored API key still works
 */
export const testApiKeyConnectionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const prisma = await getPrisma()
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { falApiKey: true },
    })

    if (!user?.falApiKey) {
      throw new Error('No API key configured')
    }

    // Dynamic import encryption utilities (server-only)
    const { decryptApiKey } = await getEncryption()

    const decryptedKey = decryptApiKey(user.falApiKey)
    const isValid = await validateFalApiKey(decryptedKey)

    return { connected: isValid }
  })

// =============================================================================
// Get fal.ai Usage
// =============================================================================

/**
 * Fetch the user's fal.ai usage for the current month
 */
export const getFalUsageFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<FalUsage | null> => {
    const prisma = await getPrisma()
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { falApiKey: true },
    })

    if (!user?.falApiKey) {
      return null
    }

    try {
      // Dynamic import encryption utilities (server-only)
      const { decryptApiKey } = await getEncryption()

      const decryptedKey = decryptApiKey(user.falApiKey)

      // Get usage for the current month
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startIso = startOfMonth.toISOString()

      const response = await fetch(
        `https://api.fal.ai/v1/models/usage?expand=summary&start=${startIso}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Key ${decryptedKey}`,
          },
        },
      )

      if (!response.ok) {
        console.error('[BYOK] Failed to fetch fal.ai usage:', response.status)
        return null
      }

      const data = await response.json()

      // Calculate total cost from summary
      interface UsageSummaryItem {
        cost: number
        currency: string
      }

      const summary = data.summary as Array<UsageSummaryItem> | undefined
      const totalCost =
        summary?.reduce(
          (sum: number, item: UsageSummaryItem) => sum + (item.cost || 0),
          0,
        ) || 0

      return {
        monthlyUsage: Math.round(totalCost * 100) / 100, // Round to 2 decimal places
        currency: 'USD',
      }
    } catch (error) {
      console.error('[BYOK] Error fetching fal.ai usage:', error)
      return null
    }
  })

// =============================================================================
// Helper: Get User's Decrypted API Key (for use in other services)
// =============================================================================

/**
 * Get the decrypted fal.ai API key for a user
 * For use by other server functions that need to make fal.ai API calls
 *
 * @param userId - The user's ID
 * @returns The decrypted API key, or throws an error if not available
 */
export async function getUserFalApiKey(userId: string): Promise<string> {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      falApiKey: true,
      hasPlatformAccess: true,
      role: true,
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Admin users can use the platform key for testing
  const isAdmin = user.role === 'admin'
  console.log('[BYOK] getUserFalApiKey called:', {
    userId,
    isAdmin,
    hasPlatformAccess: user.hasPlatformAccess,
    hasEncryptedKey: !!user.falApiKey,
    envFalKeyExists: !!process.env.FAL_KEY,
  })

  if (isAdmin && process.env.FAL_KEY) {
    console.log(
      '[BYOK] Using ENV FAL_KEY for admin:',
      `...${process.env.FAL_KEY.slice(-4)}`,
    )
    return process.env.FAL_KEY
  }

  // Check platform access
  if (!isAdmin && !user.hasPlatformAccess) {
    throw new Error(
      'Platform access required. Please unlock the platform to use this feature.',
    )
  }

  // Check for API key
  if (!user.falApiKey) {
    throw new Error(
      'No fal.ai API key configured. Please add your API key in settings.',
    )
  }

  // Dynamic import encryption utilities (server-only)
  const { decryptApiKey } = await getEncryption()

  const decryptedKey = decryptApiKey(user.falApiKey)
  console.log(
    '[BYOK] Using decrypted BYOK key:',
    `...${decryptedKey.slice(-4)}`,
  )
  return decryptedKey
}

// =============================================================================
// fal.ai Credit Balance (read-only billing key)
// =============================================================================
//
// GET /v1/account/billing?expand=credits needs a key with the
// `billing:usage:read` permission. A normal generation key ("API" scope) gets
// a 403, so users can add a second, read-only key (fal's READONLY or BILLING
// preset) that is used for nothing but this balance.

export type FalCredits =
  | { status: 'ok'; balance: number; currency: string; checkedAt: string }
  | { status: 'no-key' }
  | { status: 'forbidden' } // the key lacks billing:usage:read
  | { status: 'error'; message: string }

const CREDITS_TTL_MS = 60_000
const creditsCache = new Map<string, { at: number; value: FalCredits }>()

async function fetchFalCredits(key: string): Promise<FalCredits> {
  try {
    const response = await fetch(
      'https://api.fal.ai/v1/account/billing?expand=credits',
      { headers: { Authorization: `Key ${key}` } },
    )
    if (response.status === 401 || response.status === 403) {
      return { status: 'forbidden' }
    }
    if (!response.ok) {
      return { status: 'error', message: `fal answered ${response.status}` }
    }
    const body = (await response.json()) as {
      credits?: { current_balance: number; currency: string }
    }
    if (!body.credits) {
      return { status: 'error', message: 'fal returned no credit balance' }
    }
    return {
      status: 'ok',
      balance: body.credits.current_balance,
      currency: body.credits.currency,
      checkedAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * The key that may read this user's balance: their own billing key, or — for
 * admins only — the server's FAL_BILLING_KEY. Never another user's account.
 */
async function getBillingKey(userId: string): Promise<string | null> {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { falBillingKey: true, role: true },
  })
  if (user?.falBillingKey) {
    const { decryptApiKey } = await getEncryption()
    return decryptApiKey(user.falBillingKey)
  }
  if (user?.role === 'admin' && process.env.FAL_BILLING_KEY) {
    return process.env.FAL_BILLING_KEY
  }
  return null
}

export const getFalCreditsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<FalCredits> => {
    const cached = creditsCache.get(context.user.id)
    if (cached && Date.now() - cached.at < CREDITS_TTL_MS) return cached.value

    const key = await getBillingKey(context.user.id)
    const value: FalCredits = key
      ? await fetchFalCredits(key)
      : { status: 'no-key' }
    creditsCache.set(context.user.id, { at: Date.now(), value })
    return value
  })

const saveBillingKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
})

export const saveBillingKeyFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(saveBillingKeySchema)
  .handler(async ({ data, context }) => {
    const { encryptApiKey, getApiKeyLastChars, isEncryptionConfigured } =
      await getEncryption()
    if (!isEncryptionConfigured()) {
      throw new Error(
        'Encryption is not configured on this server. Please contact support.',
      )
    }

    // Prove the key can actually read the balance before storing it
    const credits = await fetchFalCredits(data.apiKey)
    if (credits.status === 'forbidden') {
      throw new Error(
        'This key cannot read billing. Create one in fal with the READONLY or BILLING preset.',
      )
    }
    if (credits.status !== 'ok') {
      throw new Error(
        credits.status === 'error'
          ? `Could not check the key: ${credits.message}`
          : 'Could not check the key.',
      )
    }

    const prisma = await getPrisma()
    const lastFour = getApiKeyLastChars(data.apiKey)
    await prisma.user.update({
      where: { id: context.user.id },
      data: {
        falBillingKey: encryptApiKey(data.apiKey),
        falBillingKeyLastFour: lastFour,
      },
    })
    creditsCache.set(context.user.id, { at: Date.now(), value: credits })
    return { success: true, billingKeyLastFour: lastFour, credits }
  })

export const removeBillingKeyFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const prisma = await getPrisma()
    await prisma.user.update({
      where: { id: context.user.id },
      data: { falBillingKey: null, falBillingKeyLastFour: null },
    })
    creditsCache.delete(context.user.id)
    return { success: true }
  })
