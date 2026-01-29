import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { scrypt, randomBytes } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

// Hash password using scrypt (compatible with better-auth)
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminName = process.env.ADMIN_NAME || 'Admin'

  // Production mode: only create admin from env variables
  if (adminEmail && adminPassword) {
    console.log('📦 Production seeding mode (using environment variables)')

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    })

    if (existingAdmin) {
      console.log(`⏭️  Admin user already exists: ${adminEmail}`)
      return
    }

    // Hash the password using better-auth
    const hashedPassword = await hashPassword(adminPassword)

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        emailVerified: true,
        role: 'admin',
      },
    })

    // Create credential account with hashed password
    await prisma.account.create({
      data: {
        userId: adminUser.id,
        accountId: adminUser.id,
        providerId: 'credential',
        password: hashedPassword,
      },
    })

    console.log(`✅ Created admin user: ${adminUser.email}`)
    return
  }

  // Development mode: create test users with placeholder passwords
  console.log('🧪 Development seeding mode (no ADMIN_EMAIL/ADMIN_PASSWORD set)')

  // Clear existing data for fresh dev seed
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.verification.deleteMany()
  await prisma.user.deleteMany()

  // Create Admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      emailVerified: true,
      role: 'admin',
    },
  })

  // Create Test user
  const testUser = await prisma.user.create({
    data: {
      email: 'user@example.com',
      name: 'Test User',
      emailVerified: true,
      role: 'user',
    },
  })

  // Create credential accounts for both users
  // Note: In production, passwords should be hashed by better-auth
  // These are placeholder accounts - real passwords will be set via auth flow
  await prisma.account.createMany({
    data: [
      {
        userId: adminUser.id,
        accountId: adminUser.id,
        providerId: 'credential',
        // Password: "admin123" - would be hashed in production
        password: '$2a$10$placeholder.admin.hash',
      },
      {
        userId: testUser.id,
        accountId: testUser.id,
        providerId: 'credential',
        // Password: "user123" - would be hashed in production
        password: '$2a$10$placeholder.user.hash',
      },
    ],
  })

  console.log(`✅ Created admin user: ${adminUser.email}`)
  console.log(`✅ Created test user: ${testUser.email}`)
  console.log('')
  console.log(
    '📝 Note: Use the signup flow to create accounts with proper password hashing.',
  )
  console.log(
    '📝 For production, set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.',
  )
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
