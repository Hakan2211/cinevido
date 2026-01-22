/**
 * GLB Proxy API Endpoint
 *
 * Proxies GLB/GLTF 3D model files from Bunny CDN to bypass CORS restrictions.
 * This is needed because Bunny CDN doesn't properly handle CORS for binary files.
 */

import { createFileRoute } from '@tanstack/react-router'

// Allowed domains for security (only proxy from our CDN)
const ALLOWED_DOMAINS = ['vidcin.b-cdn.net']

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.glb', '.gltf']

/**
 * Validate that the URL is from an allowed domain and has an allowed extension
 */
function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname

    // Check domain
    if (!ALLOWED_DOMAINS.includes(hostname)) {
      return false
    }

    // Check extension
    const pathname = parsedUrl.pathname.toLowerCase()
    if (!ALLOWED_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(url: string): string {
  const pathname = new URL(url).pathname.toLowerCase()
  if (pathname.endsWith('.gltf')) {
    return 'model/gltf+json'
  }
  return 'model/gltf-binary'
}

// =============================================================================
// Route Handler
// =============================================================================

export const Route = createFileRoute('/api/proxy-glb')({
  server: {
    handlers: {
      /**
       * GET /api/proxy-glb?url=<encoded-url> - Proxy a GLB/GLTF file
       */
      GET: async ({ request }) => {
        // Get URL from query params
        const requestUrl = new URL(request.url)
        const targetUrl = requestUrl.searchParams.get('url')

        // Validate URL parameter
        if (!targetUrl) {
          return new Response(
            JSON.stringify({ error: 'Missing url parameter' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        // Decode and validate the URL
        let decodedUrl: string
        try {
          decodedUrl = decodeURIComponent(targetUrl)
        } catch {
          return new Response(
            JSON.stringify({ error: 'Invalid url encoding' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        // Security check: only allow our CDN domain
        if (!isValidUrl(decodedUrl)) {
          return new Response(
            JSON.stringify({
              error:
                'URL not allowed. Only Bunny CDN GLB/GLTF files are permitted.',
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        try {
          // Fetch the file from Bunny CDN (server-to-server, no CORS)
          const response = await fetch(decodedUrl)

          if (!response.ok) {
            return new Response(
              JSON.stringify({
                error: `Failed to fetch file: ${response.status} ${response.statusText}`,
              }),
              {
                status: response.status,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          // Get the file content
          const arrayBuffer = await response.arrayBuffer()

          // Return with proper CORS headers
          return new Response(arrayBuffer, {
            status: 200,
            headers: {
              'Content-Type': getContentType(decodedUrl),
              'Content-Length': arrayBuffer.byteLength.toString(),
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          })
        } catch (error) {
          console.error('[proxy-glb] Error fetching file:', error)
          return new Response(
            JSON.stringify({
              error: 'Failed to fetch file from CDN',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },

      /**
       * OPTIONS /api/proxy-glb - Handle CORS preflight
       */
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
          },
        })
      },
    },
  },
})
