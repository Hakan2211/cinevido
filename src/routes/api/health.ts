/**
 * Health Check API Endpoint
 *
 * Lightweight endpoint for Docker/Coolify health checks.
 * Returns 200 immediately without touching the database or SSR pipeline,
 * so the container stays "healthy" even if heavier subsystems are slow.
 */

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({ status: 'ok', timestamp: Date.now() }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      },
    },
  },
})
