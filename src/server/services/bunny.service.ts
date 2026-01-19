/**
 * Bunny.net Storage Service
 *
 * Handles file uploads and management for DirectorAI assets.
 * Supports uploading from URLs (after generation) and direct buffer uploads.
 *
 * Environment variables required:
 * - BUNNY_STORAGE_ZONE: Storage zone name
 * - BUNNY_STORAGE_API_KEY: API key for the storage zone
 * - BUNNY_STORAGE_HOSTNAME: Storage hostname (e.g., storage.bunnycdn.com)
 * - BUNNY_CDN_URL: CDN URL for serving files
 */

const MOCK_BUNNY = process.env.MOCK_GENERATION === 'true'

// =============================================================================
// Configuration
// =============================================================================

function getConfig() {
  return {
    storageZone: process.env.BUNNY_STORAGE_ZONE || '',
    apiKey: process.env.BUNNY_STORAGE_API_KEY || '',
    hostname: process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com',
    cdnUrl: process.env.BUNNY_CDN_URL || '',
  }
}

// =============================================================================
// Types
// =============================================================================

export interface UploadResult {
  success: boolean
  url: string // CDN URL for accessing the file
  path: string // Storage path
  filename: string
}

export interface UploadOptions {
  folder?: string // Subfolder path (e.g., "images", "videos", "audio")
  filename?: string // Custom filename (auto-generated if not provided)
}

// =============================================================================
// Main Service Functions
// =============================================================================

/**
 * Upload a file from a URL (e.g., after AI generation)
 * Downloads the file and uploads it to Bunny storage
 */
export async function uploadFromUrl(
  sourceUrl: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  console.log('[BUNNY] uploadFromUrl called:', {
    sourceUrl: sourceUrl.slice(0, 80) + '...',
    folder: options.folder,
    filename: options.filename,
  })

  if (MOCK_BUNNY) {
    console.log('[BUNNY] Using MOCK mode')
    return mockUpload(options)
  }

  const config = getConfig()
  console.log('[BUNNY] Config:', {
    storageZone: config.storageZone,
    hostname: config.hostname,
    cdnUrl: config.cdnUrl,
    hasApiKey: !!config.apiKey,
    apiKeyLength: config.apiKey?.length || 0,
  })

  if (!config.apiKey || !config.storageZone) {
    console.error('[BUNNY] Configuration missing!')
    throw new Error('Bunny.net configuration missing')
  }

  // Download the file from source URL
  console.log('[BUNNY] Downloading from source URL...')
  const response = await fetch(sourceUrl)
  console.log(
    '[BUNNY] Download response:',
    response.status,
    response.statusText,
  )

  if (!response.ok) {
    console.error('[BUNNY] Download failed:', response.status)
    throw new Error(`Failed to download file: ${response.status}`)
  }

  const contentType =
    response.headers.get('content-type') || 'application/octet-stream'
  const buffer = await response.arrayBuffer()
  console.log('[BUNNY] Downloaded:', {
    contentType,
    size: buffer.byteLength,
  })

  // Generate filename if not provided, or append extension if missing
  const extension = getExtensionFromContentType(contentType)
  let filename = options.filename || `${generateId()}.${extension}`

  // If filename was provided but has no extension, append the detected one
  if (options.filename && !options.filename.includes('.')) {
    filename = `${options.filename}.${extension}`
  }

  const folder = options.folder || 'uploads'
  const storagePath = `${folder}/${filename}`

  // Upload to Bunny storage
  const uploadUrl = `https://${config.hostname}/${config.storageZone}/${storagePath}`
  console.log('[BUNNY] Uploading to:', uploadUrl)

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      AccessKey: config.apiKey,
      'Content-Type': contentType,
    },
    body: buffer,
  })

  console.log(
    '[BUNNY] Upload response:',
    uploadResponse.status,
    uploadResponse.statusText,
  )

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    console.error('[BUNNY] Upload failed:', uploadResponse.status, errorText)
    throw new Error(
      `Bunny upload failed: ${uploadResponse.status} - ${errorText}`,
    )
  }

  // Return the CDN URL
  const cdnUrl = `${config.cdnUrl}/${storagePath}`
  console.log('[BUNNY] Upload success! CDN URL:', cdnUrl)

  return {
    success: true,
    url: cdnUrl,
    path: storagePath,
    filename,
  }
}

/**
 * Upload a buffer directly to Bunny storage
 */
export async function uploadBuffer(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  contentType: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  if (MOCK_BUNNY) {
    return mockUpload(options)
  }

  const config = getConfig()
  if (!config.apiKey || !config.storageZone) {
    throw new Error('Bunny.net configuration missing')
  }

  // Generate filename if not provided
  const extension = getExtensionFromContentType(contentType)
  const filename = options.filename || `${generateId()}.${extension}`
  const folder = options.folder || 'uploads'
  const storagePath = `${folder}/${filename}`

  // Upload to Bunny storage
  const uploadUrl = `https://${config.hostname}/${config.storageZone}/${storagePath}`

  // Convert Buffer to Uint8Array if needed for fetch compatibility
  const body =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer)

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      AccessKey: config.apiKey,
      'Content-Type': contentType,
    },
    body,
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    throw new Error(
      `Bunny upload failed: ${uploadResponse.status} - ${errorText}`,
    )
  }

  // Return the CDN URL
  const cdnUrl = `${config.cdnUrl}/${storagePath}`

  return {
    success: true,
    url: cdnUrl,
    path: storagePath,
    filename,
  }
}

/**
 * Delete a file from Bunny storage
 */
export async function deleteFile(storagePath: string): Promise<boolean> {
  if (MOCK_BUNNY) {
    return true
  }

  const config = getConfig()
  if (!config.apiKey || !config.storageZone) {
    throw new Error('Bunny.net configuration missing')
  }

  const deleteUrl = `https://${config.hostname}/${config.storageZone}/${storagePath}`

  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      AccessKey: config.apiKey,
    },
  })

  return response.ok
}

/**
 * Get the public CDN URL for a storage path
 */
export function getPublicUrl(storagePath: string): string {
  const config = getConfig()
  return `${config.cdnUrl}/${storagePath}`
}

/**
 * Check if Bunny.net is properly configured
 */
export function isBunnyConfigured(): boolean {
  if (MOCK_BUNNY) return true
  const config = getConfig()
  return !!(config.apiKey && config.storageZone && config.cdnUrl)
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'application/json': 'json',
  }
  return map[contentType] || 'bin'
}

// =============================================================================
// Mock Implementation
// =============================================================================

function mockUpload(options: UploadOptions): UploadResult {
  const filename = options.filename || `mock-${generateId()}.png`
  const folder = options.folder || 'uploads'
  const storagePath = `${folder}/${filename}`

  return {
    success: true,
    url: `https://mock-cdn.example.com/${storagePath}`,
    path: storagePath,
    filename,
  }
}
