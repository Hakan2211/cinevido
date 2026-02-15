/**
 * Storage Configuration Server Functions (BYOK Storage)
 *
 * Handles user-configured Bunny.net storage.
 * When a user configures their own storage, all new asset uploads
 * go to their Bunny zone instead of the platform's.
 *
 * Follows the same pattern as byok.server.ts:
 * - Dynamic imports for server-only modules (prisma, encryption)
 * - AES-256-GCM encryption for API keys
 * - createServerFn + authMiddleware for all endpoints
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './middleware.server'
import type { BunnyConfig } from './services/bunny.server'

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

export interface StorageConfigStatus {
  hasStorageConfig: boolean
  storageZone: string | null
  cdnUrl: string | null
  apiKeyLastFour: string | null
  addedAt: Date | null
}

// =============================================================================
// Get Storage Config Status
// =============================================================================

export const getStorageConfigStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<StorageConfigStatus> => {
    const prisma = await getPrisma()
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: {
        bunnyStorageZone: true,
        bunnyApiKeyLastFour: true,
        bunnyCdnUrl: true,
        bunnyStorageAddedAt: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return {
      hasStorageConfig: !!user.bunnyApiKeyLastFour && !!user.bunnyStorageZone,
      storageZone: user.bunnyStorageZone,
      cdnUrl: user.bunnyCdnUrl,
      apiKeyLastFour: user.bunnyApiKeyLastFour,
      addedAt: user.bunnyStorageAddedAt,
    }
  })

// =============================================================================
// Save Storage Config
// =============================================================================

const saveStorageConfigSchema = z.object({
  storageZone: z.string().min(1, 'Storage zone is required'),
  apiKey: z.string().min(1, 'API key is required'),
  cdnUrl: z
    .string()
    .url('CDN URL must be a valid URL')
    .refine((url) => !url.endsWith('/'), {
      message: 'CDN URL should not end with a trailing slash',
    }),
})

export const saveStorageConfigFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(saveStorageConfigSchema)
  .handler(async ({ data, context }) => {
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

    // Dynamic import encryption utilities
    const { encryptApiKey, getApiKeyLastChars, isEncryptionConfigured } =
      await getEncryption()

    if (!isEncryptionConfigured()) {
      throw new Error(
        'Encryption is not configured on this server. Please contact support.',
      )
    }

    // Validate the Bunny.net credentials by uploading + deleting a test file
    const isValid = await validateBunnyCredentials(
      data.storageZone,
      data.apiKey,
      data.cdnUrl,
    )
    if (!isValid) {
      throw new Error(
        'Invalid Bunny.net credentials. Could not write to the storage zone. ' +
          'Please check your storage zone name and API key.',
      )
    }

    // Encrypt and save
    const encryptedKey = encryptApiKey(data.apiKey)
    const lastFour = getApiKeyLastChars(data.apiKey)

    // Normalize CDN URL: remove trailing slash if present
    const cdnUrl = data.cdnUrl.replace(/\/+$/, '')

    await prisma.user.update({
      where: { id: context.user.id },
      data: {
        bunnyStorageZone: data.storageZone,
        bunnyApiKey: encryptedKey,
        bunnyApiKeyLastFour: lastFour,
        bunnyCdnUrl: cdnUrl,
        bunnyStorageAddedAt: new Date(),
      },
    })

    return { success: true, apiKeyLastFour: lastFour }
  })

// =============================================================================
// Remove Storage Config
// =============================================================================

export const removeStorageConfigFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const prisma = await getPrisma()
    await prisma.user.update({
      where: { id: context.user.id },
      data: {
        bunnyStorageZone: null,
        bunnyApiKey: null,
        bunnyApiKeyLastFour: null,
        bunnyCdnUrl: null,
        bunnyStorageAddedAt: null,
      },
    })

    return { success: true }
  })

// =============================================================================
// Test Storage Connection
// =============================================================================

export const testStorageConnectionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const prisma = await getPrisma()
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: {
        bunnyStorageZone: true,
        bunnyApiKey: true,
        bunnyCdnUrl: true,
      },
    })

    if (!user?.bunnyApiKey || !user?.bunnyStorageZone) {
      throw new Error('No storage configuration found')
    }

    const { decryptApiKey } = await getEncryption()
    const decryptedKey = decryptApiKey(user.bunnyApiKey)

    const isValid = await validateBunnyCredentials(
      user.bunnyStorageZone,
      decryptedKey,
      user.bunnyCdnUrl || '',
    )

    return { connected: isValid }
  })

// =============================================================================
// Helper: Validate Bunny.net Credentials
// =============================================================================

/**
 * Validate Bunny.net storage credentials by uploading a small test file
 * and then deleting it. This confirms write access and zone existence.
 */
async function validateBunnyCredentials(
  storageZone: string,
  apiKey: string,
  _cdnUrl?: string,
): Promise<boolean> {
  const hostname = 'storage.bunnycdn.com'
  const testPath = '__connection_test.txt'
  const testContent = `Connection test at ${new Date().toISOString()}`

  try {
    // Upload test file
    const uploadUrl = `https://${hostname}/${storageZone}/${testPath}`
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        AccessKey: apiKey,
        'Content-Type': 'text/plain',
      },
      body: testContent,
    })

    if (!uploadResponse.ok) {
      console.error(
        '[STORAGE_CONFIG] Test upload failed:',
        uploadResponse.status,
        await uploadResponse.text(),
      )
      return false
    }

    // Delete test file
    const deleteResponse = await fetch(uploadUrl, {
      method: 'DELETE',
      headers: {
        AccessKey: apiKey,
      },
    })

    if (!deleteResponse.ok) {
      console.warn(
        '[STORAGE_CONFIG] Test file cleanup failed:',
        deleteResponse.status,
      )
      // Still return true - the upload succeeded, which is what matters
    }

    return true
  } catch (error) {
    console.error('[STORAGE_CONFIG] Credential validation error:', error)
    return false
  }
}

// =============================================================================
// Helper: Get User's Bunny Config (for use in upload services)
// =============================================================================

/**
 * Get the user's Bunny.net storage config if configured.
 * Returns null if the user hasn't configured their own storage
 * (meaning platform storage should be used).
 *
 * @param userId - The user's ID
 * @returns BunnyConfig for the user, or null to use platform defaults
 */
export async function getUserStorageConfig(
  userId: string,
): Promise<BunnyConfig | null> {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      bunnyStorageZone: true,
      bunnyApiKey: true,
      bunnyCdnUrl: true,
    },
  })

  if (!user?.bunnyApiKey || !user?.bunnyStorageZone || !user?.bunnyCdnUrl) {
    return null
  }

  const { decryptApiKey } = await getEncryption()
  const decryptedKey = decryptApiKey(user.bunnyApiKey)

  return {
    storageZone: user.bunnyStorageZone,
    apiKey: decryptedKey,
    hostname: 'storage.bunnycdn.com',
    cdnUrl: user.bunnyCdnUrl,
  }
}
