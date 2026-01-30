import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'

// NOTE: prisma is dynamically imported to prevent better-sqlite3 from being
// bundled into the client during dev mode. The auth instance is lazily
// initialized on first use to ensure prisma is only loaded server-side.

let _auth: ReturnType<typeof betterAuth> | null = null

async function createAuth() {
  const { prisma } = await import('../db.server')
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    database: prismaAdapter(prisma, {
      provider: 'sqlite',
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Set to true in production
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        enabled: !!(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ),
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'user',
          input: false,
        },
        stripeCustomerId: {
          type: 'string',
          required: false,
          input: false,
        },
        subscriptionStatus: {
          type: 'string',
          required: false,
          input: false,
        },
      },
    },
    trustedOrigins: [process.env.BETTER_AUTH_URL || 'http://localhost:3000'],
  })
}

/**
 * Get the auth instance (lazily initialized)
 * This ensures prisma is only imported when actually needed on the server
 */
export async function getAuth() {
  if (!_auth) {
    _auth = await createAuth()
  }
  return _auth
}

// For backward compatibility - this will be lazily initialized
// NOTE: This is a getter that returns a Promise, so callers must await it
export const auth = {
  get api() {
    return {
      getSession: async (options: { headers: Headers }) => {
        const authInstance = await getAuth()
        return authInstance.api.getSession(options)
      },
      signUpEmail: async (options: {
        body: { email: string; password: string; name: string }
      }) => {
        const authInstance = await getAuth()
        return authInstance.api.signUpEmail(options)
      },
    }
  },
  handler: async (request: Request) => {
    const authInstance = await getAuth()
    return authInstance.handler(request)
  },
  // Expose the $Infer type for type inference
  $Infer: {} as {
    Session: {
      user: {
        id: string
        email: string
        name: string | null
        image?: string | null
        emailVerified: boolean
        role?: string
        stripeCustomerId?: string | null
        subscriptionStatus?: string | null
        createdAt: Date
        updatedAt: Date
      }
      session: {
        id: string
        userId: string
        expiresAt: Date
        token: string
        ipAddress?: string | null
        userAgent?: string | null
      }
    }
  },
}

export type Session = typeof auth.$Infer.Session
export type User = (typeof auth.$Infer.Session)['user']
