import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'

// NOTE: prisma is dynamically imported to prevent better-sqlite3 from being
// bundled into the client during dev mode. The auth instance is lazily
// initialized on first use to ensure prisma is only loaded server-side.

let _auth: ReturnType<typeof betterAuth> | null = null
let _adminEnsured = false

async function hashPassword(password: string): Promise<string> {
  const { scrypt, randomBytes } = await import('crypto')
  const { promisify } = await import('util')
  const scryptAsync = promisify(scrypt)
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

async function ensureAdminUser() {
  if (_adminEnsured) return
  _adminEnsured = true

  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminName = process.env.ADMIN_NAME || 'Admin'

  if (!adminEmail || !adminPassword) return

  const { prisma } = await import('../db.server')
  const hashedPassword = await hashPassword(adminPassword)

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        role: 'admin',
        emailVerified: true,
        ...(existingAdmin.name ? {} : { name: adminName }),
      },
    })

    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: existingAdmin.id,
        providerId: 'credential',
      },
    })

    if (existingAccount) {
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: { password: hashedPassword },
      })
    } else {
      await prisma.account.create({
        data: {
          userId: existingAdmin.id,
          accountId: existingAdmin.id,
          providerId: 'credential',
          password: hashedPassword,
        },
      })
    }

    return
  }

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      name: adminName,
      emailVerified: true,
      role: 'admin',
    },
  })

  await prisma.account.create({
    data: {
      userId: adminUser.id,
      accountId: adminUser.id,
      providerId: 'credential',
      password: hashedPassword,
    },
  })
}

async function createAuth() {
  const { prisma } = await import('../db.server')
  const { scrypt, randomBytes, timingSafeEqual } = await import('crypto')
  const { promisify } = await import('util')
  const scryptAsync = promisify(scrypt)
  const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
  const extraTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const trustedOrigins = Array.from(new Set([baseURL, ...extraTrustedOrigins]))

  const password = {
    hash: async (value: string) => {
      const salt = randomBytes(16).toString('hex')
      const derivedKey = (await scryptAsync(value, salt, 64)) as Buffer
      return `${salt}:${derivedKey.toString('hex')}`
    },
    verify: async (value: string, hashedValue: string) => {
      if (!hashedValue) return false

      let salt: string | undefined
      let hash: string | undefined

      if (hashedValue.includes(':')) {
        ;[salt, hash] = hashedValue.split(':')
      } else if (hashedValue.includes('.')) {
        ;[hash, salt] = hashedValue.split('.')
      } else {
        return false
      }

      if (!salt || !hash) return false

      const derivedKey = (await scryptAsync(value, salt, 64)) as Buffer
      const storedKey = Buffer.from(hash, 'hex')

      if (storedKey.length !== derivedKey.length) return false
      return timingSafeEqual(storedKey, derivedKey)
    },
  }

  return betterAuth({
    baseURL,
    database: prismaAdapter(prisma, {
      provider: 'sqlite',
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Set to true in production
    },
    password,
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
    trustedOrigins,
  })
}

/**
 * Get the auth instance (lazily initialized)
 * This ensures prisma is only imported when actually needed on the server
 */
export async function getAuth() {
  await ensureAdminUser()
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
