/**
 * Agent Orchestration
 *
 * Main agent loop that processes user messages, calls tools,
 * and streams responses back to the client.
 */

import { prisma } from '../../db'
import { chatCompletion, chatCompletionStream } from '../services'
import { AGENT_TOOLS } from './tools'
import { getSystemPrompt } from './system-prompt'
import { executeTool } from './executor'
import type { ChatMessage, ToolCall } from '../services'
import type { ToolContext, ToolResult } from './executor'

// =============================================================================
// Types
// =============================================================================

export interface AgentInput {
  projectId: string
  userId: string
  userMessage: string
  model?: string
}

export type AgentEventType =
  | 'text' // Streaming text content
  | 'tool_call' // Agent is calling a tool
  | 'tool_result' // Tool execution result
  | 'error' // Error occurred
  | 'done' // Stream complete

export interface AgentEvent {
  type: AgentEventType
  data: unknown
}

export interface TextEvent {
  type: 'text'
  data: { content: string }
}

export interface ToolCallEvent {
  type: 'tool_call'
  data: { id: string; name: string; arguments: unknown }
}

export interface ToolResultEvent {
  type: 'tool_result'
  data: { id: string; name: string; result: ToolResult }
}

export interface ErrorEvent {
  type: 'error'
  data: { message: string }
}

export interface DoneEvent {
  type: 'done'
  data: { messageId?: string }
}

// Constants
const MAX_TOOL_CALLS = 10
const MAX_ITERATIONS = 5

// =============================================================================
// Chat History Management
// =============================================================================

/**
 * Load chat history from database
 */
async function loadChatHistory(projectId: string): Promise<Array<ChatMessage>> {
  const messages = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    take: 50, // Limit context window
  })

  return messages.map((msg) => {
    const base: ChatMessage = {
      role: msg.role as ChatMessage['role'],
      content: msg.content,
    }

    // Add tool calls if present
    if (msg.toolCalls) {
      base.tool_calls = JSON.parse(msg.toolCalls)
    }

    // Add tool call ID if this is a tool result
    if (msg.toolCallId) {
      base.tool_call_id = msg.toolCallId
      base.name = msg.toolName || undefined
    }

    return base
  })
}

/**
 * Save a message to chat history
 */
async function saveMessage(
  projectId: string,
  message: ChatMessage,
  toolCalls?: Array<ToolCall>,
): Promise<string> {
  const saved = await prisma.chatMessage.create({
    data: {
      projectId,
      role: message.role,
      content: message.content || '',
      toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
      toolCallId: message.tool_call_id,
      toolName: message.name,
    },
  })

  return saved.id
}

// =============================================================================
// Agent Loop
// =============================================================================

/**
 * Run the agent loop - processes user message and yields events
 */
