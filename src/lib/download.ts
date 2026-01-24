/**
 * Download utility for cross-origin file downloads
 *
 * The HTML5 download attribute doesn't work for cross-origin URLs (like CDN files).
 * This utility fetches the file as a blob and creates a local object URL for download.
 */

export interface DownloadOptions {
  /** Callback when download starts */
  onStart?: () => void
  /** Callback when download completes successfully */
  onComplete?: () => void
  /** Callback when download fails */
  onError?: (error: Error) => void
}

/**
 * Download a file from any URL (including cross-origin CDN URLs)
 *
 * @param url - The URL to download from
 * @param filename - The filename to save as
 * @param options - Optional callbacks for download lifecycle
 * @returns Promise that resolves when download is triggered
 */
export async function downloadFile(
  url: string,
  filename: string,
  options: DownloadOptions = {},
): Promise<void> {
  const { onStart, onComplete, onError } = options

  try {
    onStart?.()

    // Fetch the file as a blob
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`,
      )
    }

    const blob = await response.blob()

    // Create an object URL from the blob
    const objectUrl = URL.createObjectURL(blob)

    // Create and trigger download
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up the object URL
    URL.revokeObjectURL(objectUrl)

    onComplete?.()
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Download failed')
    onError?.(err)

    // Fallback: open in new tab so user can still access the file
    console.error('Download failed, opening in new tab:', err)
    window.open(url, '_blank')
  }
}

/**
 * Extract file extension from URL or content type
 */
export function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const lastDot = pathname.lastIndexOf('.')
    if (lastDot !== -1) {
      return pathname.substring(lastDot + 1).toLowerCase()
    }
  } catch {
    // URL parsing failed
  }
  return ''
}

/**
 * Generate a download filename from URL and optional custom name
 */
export function generateFilename(
  url: string,
  prefix: string,
  customName?: string,
): string {
  if (customName) return customName

  const extension = getExtensionFromUrl(url) || 'bin'
  return `${prefix}-${Date.now()}.${extension}`
}
