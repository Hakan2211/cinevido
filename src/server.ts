import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

const DEFAULT_BASE_URL = 'http://localhost:3000'

type NodeRequestLike = {
  url?: string
  method?: string
  headers?: Record<string, string | string[] | undefined>
  readable?: boolean
}

function getHeaderValue(headers: unknown, name: string) {
  if (headers && typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name)
  }

  const key = name.toLowerCase()
  const record = headers as Record<string, string | string[] | undefined> | null
  const value = record?.[key] ?? record?.[name]

  if (Array.isArray(value)) {
    return value.join(',')
  }

  return typeof value === 'string' ? value : null
}

function getRequestOrigin(request: { headers?: unknown }) {
  const forwardedProto = getHeaderValue(request.headers, 'x-forwarded-proto')
  const forwardedHost = getHeaderValue(request.headers, 'x-forwarded-host')
  const host = getHeaderValue(request.headers, 'host')

  const authority = forwardedHost || host
  if (authority) {
    const proto = forwardedProto || 'http'
    return `${proto}://${authority}`
  }

  const envBaseUrl = process.env.BETTER_AUTH_URL || DEFAULT_BASE_URL
  try {
    return new URL(envBaseUrl).origin
  } catch {
    return DEFAULT_BASE_URL
  }
}

function toHeaders(source: unknown) {
  if (source instanceof Headers) {
    return new Headers(source)
  }

  const headers = new Headers()
  if (source && typeof source === 'object') {
    for (const [key, value] of Object.entries(
      source as Record<string, string | string[] | undefined>,
    )) {
      if (Array.isArray(value)) {
        for (const item of value) {
          headers.append(key, item)
        }
      } else if (typeof value === 'string') {
        headers.append(key, value)
      }
    }
  }

  return headers
}

export default createServerEntry({
  fetch(request, opts) {
    const origin = getRequestOrigin(request)

    try {
      if (request instanceof Request) {
        const normalizedUrl = new URL(request.url, origin).toString()
        const normalizedRequest =
          normalizedUrl === request.url
            ? request
            : new Request(normalizedUrl, request)
        return handler.fetch(normalizedRequest, opts)
      }

      const nodeRequest = request as NodeRequestLike
      const normalizedUrl = new URL(nodeRequest.url ?? '/', origin).toString()
      const headers = toHeaders(nodeRequest.headers)
      const method = nodeRequest.method || 'GET'

      const init: RequestInit & { duplex?: 'half' } = { method, headers }
      if (method !== 'GET' && method !== 'HEAD' && nodeRequest.readable) {
        init.body = nodeRequest as unknown as BodyInit
        init.duplex = 'half'
      }

      const webRequest = new Request(normalizedUrl, init)
      return handler.fetch(webRequest, opts)
    } catch {
      return handler.fetch(request as Request, opts)
    }
  },
})