export async function* runAgent(input: AgentInput): AsyncGenerator<AgentEvent> {
  const { projectId, userId, userMessage, model } = input

  const context: ToolContext = { userId, projectId }

  try {
    // Load project info for system prompt context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, width: true, height: true, fps: true },
    })

    if (!project) {
      yield { type: 'error', data: { message: 'Project not found' } }
      return
    }

    // Get user's preferred model
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLlmModel: true },
    })

    const llmModel =
      model || user?.preferredLlmModel || 'anthropic/claude-3.5-sonnet'

    // Build system prompt with context
    const systemPrompt = getSystemPrompt({
      projectName: project.name,
      projectDimensions: { width: project.width, height: project.height },
      fps: project.fps,
    })

    // Load existing chat history
    const history = await loadChatHistory(projectId)

    // Save the user's message
    const userMsg: ChatMessage = { role: 'user', content: userMessage }
    await saveMessage(projectId, userMsg)

    // Build messages array
    const messages: Array<ChatMessage> = [
      { role: 'system', content: systemPrompt },
      ...history,
      userMsg,
    ]

    // Agent loop - may run multiple iterations if tool calls are needed
    let iteration = 0
    let totalToolCalls = 0

    while (iteration < MAX_ITERATIONS) {
      iteration++

      // First, make a non-streaming call to check if tools need to be called
      const response = await chatCompletion({
        messages,
        model: llmModel,
        tools: AGENT_TOOLS,
        toolChoice: 'auto',
        temperature: 0.7,
      })

      const assistantMessage = response.choices[0]?.message
      if (!assistantMessage) {
        yield { type: 'error', data: { message: 'No response from LLM' } }
        return
      }

      // Check if there are tool calls
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        // Save assistant message with tool calls
        await saveMessage(
          projectId,
          assistantMessage,
          assistantMessage.tool_calls,
        )

        // Add to messages for next iteration
        messages.push(assistantMessage)

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          if (totalToolCalls >= MAX_TOOL_CALLS) {
            yield {
              type: 'error',
              data: { message: 'Maximum tool calls reached' },
            }
            break
          }

          totalToolCalls++

          // Parse arguments
          let args: unknown
          try {
            args = JSON.parse(toolCall.function.arguments)
          } catch {
            args = {}
          }

          // Emit tool call event
          yield {
            type: 'tool_call',
            data: {
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: args,
            },
          }

          // Execute the tool
          const result = await executeTool(
            toolCall.function.name,
            args,
            context,
          )

          // Emit tool result event
          yield {
            type: 'tool_result',
            data: {
              id: toolCall.id,
              name: toolCall.function.name,
              result,
            },
          }

          // Create tool result message
          const toolResultMessage: ChatMessage = {
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
          }

          // Save tool result
          await saveMessage(projectId, toolResultMessage)

          // Add to messages for next iteration
          messages.push(toolResultMessage)
        }

        // Continue loop to get next response (may have more tool calls or final response)
        continue
      }

      // No tool calls - stream the final response
      if (assistantMessage.content) {
        // For the final response, use streaming
        const streamMessages = [...messages]

        // Remove the last non-streaming response and re-request with streaming
        // This ensures we get a proper streamed response
        for await (const chunk of chatCompletionStream({
          messages: streamMessages,
          model: llmModel,
          tools: AGENT_TOOLS,
          toolChoice: 'none', // No more tool calls for final response
          temperature: 0.7,
        })) {
          const delta = chunk.choices[0]?.delta
          if (delta?.content) {
            yield { type: 'text', data: { content: delta.content } }
          }
        }

        // Save the final assistant message
        const finalMessage: ChatMessage = {
          role: 'assistant',
          content: assistantMessage.content,
        }
        const messageId = await saveMessage(projectId, finalMessage)

        yield { type: 'done', data: { messageId } }
        return
      }

      // No content and no tool calls - end
      yield { type: 'done', data: {} }
      return
    }

    // Max iterations reached
    yield {
      type: 'error',
      data: { message: 'Maximum iterations reached without completion' },
    }
  } catch (error) {
    yield {
      type: 'error',
      data: {
        message: error instanceof Error ? error.message : 'Agent error',
      },
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Clear chat history for a project
 */
export async function clearChatHistory(projectId: string): Promise<void> {
  await prisma.chatMessage.deleteMany({
    where: { projectId },
  })
}

/**
 * Get chat history for display
 */
export async function getChatHistory(projectId: string): Promise<
  Array<{
    id: string
    role: string
    content: string
    toolCalls?: Array<ToolCall>
    createdAt: Date
  }>
> {
  const messages = await prisma.chatMessage.findMany({
    where: {
      projectId,
      role: { in: ['user', 'assistant'] }, // Only user and assistant messages
    },
    orderBy: { createdAt: 'asc' },
  })

  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls) : undefined,
    createdAt: msg.createdAt,
  }))
}

// Re-export types and tools for convenience
export { AGENT_TOOLS } from './tools'
export { getSystemPrompt } from './system-prompt'
export { executeTool, type ToolContext, type ToolResult } from './executor'
