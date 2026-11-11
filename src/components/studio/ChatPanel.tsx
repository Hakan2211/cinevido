/**
 * Chat Panel — the Director.
 *
 * Streams from /api/chat (SSE). Director v2: the plan the Director proposes
 * renders inline as shot cards (PlanCard), and the composer carries the
 * project budget and the Draft | Final toggle (mockup 4).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Loader2,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatUsd } from '@/lib/pricing'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Segmented } from '../generate'
import { PlanCard } from './director/PlanCard'
import { bibleKey } from './director/useBible'
import type { Production } from './director/types'
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
  error?: string
}

interface AgentEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done'
  data: unknown
}

export type ComposerMode = 'draft' | 'final'

interface ChatPanelProps {
  projectId: string
  manifest: ProjectManifest
  onManifestChange: (manifest: ProjectManifest) => void
  collapsed: boolean
  onToggleCollapse: () => void
  /** 'panel' = Edit-tab sidebar, 'center' = Director tab, 'fullscreen' = mobile */
  mode?: 'panel' | 'center' | 'fullscreen'
  production: Production
  composerMode: ComposerMode
  onComposerModeChange: (mode: ComposerMode) => void
  onOpenStoryboard: () => void
}

/** Tools whose result changes the plan the card shows */
const PLAN_TOOLS = new Set(['proposePlan', 'updateShot', 'renderPlan'])

/** Tools whose result changes the Project Bible */
const BIBLE_TOOLS = new Set(['updateBible'])

const TOOL_LABELS: Record<string, string> = {
  proposePlan: 'Planned the shots',
  updateShot: 'Updated a shot',
  renderPlan: 'Started rendering',
  updateBible: 'Updated the Bible',
  getProjectState: 'Read the project',
  listAssets: 'Looked at the assets',
  updateTimeline: 'Edited the timeline',
  generateImage: 'Generating an image',
  generateVideo: 'Generating a video',
  generateVoiceover: 'Recorded a voiceover',
  generateMusic: 'Writing music',
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "I'm your Director. Tell me what we're making — I'll plan the shots, price them against your budget, draft them, and cut the finals together.\n\nTry: \"a 30-second ad for a specialty coffee brand, warm morning mood\".",
  timestamp: new Date(0),
}

/** sessionStorage key prefix for a brief waiting to be sent to a new project */
export const BRIEF_STORAGE_PREFIX = 'cinevido:brief:'

const BUDGET_PRESETS = [5, 10, 25, 50, 100]

// =============================================================================
// Component
// =============================================================================

