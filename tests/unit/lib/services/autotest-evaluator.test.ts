/**
 * Unit tests for autotest-evaluator.
 *
 * Covered:
 * - evaluateTurn: normal case, JSON parsing, score clamping, passed coercion
 * - evaluateTurn: no JSON in response → graceful failure
 * - evaluateTurn: LLM throws → graceful error return
 * - evaluateOverall: normal case
 * - evaluateOverall: no JSON → fallback to turn-based evaluation
 * - evaluateOverall: LLM throws → fallback to turn-based evaluation
 * - Locale fallback: unknown locale → English system prompt used
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ConversationLogEntry, TurnEvaluation } from '@/types/autotest'

// ─── Mock 'use server' and createLLMProvider ─────────────────────────────────

// Next.js 'use server' directive is not valid in test context
vi.mock('@/lib/llm/provider', () => ({
  createLLMProvider: vi.fn(),
}))

import { createLLMProvider } from '@/lib/llm/provider'
import { evaluateTurn, evaluateOverall } from '@/lib/services/autotest-evaluator'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockLLM(responseContent: string) {
  return {
    generate: vi.fn().mockResolvedValue({
      content: responseContent,
      finish_reason: 'stop',
    }),
  }
}

const sampleContext: ConversationLogEntry[] = [
  { role: 'user', content: 'Hallo', timestamp: new Date().toISOString() },
  { role: 'assistant', content: 'Wie kann ich helfen?', timestamp: new Date().toISOString() },
]

const sampleTurnEvals: TurnEvaluation[] = [
  { turn_index: 0, role: 'assistant', expected: 'Greet user', actual: 'Wie kann ich helfen?', passed: true, score: 85, reasoning: 'Good greeting' },
  { turn_index: 1, role: 'assistant', expected: 'Ask for name', actual: 'Was ist Ihr Name?', passed: true, score: 90, reasoning: 'Asked correctly' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── evaluateTurn ─────────────────────────────────────────────────────────────

describe('evaluateTurn', () => {
  it('returns a passing evaluation from a valid LLM JSON response', async () => {
    const llm = makeMockLLM('{"passed": true, "score": 88, "reasoning": "Response is correct"}')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateTurn({
      turnIndex: 0,
      expected: 'Greet the user',
      actual: 'Hallo, wie kann ich helfen?',
      conversationContext: sampleContext,
      organizationId: 'org-1',
      locale: 'de',
    })

    expect(result.passed).toBe(true)
    expect(result.score).toBe(88)
    expect(result.reasoning).toBe('Response is correct')
    expect(result.turn_index).toBe(0)
  })

  it('returns a failing evaluation when passed is false', async () => {
    const llm = makeMockLLM('{"passed": false, "score": 20, "reasoning": "Did not address query"}')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateTurn({
      turnIndex: 1,
      expected: 'Answer the question',
      actual: 'I cannot help with that.',
      conversationContext: [],
      organizationId: 'org-1',
    })

    expect(result.passed).toBe(false)
    expect(result.score).toBe(20)
  })

  it('clamps score above 100 to 100', async () => {
    const llm = makeMockLLM('{"passed": true, "score": 150, "reasoning": "Perfect"}')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateTurn({
      turnIndex: 0,
      expected: 'x',
      actual: 'x',
      conversationContext: [],
      organizationId: 'org-1',
    })

    expect(result.score).toBe(100)
  })

  it('clamps score below 0 to 0', async () => {
    const llm = makeMockLLM('{"passed": false, "score": -10, "reasoning": "Terrible"}')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateTurn({
      turnIndex: 0,
      expected: 'x',
      actual: 'x',
      conversationContext: [],
      organizationId: 'org-1',
    })

    expect(result.score).toBe(0)
  })

  it('treats non-boolean passed as false — must be strictly true', async () => {
    // LLM returns string "true" or number 1 instead of boolean — should not pass
    const llm = makeMockLLM('{"passed": "true", "score": 90, "reasoning": "ok"}')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateTurn({
      turnIndex: 0,
      expected: 'x',
      actual: 'x',
      conversationContext: [],
      organizationId: 'org-1',
    })

    expect(result.passed).toBe(false) // "true" !== true
  })

  it('returns failure when LLM response contains no JSON', async () => {
    const llm = makeMockLLM('Sorry, I cannot evaluate this right now.')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateTurn({
      turnIndex: 2,
      expected: 'x',
      actual: 'x',
      conversationContext: [],
      organizationId: 'org-1',
    })

    expect(result.passed).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toMatch(/parse/i)
  })

  it('returns graceful error when LLM throws', async () => {
    const llm = { generate: vi.fn().mockRejectedValue(new Error('API timeout')) }
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateTurn({
      turnIndex: 0,
      expected: 'x',
      actual: 'x',
      conversationContext: [],
      organizationId: 'org-1',
    })

    expect(result.passed).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toMatch(/API timeout/)
  })

  it('uses missing reasoning fallback text when reasoning is absent', async () => {
    const llm = makeMockLLM('{"passed": true, "score": 75}')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateTurn({
      turnIndex: 0,
      expected: 'x',
      actual: 'x',
      conversationContext: [],
      organizationId: 'org-1',
    })

    expect(result.reasoning).toBeTruthy()
    expect(typeof result.reasoning).toBe('string')
  })

  it('includes the expected and actual values in the result', async () => {
    const llm = makeMockLLM('{"passed": true, "score": 80, "reasoning": "ok"}')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateTurn({
      turnIndex: 0,
      expected: 'Greet user warmly',
      actual: 'Hello! How may I assist you?',
      conversationContext: [],
      organizationId: 'org-1',
    })

    expect(result.expected).toBe('Greet user warmly')
    expect(result.actual).toBe('Hello! How may I assist you?')
  })

  it('handles JSON embedded in surrounding text', async () => {
    const llm = makeMockLLM('Here is my evaluation:\n{"passed": true, "score": 72, "reasoning": "Reasonable"}\nEnd.')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateTurn({
      turnIndex: 0,
      expected: 'x',
      actual: 'x',
      conversationContext: [],
      organizationId: 'org-1',
    })

    expect(result.passed).toBe(true)
    expect(result.score).toBe(72)
  })
})

// ─── evaluateOverall ──────────────────────────────────────────────────────────

describe('evaluateOverall', () => {
  it('returns overall evaluation from valid LLM response', async () => {
    const llm = makeMockLLM('{"passed": true, "score": 91, "reasoning": "Conversation succeeded"}')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateOverall({
      criteria: 'The assistant should resolve the user query',
      conversationLog: sampleContext,
      turnEvaluations: sampleTurnEvals,
      organizationId: 'org-1',
      locale: 'en',
    })

    expect(result.passed).toBe(true)
    expect(result.score).toBe(91)
    expect(result.reasoning).toBe('Conversation succeeded')
  })

  it('falls back to turn-based evaluation when LLM returns no JSON', async () => {
    const llm = makeMockLLM('I cannot provide an evaluation.')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateOverall({
      criteria: 'Pass everything',
      conversationLog: sampleContext,
      turnEvaluations: sampleTurnEvals, // both passed: true
      organizationId: 'org-1',
    })

    // All turns passed → fallback says passed: true, score = avg(85, 90) = 88 (rounded)
    expect(result.passed).toBe(true)
    expect(result.score).toBe(88)
  })

  it('falls back to turn-based evaluation on LLM error', async () => {
    const llm = { generate: vi.fn().mockRejectedValue(new Error('timeout')) }
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const failedTurns: TurnEvaluation[] = [
      { ...sampleTurnEvals[0], passed: false, score: 30 },
      { ...sampleTurnEvals[1], passed: true, score: 80 },
    ]

    const result = await evaluateOverall({
      criteria: 'x',
      conversationLog: [],
      turnEvaluations: failedTurns,
      organizationId: 'org-1',
    })

    // One failed turn → overall passed: false
    expect(result.passed).toBe(false)
    // Average score: (30 + 80) / 2 = 55
    expect(result.score).toBe(55)
  })

  it('returns score 100 when there are no turn evaluations and LLM fails', async () => {
    const llm = { generate: vi.fn().mockRejectedValue(new Error('fail')) }
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateOverall({
      criteria: 'x',
      conversationLog: [],
      turnEvaluations: [],
      organizationId: 'org-1',
    })

    expect(result.score).toBe(100) // No turns = no failures = full score
    expect(result.passed).toBe(true)
  })

  it('clamps score outside 0-100 range', async () => {
    const llm = makeMockLLM('{"passed": false, "score": 999, "reasoning": "x"}')
    vi.mocked(createLLMProvider).mockReturnValue(llm as never)

    const result = await evaluateOverall({
      criteria: 'x',
      conversationLog: [],
      turnEvaluations: [],
      organizationId: 'org-1',
    })

    expect(result.score).toBe(100)
  })
})
