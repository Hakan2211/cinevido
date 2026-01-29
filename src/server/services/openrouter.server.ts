/**
 * OpenRouter LLM Service
 *
 * Routes LLM requests to various providers (Claude, GPT-4, Gemini, etc.)
 * via OpenRouter's unified API.
 *
 * Environment variables required:
 * - OPENROUTER_API_KEY: OpenRouter API key
 * - DEFAULT_LLM_MODEL: Default model to use (optional)
 */

import { LLM_MODELS } from './types'

const MOCK_OPENROUTER = process.env.MOCK_GENERATION === 'true'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'

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
): Promise<ChatCompletionResponse> {
  const modelId =
    input.model ||
    process.env.DEFAULT_LLM_MODEL ||
    'anthropic/claude-3.5-sonnet'

  if (MOCK_OPENROUTER) {
    return mockChatCompletion(input, modelId)
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.BETTER_AUTH_URL || 'http://localhost:3000',
      'X-Title': 'Cinevido',
    },
    body: JSON.stringify({
      model: modelId,
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.toolChoice,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 4096,
      stream: false,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * Send a streaming chat completion request
 * Returns an async generator that yields chunks
 */
export async function* chatCompletionStream(
  input: ChatCompletionInput,
): AsyncGenerator<StreamChunk, void, unknown> {
  const modelId =
    input.model ||
    process.env.DEFAULT_LLM_MODEL ||
    'anthropic/claude-3.5-sonnet'

  if (MOCK_OPENROUTER) {
    yield* mockChatCompletionStream(input, modelId)
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.BETTER_AUTH_URL || 'http://localhost:3000',
      'X-Title': 'Cinevido',
    },
    body: JSON.stringify({
      model: modelId,
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.toolChoice,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 4096,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter error: ${response.status} - ${error}`)
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
 * Check if OpenRouter is configured
 */
export function isOpenRouterConfigured(): boolean {
  if (MOCK_OPENROUTER) return true
  return !!process.env.OPENROUTER_API_KEY
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
  return process.env.DEFAULT_LLM_MODEL || 'anthropic/claude-3.5-sonnet'
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
