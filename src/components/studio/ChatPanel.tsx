/**
 * Chat Panel Component
 *
 * AI Director chat interface for controlling video generation.
 * Connects to the /api/chat endpoint for streaming responses.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { Button } from '../ui/button'
import type { ProjectManifest } from '../../remotion/types'

// =============================================================================
// Types
// =============================================================================

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  toolCalls?: Array<ToolCallDisplay>
}

interface ToolCallDisplay {
  id: string
  name: string
  status: 'pending' | 'completed' | 'failed'
  result?: unknown
}

interface AgentEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done'
  data: unknown
}

interface ChatPanelProps {
  projectId: string
  manifest: ProjectManifest
  onManifestChange: (manifest: ProjectManifest) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

// =============================================================================
// Component
// =============================================================================

export function ChatPanel({
  projectId,

  manifest: _manifest,

  onManifestChange: _onManifestChange,
  collapsed,
  onToggleCollapse,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Array<ChatMessage>>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi! I\'m your AI Director. Describe the video you want to create, and I\'ll help you bring it to life.\n\nTry something like:\n- "Create a 30-second video about a day in the life of a cat"\n- "Generate 4 storyboard images for a product launch video"\n- "Add a voiceover saying \'Welcome to the future\'"',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [currentToolCalls, setCurrentToolCalls] = useState<
    Array<ToolCallDisplay>
  >([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, currentToolCalls])

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/chat?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.messages && data.messages.length > 0) {
          setMessages([
            messages[0], // Keep welcome message
            ...data.messages.map(
              (msg: {
                id: string
                role: string
                content: string
                createdAt: string
              }) => ({
                id: msg.id,
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                timestamp: new Date(msg.createdAt),
              }),
            ),
          ])
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  }

  const clearHistory = async () => {
    try {
      await fetch(`/api/chat?projectId=${projectId}`, { method: 'DELETE' })
      setMessages([messages[0]]) // Keep welcome message
    } catch (error) {
      console.error('Failed to clear chat history:', error)
    }
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() || isLoading) return

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: input.trim(),
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInput('')
      setIsLoading(true)
      setStreamingContent('')
      setCurrentToolCalls([])

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            projectId,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''
        let accumulatedContent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE messages
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed === 'data: [DONE]') continue

            if (trimmed.startsWith('data: ')) {
              try {
                const event: AgentEvent = JSON.parse(trimmed.slice(6))

                switch (event.type) {
                  case 'text': {
                    const textData = event.data as { content: string }
                    accumulatedContent += textData.content
                    setStreamingContent(accumulatedContent)
                    break
                  }

                  case 'tool_call': {
                    const toolData = event.data as {
                      id: string
                      name: string
                      arguments: unknown
                    }
                    setCurrentToolCalls((prev) => [
                      ...prev,
                      {
                        id: toolData.id,
                        name: toolData.name,
                        status: 'pending',
                      },
                    ])
                    break
                  }

                  case 'tool_result': {
                    const resultData = event.data as {
                      id: string
                      name: string
                      result: {
                        success: boolean
                        data?: unknown
                        error?: string
                      }
                    }
                    setCurrentToolCalls((prev) =>
                      prev.map((tc) =>
                        tc.id === resultData.id
                          ? {
                              ...tc,
                              status: resultData.result.success
                                ? 'completed'
                                : 'failed',
                              result: resultData.result,
                            }
                          : tc,
                      ),
                    )

                    // If timeline was updated, trigger manifest refresh
                    if (
                      resultData.name === 'updateTimeline' &&
                      resultData.result.success
                    ) {
                      // The Workspace component will poll for manifest updates
                      // but we can also trigger an immediate update here
                    }
                    break
                  }

                  case 'error': {
                    const errorData = event.data as { message: string }
                    accumulatedContent += `\n\n**Error:** ${errorData.message}`
                    setStreamingContent(accumulatedContent)
                    break
                  }

                  case 'done':
                    // Finalize the assistant message
                    break
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Add final assistant message
        if (accumulatedContent || currentToolCalls.length > 0) {
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: accumulatedContent || 'I completed the requested actions.',
            timestamp: new Date(),
            toolCalls:
              currentToolCalls.length > 0 ? [...currentToolCalls] : undefined,
          }
          setMessages((prev) => [...prev, assistantMessage])
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // User cancelled
        } else {
          const errorMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Sorry, I encountered an error: ${(error as Error).message}`,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, errorMessage])
        }
      } finally {
        setIsLoading(false)
        setStreamingContent('')
        setCurrentToolCalls([])
        abortControllerRef.current = null
      }
    },
    [input, isLoading, projectId, currentToolCalls],
  )

  const formatToolName = (name: string): string => {
    // Convert camelCase to Title Case with spaces
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

  // Collapsed state
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="rounded-full p-2 hover:bg-muted"
          title="Expand chat"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium">AI Director</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearHistory}
            className="rounded-full p-1 hover:bg-muted"
            title="Clear chat history"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="rounded-full p-1 hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {/* Tool calls display */}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                    {message.toolCalls.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        {tool.status === 'pending' && (
                          <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
                        )}
                        {tool.status === 'completed' && (
                          <Check className="h-3 w-3 text-green-500" />
                        )}
                        {tool.status === 'failed' && (
                          <X className="h-3 w-3 text-red-500" />
                        )}
                        <Wrench className="h-3 w-3 text-muted-foreground" />
                        <span>{formatToolName(tool.name)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming content */}
          {(isLoading || streamingContent) && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2">
                {streamingContent ? (
                  <p className="text-sm whitespace-pre-wrap">
                    {streamingContent}
                  </p>
                ) : currentToolCalls.length > 0 ? (
                  <div className="space-y-1">
                    {currentToolCalls.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        {tool.status === 'pending' && (
                          <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
                        )}
                        {tool.status === 'completed' && (
                          <Check className="h-3 w-3 text-green-500" />
                        )}
                        {tool.status === 'failed' && (
                          <X className="h-3 w-3 text-red-500" />
                        )}
                        <Wrench className="h-3 w-3 text-muted-foreground" />
                        <span>{formatToolName(tool.name)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your video..."
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
