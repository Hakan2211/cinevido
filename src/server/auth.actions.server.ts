import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/start-server-core'
import { z } from 'zod'

// NOTE: Server-only dependencies (prisma, auth) are dynamically imported
// inside handlers to prevent them from being bundled into the client during dev mode.

/**
 * Derive the request origin from forwarded headers (set by the reverse proxy)
 * or fall back to BETTER_AUTH_URL / localhost for development.
 */
function getOriginFromRequest(request: Request): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = request.headers.get('host')
  const authority = forwardedHost || host
  if (authority) {
    const proto = forwardedProto || 'http'
    return `${proto}://${authority}`
  }
  return process.env.BETTER_AUTH_URL || 'http://localhost:3000'
}

async function getAuthInstance() {
  const { getAuth } = await import('../lib/auth.server')
  return getAuth()
}

async function getPrisma() {
  const { prisma } = await import('../db.server')
  return prisma
}

/**
 * Sign up with email and password
 */
const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
})

export const signUpAction = createServerFn({ method: 'POST' })
  .inputValidator(signUpSchema)
  .handler(async ({ data }) => {
    try {
      // Check if user already exists
      const prisma = await getPrisma()
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      })

      if (existingUser) {
        return { success: false, error: 'Email already registered' }
      }

      // Create user via Better-Auth API
      const auth = await getAuthInstance()
      const result = await auth.api.signUpEmail({
        body: {
          email: data.email,
          password: data.password,
          name: data.name,
        },
      })

      return { success: true, user: result.user }
    } catch (error) {
      console.error('Sign up error:', error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create account',
      }
    }
  })

/**
 * Sign in with email and password
 */
const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const signInAction = createServerFn({ method: 'POST' })
  .inputValidator(signInSchema)
  .handler(async ({ data }) => {
    try {
      const request = getRequest()

      // Create a fake request to pass to Better-Auth
      const origin = getOriginFromRequest(request)
      const fakeRequest = new Request(`${origin}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      })

      const auth = await getAuthInstance()
      const response = await auth.handler(fakeRequest)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error:
            (errorData as { message?: string }).message ||
            'Invalid credentials',
        }
      }

      // Get the session cookie from the response
      const setCookieHeader = response.headers.get('set-cookie')

      return {
        success: true,
        setCookie: setCookieHeader,
      }
    } catch (error) {
      console.error('Sign in error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid credentials',
      }
    }
  })

/**
 * Get current session
 */
export const getSessionAction = createServerFn({ method: 'GET' }).handler(
  async () => {
    try {
      const request = getRequest()
      const auth = await getAuthInstance()
      const session = await auth.api.getSession({ headers: request.headers })
      return session
    } catch (error) {
      console.error('Get session error:', error)
      return null
    }
  },
)

/**
 * Sign out
 */
export const signOutAction = createServerFn({ method: 'POST' }).handler(
  async () => {
    try {
      const request = getRequest()

      // Create a fake request for sign out
      const origin = getOriginFromRequest(request)
      const fakeRequest = new Request(`${origin}/api/auth/sign-out`, {
        method: 'POST',
        headers: request.headers,
      })

      const auth = await getAuthInstance()
      const response = await auth.handler(fakeRequest)
      const setCookieHeader = response.headers.get('set-cookie')

      return {
        success: true,
        setCookie: setCookieHeader,
      }
    } catch (error) {
      console.error('Sign out error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign out',
      }
    }
  },
)
