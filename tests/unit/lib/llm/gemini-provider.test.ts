/**
 * Regression tests for GeminiProvider tool-call flow.
 *
 * Bugs covered:
 * - "Gemini returns empty STOP response after tool call" (missing functionCall in history)
 * - Tool names must stay as __ format (not converted back to :)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GeminiProvider } from '@/lib/llm/gemini-provider'
import type { LLMMessage } from '@/lib/llm/types'

// --- Mock @google/generative-ai ---
// vi.fn(() => arrowFn) cannot be used as a constructor — use a real function in vi.hoisted.

const { mocks, MockGoogleGenerativeAI, MockSchemaType } = vi.hoisted(() => {
  const sendMessage = vi.fn()
  const startChat = vi.fn(() => ({ sendMessage }))
  const getGenerativeModel = vi.fn(() => ({ startChat }))

  // Must be a regular function (not arrow) so `new` works
  function MockGoogleGenerativeAI(this: Record<string, unknown>) {
    this.getGenerativeModel = getGenerativeModel
  }

  return {
    mocks: { sendMessage, startChat, getGenerativeModel },
    MockGoogleGenerativeAI,
    MockSchemaType: {
      STRING: 'STRING', NUMBER: 'NUMBER', INTEGER: 'INTEGER',
      BOOLEAN: 'BOOLEAN', ARRAY: 'ARRAY', OBJECT: 'OBJECT',
    },
  }
})

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: MockGoogleGenerativeAI,
  SchemaType: MockSchemaType,
}))

// --- Helpers ---

function makeTextResponse(text: string) {
  return {
    response: {
      functionCalls: () => null,
      text: () => text,
      candidates: [{ finishReason: 'STOP', safetyRatings: [] }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    },
  }
}

function makeEmptyStopResponse() {
  return {
    response: {
      functionCalls: () => null,
      text: () => { throw new Error('no text') },
      candidates: [{ finishReason: 'STOP', safetyRatings: [], content: { role: 'model' } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0, totalTokenCount: 10 },
    },
  }
}

// Messages representing the state AFTER a tool was called and returned a result
const messagesAfterToolCall: LLMMessage[] = [
  { role: 'system', content: 'Du bist Luisa.' },
  { role: 'user', content: 'Wie spät ist es?' },
  {
    role: 'assistant',
    content: '',
    tool_calls: [
      { id: 'c1', type: 'function', function: { name: 'stellar__datetime_current', arguments: '{}' } },
    ],
  },
  { role: 'tool', content: 'Es ist 15:00 Uhr', tool_call_id: 'c1', name: 'stellar__datetime_current' },
]

// --- Setup ---

beforeEach(() => {
  vi.clearAllMocks()
  mocks.startChat.mockReturnValue({ sendMessage: mocks.sendMessage })
  mocks.getGenerativeModel.mockReturnValue({ startChat: mocks.startChat })
})

// --- Tests ---

describe('GeminiProvider — Tool-Call Regression', () => {
  it('1a: Tool names with __ separator are not modified', async () => {
    const provider = new GeminiProvider('test-key', 'gemini-2.5-flash')
    mocks.sendMessage.mockResolvedValue(makeTextResponse('Antwort'))

    await provider.generate({
      messages: [{ role: 'user', content: 'Test' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'stellar__datetime_current',
            description: 'Get date',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
      ],
    })

    const modelOptions = (mocks.getGenerativeModel.mock.calls as unknown as Array<[{ tools?: Array<{ functionDeclarations?: Array<{ name: string }> }> }]>)[0]?.[0]
    const toolDeclarations = modelOptions?.tools?.[0]?.functionDeclarations ?? []
    // Name must stay stellar__datetime_current — NOT stellar:datetime_current
    expect(toolDeclarations[0]?.name).toBe('stellar__datetime_current')
  })

  it('1b (key regression): history includes functionCall BEFORE functionResponse', async () => {
    // Bug: Gemini received functionResponse without a preceding functionCall in history
    // → returned empty STOP response. Fix: consolidate tool_calls into assistant message
    // and convert it to a Gemini functionCall part in convertHistoryMessages().

    const provider = new GeminiProvider('test-key', 'gemini-2.5-flash')
    mocks.sendMessage.mockResolvedValue(makeTextResponse('Es ist 15:00 Uhr.'))

    await provider.generate({ messages: messagesAfterToolCall })

    const chatOptions = (mocks.startChat.mock.calls as unknown as Array<[{ history: Array<{ role: string; parts: Array<Record<string, unknown>> }> }]>)[0]?.[0]

    // history must have: [user message, model message with functionCall]
    expect(chatOptions.history).toHaveLength(2)
    expect(chatOptions.history[0].role).toBe('user')
    expect(chatOptions.history[1].role).toBe('model')
    expect(chatOptions.history[1].parts[0]).toHaveProperty('functionCall')
    expect((chatOptions.history[1].parts[0].functionCall as Record<string, unknown>).name).toBe('stellar__datetime_current')

    // sendMessage must receive the functionResponse
    const sendArg = mocks.sendMessage.mock.calls[0][0]
    expect(Array.isArray(sendArg)).toBe(true)
    expect(sendArg[0]).toHaveProperty('functionResponse')
    expect(sendArg[0].functionResponse.name).toBe('stellar__datetime_current')
    expect(sendArg[0].functionResponse.response.content).toBe('Es ist 15:00 Uhr')
  })

  it('1c: Returns correct text response after tool call', async () => {
    const provider = new GeminiProvider('test-key', 'gemini-2.5-flash')
    mocks.sendMessage.mockResolvedValue(makeTextResponse('Es ist 15:00 Uhr.'))

    const result = await provider.generate({ messages: messagesAfterToolCall })

    expect(result.content).toBe('Es ist 15:00 Uhr.')
    expect(result.finish_reason).toBe('stop')
  })

  it('1d: STOP with empty content returns fallback — does not crash', async () => {
    // Bug: Gemini returned empty STOP response after tool call → provider threw/crashed
    const provider = new GeminiProvider('test-key', 'gemini-2.5-flash')
    mocks.sendMessage.mockResolvedValue(makeEmptyStopResponse())

    const result = await provider.generate({
      messages: [{ role: 'user', content: 'Wie spät ist es?' }],
    })

    expect(result.content).toBeTruthy()
    expect(result.content.length).toBeGreaterThan(0)
  })
})
