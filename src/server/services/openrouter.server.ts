/**
 * LLM Service — OpenRouter, reached through fal
 *
 * Routes LLM requests to Claude, GPT, Gemini and the rest of OpenRouter's
 * catalogue, but over fal's OpenAI-compatible proxy rather than OpenRouter
 * directly. The reason is billing: every other generator in this app already
 * runs on the user's own fal key (BYOK), so the Director does too — one key
 * per user, one invoice, no second signup.
 *
 * The wire format is plain OpenAI chat-completions. Two things differ from
 * OpenRouter proper:
 *   - the auth header is `Key <FAL_KEY>`, not `Bearer`
 *   - fal streams SSE comment lines (`: OPENROUTER PROCESSING`) as keepalives,
 *     which the parser below skips because it only reads `data: ` lines
 *
 * `usage.cost` comes back on every response as real dollars for that call, and
 * `usage.prompt_tokens_details` reports what the cache did (see CACHING below).
 *
 * Environment variables:
 * - FAL_KEY: admin/testing fallback when a user has no key of their own
 */

import { LLM_MODELS } from './types'

const MOCK_OPENROUTER = process.env.MOCK_GENERATION === 'true'
const FAL_LLM_API_URL = 'https://fal.run/openrouter/router/openai/v1'

/**
 * The Director is a tool-calling loop over a video timeline, so the default is
 * chosen for tool-use reliability rather than price — a weaker model here does
 * not read as "different style", it reads as edits silently not happening.
 */
const DEFAULT_MODEL = 'anthropic/claude-opus-5'

// =============================================================================
// Caching
// =============================================================================

/**
 * The Director resends an identical ~2.3k-token prefix (system prompt + 14 tool
 * schemas) on every iteration of its loop, up to five times per message. Root
 * `cache_control` tells OpenRouter to put a breakpoint on the last cacheable
 * block and advance it forward as the conversation grows, so each iteration
 * reads the previous one's prefix instead of paying for it again. Writes cost
 * ~1.25x and reads ~0.1x, so a loop of two or more turns is already ahead.
 *
 * Only for providers that require an explicit breakpoint. OpenAI and DeepSeek
 * cache automatically and are left alone rather than sent a flag they never
 * asked for.
 */
const EXPLICIT_CACHE_PREFIXES = ['anthropic/', 'google/', 'qwen/']

export function supportsExplicitCaching(modelId: string): boolean {
  return EXPLICIT_CACHE_PREFIXES.some((p) => modelId.startsWith(p))
}

/** the request body fields that turn caching on, or nothing at all */
function cacheFields(modelId: string): Record<string, unknown> {
  return supportsExplicitCaching(modelId)
    ? { cache_control: { type: 'ephemeral' } }
    : {}
}

function getApiKey(userApiKey?: string): string {
  if (userApiKey) return userApiKey
  const envKey = process.env.FAL_KEY
  if (envKey) return envKey
  throw new Error(
    'No fal.ai API key available. Please add your API key in settings.',
  )
}

// =============================================================================
// Types
// =============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  tool_call_id?: string
  tool_calls?: Array<ToolCall>
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string // JSON string
  }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: Array<string>
    }
  }
}

export interface ChatCompletionInput {
  messages: Array<ChatMessage>
  model?: string
  tools?: Array<ToolDefinition>
  toolChoice?:
    | 'auto'
    | 'none'
    | { type: 'function'; function: { name: string } }
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  id: string
  model: string
  choices: Array<{
    index: number
    message: ChatMessage
    finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter'
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    /** what this call actually cost, in dollars, as reported by fal */
    cost?: number
    /** what the cache did: `cached_tokens` were read, not re-billed in full */
    prompt_tokens_details?: {
      cached_tokens?: number
      cache_write_tokens?: number
    }
  }
}

export interface StreamChunk {
  id: string
  model: string
  choices: Array<{
    index: number
    delta: Partial<ChatMessage>
    finish_reason: 'stop' | 'tool_calls' | 'length' | null
  }>
}