export function ChatPanel({
  projectId,
  collapsed,
  onToggleCollapse,
  mode = 'panel',
  production,
  composerMode,
  onComposerModeChange,
  onOpenStoryboard,
}: ChatPanelProps) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<Array<ChatMessage>>([WELCOME])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [currentToolCalls, setCurrentToolCalls] = useState<Array<ToolCallDisplay>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const composerModeRef = useRef(composerMode)
  composerModeRef.current = composerMode

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, currentToolCalls, production.plan?.shots.length])

  // Load chat history on mount
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(`/api/chat?projectId=${projectId}`)
        if (!response.ok) return
        const data = (await response.json()) as {
          messages?: Array<{
            id: string
            role: string
            content: string
            createdAt: string
            toolCalls?: Array<{ id: string; function: { name: string } }>
          }>
        }
        if (cancelled || !data.messages?.length) return
        setMessages([
          WELCOME,
          ...data.messages.map((msg) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.createdAt),
            toolCalls: msg.toolCalls?.map((tc) => ({
              id: tc.id,
              name: tc.function.name,
              status: 'completed' as const,
            })),
          })),
        ])
      } catch (error) {
        console.error('Failed to load chat history:', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const clearHistory = async () => {
    try {
      await fetch(`/api/chat?projectId=${projectId}`, { method: 'DELETE' })
      setMessages([WELCOME])
    } catch (error) {
      console.error('Failed to clear chat history:', error)
    }
  }

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInput('')
      setIsLoading(true)
      setStreamingContent('')
      setCurrentToolCalls([])

      abortControllerRef.current = new AbortController()
      // the closure's state is stale by the time the stream ends; keep our own
      const tools: Array<ToolCallDisplay> = []
      let accumulated = ''

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            projectId,
            mode: composerModeRef.current,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`)
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue
            let event: AgentEvent
            try {
              event = JSON.parse(trimmed.slice(6))
            } catch {
              continue
            }

            if (event.type === 'text') {
              accumulated += (event.data as { content: string }).content
              setStreamingContent(accumulated)
            } else if (event.type === 'tool_call') {
              const d = event.data as { id: string; name: string }
              tools.push({ id: d.id, name: d.name, status: 'pending' })
              setCurrentToolCalls([...tools])
            } else if (event.type === 'tool_result') {
              const d = event.data as {
                id: string
                name: string
                result: { success: boolean; error?: string }
              }
              const t = tools.find((x) => x.id === d.id)
              if (t) {
                t.status = d.result.success ? 'completed' : 'failed'
                t.error = d.result.error
              }
              setCurrentToolCalls([...tools])
              if (PLAN_TOOLS.has(d.name) && d.result.success) {
                void production.refresh()
              }
              if (BIBLE_TOOLS.has(d.name) && d.result.success) {
                void queryClient.invalidateQueries({ queryKey: bibleKey(projectId) })
              }
            } else if (event.type === 'error') {
              accumulated += `\n\n**Error:** ${(event.data as { message: string }).message}`
              setStreamingContent(accumulated)
            }
          }
        }

        if (accumulated || tools.length > 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: accumulated,
              timestamp: new Date(),
              toolCalls: tools.length > 0 ? tools : undefined,
            },
          ])
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: `Sorry, I hit an error: ${(error as Error).message}`,
              timestamp: new Date(),
            },
          ])
        }
      } finally {
        setIsLoading(false)
        setStreamingContent('')
        setCurrentToolCalls([])
        abortControllerRef.current = null
      }
    },
    [isLoading, projectId, production, queryClient],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void sendMessage(input)
  }

  // A brief handed over from Home starts the conversation. It travels in
  // sessionStorage, not the URL, so prompts stay out of browser history;
  // reading it removes it, so it is sent only once.
  useEffect(() => {
    const key = `${BRIEF_STORAGE_PREFIX}${projectId}`
    const brief = sessionStorage.getItem(key)
    if (!brief) return
    sessionStorage.removeItem(key)
    void sendMessage(brief)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  if (collapsed && mode === 'panel') {
    return (
      <div className="flex h-full flex-col items-center py-4">
        <button onClick={onToggleCollapse} className="rounded-full p-2 hover:bg-muted" title="Expand chat">
          <ChevronRight className="h-4 w-4" />
        </button>
        <Sparkles className="mt-4 h-5 w-5 text-muted-foreground" />
      </div>
    )
  }

  // The plan card sits after the last message that touched the plan (or at
  // the end when history was cleared but the plan remains)
  const plan = production.plan
  let planAfter = -1
  messages.forEach((m, i) => {
    if (m.toolCalls?.some((t) => PLAN_TOOLS.has(t.name) && t.status !== 'failed')) planAfter = i
  })
  // after the Director's reply to that turn, not before it
  while (planAfter !== -1 && messages[planAfter + 1]?.role === 'assistant') planAfter++
  if (plan && planAfter === -1) planAfter = messages.length - 1
  const wide = mode !== 'panel'

  const planCard = plan ? (
    <PlanCard
      plan={plan}
      production={production}
      mode={composerMode}
      onOpenStoryboard={onOpenStoryboard}
    />
  ) : null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-primary" />
          <span className="font-medium">Director</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearHistory} className="rounded-full p-1 hover:bg-muted" title="Clear chat history">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </button>
          {mode === 'panel' && (
            <button onClick={onToggleCollapse} className="rounded-full p-1 hover:bg-muted" title="Collapse">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className={cn('mx-auto space-y-4', wide && 'max-w-3xl')}>
          {messages.map((message, i) => (
            <div key={message.id} className="space-y-3">
              {!!(message.content || message.toolCalls?.length) && (
                <Bubble message={message} />
              )}
              {i === planAfter && planCard}
            </div>
          ))}

          {(isLoading || streamingContent) && (
            <Bubble
              message={{
                id: 'streaming',
                role: 'assistant',
                content: streamingContent,
                timestamp: new Date(),
                toolCalls: currentToolCalls,
              }}
              typing={!streamingContent && currentToolCalls.length === 0}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <div className={cn('mx-auto rounded-xl border border-border bg-card', wide && 'max-w-3xl')}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendMessage(input)
              }
            }}
            rows={wide ? 2 : 1}
            placeholder="Tell the Director what to create next…"
            className="block w-full resize-none bg-transparent px-3 pt-3 text-sm outline-none placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <div className="flex items-center justify-end gap-2 px-2 pb-2">
            <BudgetPill production={production} />
            <Segmented
              size="sm"
              value={composerMode}
              onChange={onComposerModeChange}
              options={[
                { value: 'draft', label: 'Draft', title: 'Draft every shot cheaply, review, then render finals' },
                { value: 'final', label: 'Final', title: 'Skip drafts: render finals straight away' },
              ]}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Send"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Bubble({ message, typing }: { message: ChatMessage; typing?: boolean }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-3.5 py-2.5',
          isUser ? 'bg-secondary' : 'bg-card border border-border',
        )}
      >
        {!isUser && (
          <p className="mb-1 text-xs font-medium text-muted-foreground">Director</p>
        )}
        {message.content && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className={cn('space-y-1', message.content && 'mt-2 border-t border-border pt-2')}>
            {message.toolCalls.map((tool) => (
              <div key={tool.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                {tool.status === 'pending' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                {tool.status === 'completed' && <Check className="h-3 w-3 text-success" />}
                {tool.status === 'failed' && <X className="h-3 w-3 text-destructive" />}
                {!(tool.name in TOOL_LABELS) && <Wrench className="h-3 w-3" />}
                <span>{TOOL_LABELS[tool.name] ?? tool.name}</span>
                {tool.error && <span className="truncate text-destructive">— {tool.error}</span>}
              </div>
            ))}
          </div>
        )}
        {typing && (
          <div className="flex items-center gap-1 py-1">
            {[0, 150, 300].map((d) => (
              <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BudgetPill({ production }: { production: Production }) {
  const [custom, setCustom] = useState('')
  const set = (usd: number) => {
    if (Number.isFinite(usd) && usd >= 1 && usd <= 1000) production.setBudget.mutate(usd)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent"
          title="Most this production may spend on renders"
        >
          Budget {formatUsd(production.budgetUsd)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Spent {formatUsd(production.plan?.spentUsd ?? 0)} so far
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {BUDGET_PRESETS.map((usd) => (
          <DropdownMenuItem key={usd} onSelect={() => set(usd)}>
            <span className="flex-1">${usd}</span>
            {usd === production.budgetUsd && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <form
          className="flex items-center gap-1 px-2 py-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            set(Number(custom))
            setCustom('')
          }}
        >
          <span className="text-sm text-muted-foreground">$</span>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ''))}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Custom"
            inputMode="decimal"
            className="h-7 w-full rounded border border-border bg-background px-2 text-sm outline-none"
          />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
