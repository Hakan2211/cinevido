/**
 * Live cache check — costs real money, so it only runs when you opt in:
 *
 *   LIVE_FAL_KEY=<your fal key> npx vitest run src/server/services/llm-cache.live.test.ts
 *
 * Without LIVE_FAL_KEY (i.e. in `npm run test`) every case skips. The gate is
 * deliberately *not* FAL_KEY, so a configured environment cannot start billing
 * itself by surprise.
 *
 * What it pins: the Director's prefix is cached across iterations, and models
 * whose providers cache automatically are not sent a breakpoint they never
 * asked for. Both behaviours are undocumented on fal's side, so a silent
 * regression here would only ever show up on an invoice.
 */

import { describe, expect, it } from 'vitest'
import { chatCompletion, supportsExplicitCaching } from './openrouter.server'
import { AGENT_TOOLS } from '../agent/tools.server'
import { getSystemPrompt } from '../agent/system-prompt.server'

const key = process.env.LIVE_FAL_KEY
const live = it.skipIf(!key)

const system = getSystemPrompt({
  projectName: 'Cache Probe',
  projectDimensions: { width: 1080, height: 1920 },
  fps: 30,
})

const ask = (model: string) =>
  chatCompletion(
    {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'What is on the timeline?' },
      ],
      tools: AGENT_TOOLS,
      toolChoice: 'auto',
      temperature: 0,
    },
    key,
  )

describe('prompt caching through fal', () => {
  live(
    'reads the Director prefix from cache on the second call',
    async () => {
      await ask('anthropic/claude-opus-5') // cold: writes the prefix
      const warm = await ask('anthropic/claude-opus-5')
      expect(
        warm.usage.prompt_tokens_details?.cached_tokens ?? 0,
      ).toBeGreaterThan(1000)
    },
    180_000,
  )

  live(
    'still answers for a provider that caches automatically',
    async () => {
      const res = await ask('openai/gpt-5')
      expect(res.choices.length).toBeGreaterThan(0)
    },
    180_000,
  )
})

describe('which models get an explicit breakpoint', () => {
  it('covers the providers that require one, and no others', () => {
    expect(supportsExplicitCaching('anthropic/claude-opus-5')).toBe(true)
    expect(supportsExplicitCaching('google/gemini-2.5-pro')).toBe(true)
    expect(supportsExplicitCaching('openai/gpt-5')).toBe(false)
    expect(supportsExplicitCaching('deepseek/deepseek-chat')).toBe(false)
  })
})
