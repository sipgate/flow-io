/**
 * Unit tests for OpenAIProvider.
 *
 * Covered:
 * - Model capability detection: isNewerModel (max_completion_tokens vs max_tokens)
 * - Temperature suppression for o1/o3/gpt-5 models
 * - Tool-call response mapping
 * - Regular text response mapping
 * - Usage metrics mapping
 * - Retry logic on empty content (up to 2 retries)
 * - Error thrown when all retries exhausted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIProvider } from '@/lib/llm/openai-provider'

// ─── Mock openai ─────────────────────────────────────────────────────────────

const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn()
  return { mockCreate }
})

vi.mock('openai', () => {
  // Must be a regular function so `new OpenAI(...)` works
  function MockOpenAI(this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } }
  }
  return { default: MockOpenAI }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResponse(content: string | null, finishReason = 'stop', toolCalls?: unknown[]) {
  return {
    choices: [
      {
        message: { content, tool_calls: toolCalls ?? null, refusal: null },
        finish_reason: finishReason,
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── isNewerModel detection ───────────────────────────────────────────────────

describe('OpenAIProvider — model capability detection', () => {
  it('gpt-4o uses max_completion_tokens', async () => {
    mockCreate.mockResolvedValue(makeResponse('hello'))
    const provider = new OpenAIProvider('key', 'gpt-4o')
    await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
    expect(call).toHaveProperty('max_completion_tokens')
    expect(call).not.toHaveProperty('max_tokens')
  })

  it('gpt-5-mini uses max_completion_tokens', async () => {
    mockCreate.mockResolvedValue(makeResponse('hello'))
    const provider = new OpenAIProvider('key', 'gpt-5-mini-2025-08-07')
    await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
    expect(call).toHaveProperty('max_completion_tokens')
    expect(call).not.toHaveProperty('max_tokens')
  })

  it('o3 model uses max_completion_tokens', async () => {
    mockCreate.mockResolvedValue(makeResponse('hello'))
    const provider = new OpenAIProvider('key', 'o3-mini')
    await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
    expect(call).toHaveProperty('max_completion_tokens')
    expect(call).not.toHaveProperty('max_tokens')
  })

  it('gpt-3.5-turbo uses legacy max_tokens', async () => {
    mockCreate.mockResolvedValue(makeResponse('hello'))
    const provider = new OpenAIProvider('key', 'gpt-3.5-turbo')
    await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
    expect(call).toHaveProperty('max_tokens')
    expect(call).not.toHaveProperty('max_completion_tokens')
  })
})

// ─── Temperature support ──────────────────────────────────────────────────────

describe('OpenAIProvider — temperature handling', () => {
  it('includes temperature for gpt-4o', async () => {
    mockCreate.mockResolvedValue(makeResponse('hello'))
    const provider = new OpenAIProvider('key', 'gpt-4o')
    await provider.generate({ messages: [{ role: 'user', content: 'hi' }], temperature: 0.5 })

    const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
    expect(call).toHaveProperty('temperature', 0.5)
  })

  it('omits temperature for o1 models', async () => {
    mockCreate.mockResolvedValue(makeResponse('hello'))
    const provider = new OpenAIProvider('key', 'o1-mini')
    await provider.generate({ messages: [{ role: 'user', content: 'hi' }], temperature: 0.5 })

    const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
    expect(call).not.toHaveProperty('temperature')
  })

  it('omits temperature for o3 models', async () => {
    mockCreate.mockResolvedValue(makeResponse('hello'))
    const provider = new OpenAIProvider('key', 'o3')
    await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
    expect(call).not.toHaveProperty('temperature')
  })

  it('omits temperature for gpt-5 models', async () => {
    mockCreate.mockResolvedValue(makeResponse('hello'))
    const provider = new OpenAIProvider('key', 'gpt-5')
    await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
    expect(call).not.toHaveProperty('temperature')
  })

  it('uses default temperature 0.7 when not specified for supported model', async () => {
    mockCreate.mockResolvedValue(makeResponse('hello'))
    const provider = new OpenAIProvider('key', 'gpt-3.5-turbo')
    await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
    expect(call).toHaveProperty('temperature', 0.7)
  })
})

// ─── Text response mapping ────────────────────────────────────────────────────

describe('OpenAIProvider — text response', () => {
  it('returns content and stop finish_reason', async () => {
    mockCreate.mockResolvedValue(makeResponse('Hello!', 'stop'))
    const provider = new OpenAIProvider('key', 'gpt-4o')

    const result = await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    expect(result.content).toBe('Hello!')
    expect(result.finish_reason).toBe('stop')
  })

  it('maps non-stop finish_reason to "length"', async () => {
    mockCreate.mockResolvedValue(makeResponse('...', 'length'))
    const provider = new OpenAIProvider('key', 'gpt-4o')

    const result = await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    expect(result.finish_reason).toBe('length')
  })

  it('maps usage metrics correctly', async () => {
    mockCreate.mockResolvedValue(makeResponse('ok'))
    const provider = new OpenAIProvider('key', 'gpt-4o')

    const result = await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 })
  })

  it('returns the model name', async () => {
    mockCreate.mockResolvedValue(makeResponse('ok'))
    const provider = new OpenAIProvider('key', 'gpt-4o-mini')

    const result = await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    expect(result.model).toBe('gpt-4o-mini')
  })
})

// ─── Tool-call response mapping ───────────────────────────────────────────────

describe('OpenAIProvider — tool-call response', () => {
  it('maps tool calls to LLMGenerateResponse format', async () => {
    const toolCalls = [
      { id: 'tc1', function: { name: 'get_weather', arguments: '{"city":"Berlin"}' } },
    ]
    mockCreate.mockResolvedValue(makeResponse(null, 'tool_calls', toolCalls))
    const provider = new OpenAIProvider('key', 'gpt-4o')

    const result = await provider.generate({ messages: [{ role: 'user', content: 'weather?' }] })

    expect(result.finish_reason).toBe('tool_calls')
    expect(result.tool_calls).toHaveLength(1)
    expect(result.tool_calls![0].id).toBe('tc1')
    expect(result.tool_calls![0].function.name).toBe('get_weather')
    expect(result.tool_calls![0].function.arguments).toBe('{"city":"Berlin"}')
    expect(result.tool_calls![0].type).toBe('function')
  })

  it('returns empty content string when tool call has no text content', async () => {
    const toolCalls = [{ id: 'tc1', function: { name: 'fn', arguments: '{}' } }]
    mockCreate.mockResolvedValue(makeResponse(null, 'tool_calls', toolCalls))
    const provider = new OpenAIProvider('key', 'gpt-4o')

    const result = await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    expect(result.content).toBe('')
  })
})

// ─── Retry logic ─────────────────────────────────────────────────────────────

describe('OpenAIProvider — retry on empty response', () => {
  it('retries and succeeds on second attempt', async () => {
    mockCreate
      .mockResolvedValueOnce(makeResponse(null, 'stop')) // empty first response
      .mockResolvedValueOnce(makeResponse('Retry worked!', 'stop'))

    const provider = new OpenAIProvider('key', 'gpt-4o')
    const result = await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    expect(result.content).toBe('Retry worked!')
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('retries twice and succeeds on third attempt', async () => {
    mockCreate
      .mockResolvedValueOnce(makeResponse(null, 'stop'))
      .mockResolvedValueOnce(makeResponse(null, 'stop'))
      .mockResolvedValueOnce(makeResponse('Third time lucky!', 'stop'))

    const provider = new OpenAIProvider('key', 'gpt-4o')
    const result = await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    expect(result.content).toBe('Third time lucky!')
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  it('throws after all retries exhausted (3 attempts total)', async () => {
    mockCreate.mockResolvedValue(makeResponse(null, 'stop'))

    const provider = new OpenAIProvider('key', 'gpt-4o')

    await expect(
      provider.generate({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow(/No content in OpenAI response/)

    expect(mockCreate).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
  })
})

// ─── Performance metrics ──────────────────────────────────────────────────────

describe('OpenAIProvider — performance metrics', () => {
  it('includes performance metrics in response', async () => {
    mockCreate.mockResolvedValue(makeResponse('ok'))
    const provider = new OpenAIProvider('key', 'gpt-4o')

    const result = await provider.generate({ messages: [{ role: 'user', content: 'hi' }] })

    expect(result.performance).toBeDefined()
    expect(typeof result.performance!.totalTimeMs).toBe('number')
    expect(result.performance!.totalTimeMs).toBeGreaterThanOrEqual(0)
  })
})
