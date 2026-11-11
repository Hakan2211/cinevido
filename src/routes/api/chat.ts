/**
 * Chat API Endpoint
 *
 * Streaming endpoint for the AI Director chat.
 * Uses Server-Sent Events (SSE) format compatible with useChat from @ai-sdk/react.
 */

import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../lib/auth.server'
import { prisma } from '../../db.server'
import {
  clearChatHistory,
  getChatHistory,
  runAgent,
} from '../../server/agent/index.server'

// =============================================================================
// Types
// =============================================================================

interface ChatRequest {
  message: string
  projectId: string
  model?: string
  mode?: 'draft' | 'final'
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a Server-Sent Events stream
 */
function createSSEStream(
  generator: AsyncGenerator<{ type: string; data: unknown }>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generator) {
          // Format as SSE
          const data = JSON.stringify(event)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }

        // Send done event
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        const errorEvent = {
          type: 'error',
          data: {
            message: error instanceof Error ? error.message : 'Stream error',
          },
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`),
        )
        controller.close()
      }
    },
  })
}

/**
 * Validate the session from request
 */
async function getSessionFromRequest(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    return session
  } catch {
    return null
  }
}

/** Whether the signed-in user owns the project */
async function ownsProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })
  return project?.userId === userId
}

const notFound = () =>
  new Response(JSON.stringify({ error: 'Project not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })

// =============================================================================
// Route Handler
// =============================================================================

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      /**
       * POST /api/chat - Send a message and get streaming response
       */
      POST: async ({ request }) => {
        // Validate auth
        const session = await getSessionFromRequest(request)
        if (!session?.user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Parse request body
        let body: ChatRequest
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Validate required fields
        if (!body.message || !body.projectId) {
          return new Response(
            JSON.stringify({ error: 'message and projectId are required' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        if (!(await ownsProject(body.projectId, session.user.id))) {
          return notFound()
        }

        // Create the agent generator
        const agentGenerator = runAgent({
          projectId: body.projectId,
          userId: session.user.id,
          userMessage: body.message,
          model: body.model,
          mode: body.mode === 'final' ? 'final' : 'draft',
        })

        // Create SSE stream
        const stream = createSSEStream(agentGenerator)

        // Return streaming response
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },

      /**
       * GET /api/chat?projectId=xxx - Get chat history
       */
      GET: async ({ request }) => {
        // Validate auth
        const session = await getSessionFromRequest(request)
        if (!session?.user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Parse query params
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId')

        if (!projectId) {
          return new Response(
            JSON.stringify({ error: 'projectId is required' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        if (!(await ownsProject(projectId, session.user.id))) {
          return notFound()
        }

        // Get chat history
        const history = await getChatHistory(projectId)

        return new Response(JSON.stringify({ messages: history }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },

      /**
       * DELETE /api/chat?projectId=xxx - Clear chat history
       */
      DELETE: async ({ request }) => {
        // Validate auth
        const session = await getSessionFromRequest(request)
        if (!session?.user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Parse query params
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId')

        if (!projectId) {
          return new Response(
            JSON.stringify({ error: 'projectId is required' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        if (!(await ownsProject(projectId, session.user.id))) {
          return notFound()
        }

        // Clear chat history
        await clearChatHistory(projectId)

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
