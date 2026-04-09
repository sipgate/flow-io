/**
 * Regression tests for generateLLMResponse() — tool call & hesitation flow.
 *
 * Bugs covered:
 * - Tool executed more than once (hesitation enforcement loop)
 * - Hesitation not triggered (model skips hesitate tool)
 * - Hesitation enforcement: error feedback forces model to call hesitate
 * - System prompt missing hesitate rule
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateLLMResponse } from '@/lib/services/llm-conversation'
import type { LLMTool } from '@/lib/llm/types'

// --- Mocks ---

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(),
}))

vi.mock('@/lib/llm/provider', () => ({
  createLLMProvider: vi.fn(),
}))

vi.mock('@/lib/services/mcp-tool-executor', () => ({
  createMCPToolExecutor: vi.fn(),
  MCPToolExecutor: vi.fn(),
}))

vi.mock('@/lib/services/context-webhook', () => ({
  getCallContextData: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/actions/call-tools', () => ({
  getCallToolConfigServiceRole: vi.fn().mockResolvedValue(null),
  createCallNote: vi.fn().mockResolvedValue({ error: null }),
}))

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createLLMProvider } from '@/lib/llm/provider'
import { createMCPToolExecutor } from '@/lib/services/mcp-tool-executor'

// --- Test data ---

const mockMCPTool: LLMTool = {
  type: 'function',
  function: {
    name: 'stellar__datetime_current',
    description: 'Get current date/time',
    parameters: { type: 'object', properties: {}, required: [] },
  },
}

function makeAssistant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ast-1',
    name: 'Luisa',
    organization_id: 'org-1',
    llm_provider: 'google',
    llm_model: 'gemini-2.5-flash',
    llm_temperature: 0.7,
    thinking_level: null,
    system_prompt: 'Du bist Luisa.',
    enable_kb_tool: false,
    enable_hesitation: true,
    ...overrides,
  }
}

function makeSupabaseMock(assistant: Record<string, unknown>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: assistant, error: null }),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  return { from: vi.fn().mockReturnValue(chain) }
}

// LLM response helpers
const toolCallResp = (name = 'stellar__datetime_current', id = 'c1') => ({
  content: '',
  tool_calls: [{ id, type: 'function' as const, function: { name, arguments: '{}' } }],
  finish_reason: 'tool_calls' as const,
})

const hesitateResp = (message = 'Einen Moment bitte.') => ({
  content: '',
  tool_calls: [
    {
      id: 'h1',
      type: 'function' as const,
      function: { name: 'hesitate', arguments: JSON.stringify({ message }) },
    },
  ],
  finish_reason: 'tool_calls' as const,
})

const textResp = (content = 'Es ist 15:00 Uhr.') => ({
  content,
  finish_reason: 'stop' as const,
})

const baseParams = {
  assistantId: 'ast-1',
  organizationId: 'org-1',
  conversationHistory: [{ role: 'user' as const, content: 'Wie spät ist es?' }],
}

// --- Setup ---

let mockGenerate: ReturnType<typeof vi.fn>
let mockExecuteTool: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()

  mockGenerate = vi.fn()
  vi.mocked(createLLMProvider).mockReturnValue({ generate: mockGenerate as unknown as ReturnType<typeof createLLMProvider>['generate'] })

  mockExecuteTool = vi.fn().mockResolvedValue('Tool result: 15:00 Uhr')
  vi.mocked(createMCPToolExecutor).mockReturnValue({
    initialize: vi.fn().mockResolvedValue({ tools: [mockMCPTool], errors: [] }),
    executeTool: mockExecuteTool,
    cleanup: vi.fn().mockResolvedValue(undefined),
  } as unknown as InstanceType<typeof import('@/lib/services/mcp-tool-executor').MCPToolExecutor>)
})

// --- Tests ---

describe('generateLLMResponse — Tool-Call & Hesitation Regression', () => {
  it('2a: Tool executed exactly once (no hesitation)', async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeAssistant({ enable_hesitation: false })) as unknown as ReturnType<typeof createServiceRoleClient>
    )
    mockGenerate
      .mockResolvedValueOnce(toolCallResp())   // Call 1: decides to use tool
      .mockResolvedValueOnce(textResp())        // Call 2: returns answer with tool result

    const result = await generateLLMResponse(baseParams)

    expect(result.response).toBe('Es ist 15:00 Uhr.')
    expect(mockExecuteTool).toHaveBeenCalledTimes(1)
    expect(result.hesitationMessage).toBeUndefined()
    expect(mockGenerate).toHaveBeenCalledTimes(2)
  })

  it('2b: Hesitation — model calls hesitate → returned immediately, tool NOT executed', async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeAssistant()) as unknown as ReturnType<typeof createServiceRoleClient>
    )
    mockGenerate.mockResolvedValueOnce(hesitateResp('Einen Moment bitte.'))

    const result = await generateLLMResponse(baseParams)

    expect(result.response).toBe('Einen Moment bitte.')
    expect(result.hesitationMessage).toBe('Einen Moment bitte.')
    expect(mockExecuteTool).toHaveBeenCalledTimes(0)
    expect(mockGenerate).toHaveBeenCalledTimes(1)
  })

  it('2c: Hesitation enforcement — model skips hesitate → error feedback → calls hesitate on retry', async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeAssistant()) as unknown as ReturnType<typeof createServiceRoleClient>
    )
    mockGenerate
      .mockResolvedValueOnce(toolCallResp())        // Call 1: skips hesitate, calls tool directly
      .mockResolvedValueOnce(hesitateResp('Einen Moment.'))  // Call 2 (enforcement): calls hesitate

    const result = await generateLLMResponse(baseParams)

    expect(result.hesitationMessage).toBe('Einen Moment.')
    expect(result.response).toBe('Einen Moment.')
    expect(mockExecuteTool).toHaveBeenCalledTimes(0)
    expect(mockGenerate).toHaveBeenCalledTimes(2)

    // The second generate call must include the error tool result
    const secondCallMessages: { role: string; content: string }[] =
      mockGenerate.mock.calls[1][0].messages
    const errorMsg = secondCallMessages.find(
      (m) => m.role === 'tool' && m.content.includes('hesitate')
    )
    expect(errorMsg).toBeDefined()
  })

  it('2d: Follow-up with disableHesitation=true — tool executed exactly once', async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeAssistant()) as unknown as ReturnType<typeof createServiceRoleClient>
    )
    mockGenerate
      .mockResolvedValueOnce(toolCallResp())  // Call 1: tool call
      .mockResolvedValueOnce(textResp())       // Call 2: final answer

    const result = await generateLLMResponse({ ...baseParams, disableHesitation: true })

    expect(result.response).toBe('Es ist 15:00 Uhr.')
    expect(mockExecuteTool).toHaveBeenCalledTimes(1)
    expect(result.hesitationMessage).toBeUndefined()
  })

  it('2e: Enforcement fallback — model never calls hesitate → tool executed once, no crash', async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeAssistant()) as unknown as ReturnType<typeof createServiceRoleClient>
    )
    mockGenerate
      .mockResolvedValueOnce(toolCallResp())  // Call 1: skips hesitate
      .mockResolvedValueOnce(toolCallResp())  // Call 2 (enforcement): still skips hesitate
      .mockResolvedValueOnce(textResp())       // Call 3: final answer after tool exec

    const result = await generateLLMResponse(baseParams)

    expect(result.response).toBe('Es ist 15:00 Uhr.')
    expect(result.hesitationMessage).toBeUndefined()
    expect(mockExecuteTool).toHaveBeenCalledTimes(1)
  })

  it('2f: System prompt contains hesitate rule when enable_hesitation=true', async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeAssistant()) as unknown as ReturnType<typeof createServiceRoleClient>
    )
    mockGenerate.mockResolvedValueOnce(textResp('Hallo!'))

    await generateLLMResponse(baseParams)

    const firstCallMessages: { role: string; content: string }[] =
      mockGenerate.mock.calls[0][0].messages
    const systemMessage = firstCallMessages.find((m) => m.role === 'system')
    expect(systemMessage?.content).toContain('hesitate')
  })
})
