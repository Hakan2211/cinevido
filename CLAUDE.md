# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TanStack Start SaaS starter template with authentication, payments, database, and modern UI components. Built for rapid MVP development.

## Commands

### Development

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build
npm run start        # Start production server
npm run test         # Run vitest tests
npm run check        # Run prettier + eslint with fixes
```

### Database (Prisma)

```bash
npm run db:generate  # Generate Prisma client to src/generated/prisma
npm run db:push      # Push schema changes to SQLite
npm run db:migrate   # Create migration
npm run db:deploy    # Deploy migrations (production)
npm run db:studio    # Open Prisma Studio GUI
npm run db:seed      # Seed test data
```

### Adding UI Components

```bash
npx shadcn@latest add <component>
```

## Architecture

### Framework Stack

- **TanStack Start** with Nitro for full-stack React
- **TanStack Router** for file-based, type-safe routing
- **TanStack Query** for data fetching with SSR integration
- **TanStack Form** for form management with Zod validation
- **Better-Auth** for authentication (email/password + Google OAuth)
- **Prisma** with SQLite and generated client in `src/generated/prisma`
- **Stripe** for subscription payments (with mock mode)

### Route Structure

Routes use TanStack Router's file-based convention:

- `src/routes/__root.tsx` - Root layout with devtools and Toaster
- `src/routes/index.tsx` - Landing page with hero, features, pricing sections
- `src/routes/pricing.tsx` - Pricing page
- `src/routes/_auth.tsx` - Auth layout (login/signup) - public routes
- `src/routes/_auth/login.tsx` - Login page
- `src/routes/_auth/signup.tsx` - Signup page
- `src/routes/_app.tsx` - Protected app layout, requires auth
- `src/routes/_app/dashboard.tsx` - User dashboard
- `src/routes/_app/profile.tsx` - User profile and billing
- `src/routes/_app/admin.tsx` - Admin panel (admin role only)
- `src/routes/api/auth/$.ts` - Better-Auth API handler

### Server Functions

Located in `src/server/`:

- `*.server.ts` - Server-only files (functions, middleware, services)
- `services/*.server.ts` - External service integrations with mock mode support
- `services/types.ts` - Shared type definitions (not `.server.ts` since types are stripped at compile time)

**IMPORTANT: `.server.ts` Convention**

All server-only files use the `.server.ts` suffix. This is handled by a custom Vite plugin (`vite-plugin-server-only.ts`) that stubs these files for client builds, preventing server-only code (Prisma, Node.js crypto, etc.) from being bundled into the client.

### Key Patterns

**Protected Routes**: Use `beforeLoad` to check auth and redirect to `/login` if unauthenticated. Server functions are dynamically imported to ensure they're only bundled for the server:

```typescript
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const { getSessionFn } = await import('../server/auth.server')
    const session = await getSessionFn()
    if (!session?.user) throw redirect({ to: '/login' })
    return { user: session.user }
  },
})
```

**Server Functions**: Defined with `createServerFn` from `@tanstack/react-start`, can chain middleware:

```typescript
const myFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // context.user available from middleware
  })
```

**Service Layer Pattern**: External services in `src/server/services/` with mock mode:

```typescript
const MOCK_SERVICE = process.env.MOCK_SERVICE === 'true'

export async function serviceCall() {
  if (MOCK_SERVICE) return mockResponse()
  // Real implementation
}
```

**Path Aliases**: `@/*` maps to `./src/*` (configured in tsconfig.json)

### Database Models (prisma/schema.prisma)

- `User` - Users with roles, subscription status, Stripe customer ID
- `Session` - Auth sessions
- `Account` - OAuth provider accounts
- `Verification` - Magic links / email verification
- `SubscriptionEvent` - Audit log for subscription changes

## Environment Variables

Required in `.env.local`:

- `BETTER_AUTH_SECRET` - Auth secret key (min 32 chars)
- `BETTER_AUTH_URL` - App URL (http://localhost:3000 for dev)

Optional:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Payments
- `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID` - Price IDs
- `MOCK_PAYMENTS=true` - Skip Stripe in development

## Docker Deployment

```bash
# Build image
docker build -t my-app .

# Run container
docker run -p 3000:3000 -v ./data:/app/prisma/data my-app
```

The container automatically runs migrations on startup and seeds the database on first run.

## Roadmap

The relaunch plan (model catalog, pricing, redesign, Director v2) and the rules
every change follows are in [`docs/ROADMAP.md`](docs/ROADMAP.md); mockups are in
`docs/design/mockups/`. Read it before working on models, pricing, UI or the Director.