// =============================================================================
// Main Service Functions
// =============================================================================

/**
 * Send a chat completion request (non-streaming)
 */
export async function chatCompletion(
  input: ChatCompletionInput,
  userApiKey?: string,
): Promise<ChatCompletionResponse> {
  const modelId = input.model || DEFAULT_MODEL

  if (MOCK_OPENROUTER) {
    return mockChatCompletion(input, modelId)
  }

  const apiKey = getApiKey(userApiKey)

  const response = await fetch(`${FAL_LLM_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.toolChoice,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 4096,
      stream: false,
      ...cacheFields(modelId),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LLM error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * Send a streaming chat completion request
 * Returns an async generator that yields chunks
 */
export async function* chatCompletionStream(
  input: ChatCompletionInput,
  userApiKey?: string,
): AsyncGenerator<StreamChunk, void, unknown> {
  const modelId = input.model || DEFAULT_MODEL

  if (MOCK_OPENROUTER) {
    yield* mockChatCompletionStream(input, modelId)
    return
  }

  const apiKey = getApiKey(userApiKey)

  const response = await fetch(`${FAL_LLM_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.toolChoice,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 4096,
      stream: true,
      ...cacheFields(modelId),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LLM error: ${response.status} - ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process complete SSE messages
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue

      if (trimmed.startsWith('data: ')) {
        try {
          const data = JSON.parse(trimmed.slice(6))
          yield data as StreamChunk
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}

/**
 * Calculate the approximate cost in credits for a completion
 */
export function calculateCredits(
  _modelId: string,
  _promptTokens: number,
  _completionTokens: number,
): number {
  // Credits no longer used - users pay fal.ai directly via BYOK
  // This function is kept for API compatibility but always returns 0
  return 0
}

/**
 * Is the LLM route usable without a user key? (users bring their own; this is
 * the admin/testing fallback, so it reads the same FAL_KEY as everything else)
 */
export function isOpenRouterConfigured(): boolean {
  if (MOCK_OPENROUTER) return true
  return !!process.env.FAL_KEY
}

/**
 * Get available LLM models
 */
export function getLlmModels() {
  return LLM_MODELS
}

/**
 * Get the default model ID
 */
export function getDefaultModel(): string {
  return DEFAULT_MODEL
}

// =============================================================================
// Mock Implementation
// =============================================================================

function mockChatCompletion(
  input: ChatCompletionInput,
  modelId: string,
): ChatCompletionResponse {
  const lastMessage = input.messages[input.messages.length - 1]
  const hasTools = input.tools && input.tools.length > 0

  // Simulate tool calling if tools are provided
  if (hasTools && lastMessage.role === 'user') {
    const tool = input.tools![0]
    return {
      id: `mock-${Date.now()}`,
      model: modelId,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: `call-${Date.now()}`,
                type: 'function',
                function: {
                  name: tool.function.name,
                  arguments: JSON.stringify({ mock: true }),
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    }
  }

  // Regular response
  return {
    id: `mock-${Date.now()}`,
    model: modelId,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: `This is a mock response from ${modelId}. In production, this would be a real AI response to: "${lastMessage.content?.slice(0, 50)}..."`,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  }
}

async function* mockChatCompletionStream(
  _input: ChatCompletionInput,
  modelId: string,
): AsyncGenerator<StreamChunk, void, unknown> {
  const mockResponse = `This is a mock streaming response from ${modelId}. The AI would generate content here based on your prompt.`

  const words = mockResponse.split(' ')

  for (const word of words) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50))

    yield {
      id: `mock-${Date.now()}`,
      model: modelId,
      choices: [
        {
          index: 0,
          delta: {
            content: word + ' ',
          },
          finish_reason: null,
        },
      ],
    }
  }

  // Final chunk
  yield {
    id: `mock-${Date.now()}`,
    model: modelId,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: 'stop',
      },
    ],
  }
}
