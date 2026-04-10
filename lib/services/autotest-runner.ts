'use server'

import { debug } from '@/lib/utils/logger'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { generateLLMResponse } from './llm-conversation'
import { evaluateTurn, evaluateOverall } from './autotest-evaluator'
import type {
  TestCase,
  TestRun,
  ConversationTurn,
  ConversationLogEntry,
  TurnEvaluation,
  EvaluationResult,
} from '@/types/autotest'

// Helper types for raw data from Supabase (before typing is generated)
interface RawTestRunData {
  id: string
  test_suite_id: string | null
  test_case_id: string | null
  organization_id: string
  assistant_id: string
  status: string
  conversation_log: unknown
  evaluation_result: unknown
  error_message: string | null
  duration_ms: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface RawSuiteData {
  id: string
  organization_id: string
  assistant_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  test_cases?: TestCase[]
}

interface RunTestCaseParams {
  testCase: TestCase
  assistantId: string
  organizationId: string
  testSuiteId?: string
  locale?: string
  promptOverride?: string
}

interface RunTestCaseResult {
  run: TestRun | null
  error?: string
}

/**
 * Run a single test case against an assistant
 * This executes the conversation flow and evaluates each assistant response
 */
export async function runTestCase(params: RunTestCaseParams): Promise<RunTestCaseResult> {
  const { testCase, assistantId, organizationId, testSuiteId, locale = 'en', promptOverride } = params
  const supabase = createServiceRoleClient()
  const startTime = Date.now()

  // Create test run record
  const { data: run, error: createError } = await supabase
    .from('test_runs')
    .insert({
      test_suite_id: testSuiteId || testCase.test_suite_id,
      test_case_id: testCase.id,
      organization_id: organizationId,
      assistant_id: assistantId,
      status: 'running',
      started_at: new Date().toISOString(),
      prompt_override: promptOverride || null,
    })
    .select()
    .single()

  if (createError || !run) {
    console.error('[Autotest Runner] Error creating test run:', createError)
    return { run: null, error: createError?.message || 'Failed to create test run' }
  }

  const runData = run as unknown as RawTestRunData

  const conversationLog: ConversationLogEntry[] = []
  const turnEvaluations: TurnEvaluation[] = []
  let hasError = false
  let errorMessage: string | undefined

  try {
    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    let turnIndex = 0

    // Process each turn in the conversation flow
    for (const turn of testCase.conversation_flow as ConversationTurn[]) {
      if (turn.role === 'user') {
        // User turn - add message to history and log
        conversationHistory.push({
          role: 'user',
          content: turn.content || '',
        })

        conversationLog.push({
          role: 'user',
          content: turn.content || '',
          timestamp: new Date().toISOString(),
        })
      } else if (turn.role === 'assistant') {
        // Assistant turn - generate response and evaluate
        const response = await generateLLMResponse({
          assistantId,
          organizationId,
          conversationHistory,
          promptOverride,
        })

        if (response.error) {
          hasError = true
          errorMessage = response.error
          break
        }

        const actualResponse = response.response

        // Add to history and log
        conversationHistory.push({
          role: 'assistant',
          content: actualResponse,
        })

        conversationLog.push({
          role: 'assistant',
          content: actualResponse,
          timestamp: new Date().toISOString(),
          // Include performance metrics
          performance: response.performance,
          model: response.model,
        })

        // Evaluate this turn if there's an expected criteria
        if (turn.expected) {
          const evaluation = await evaluateTurn({
            turnIndex,
            expected: turn.expected,
            actual: actualResponse,
            conversationContext: conversationLog,
            organizationId,
            locale,
          })

          turnEvaluations.push(evaluation)
        }

        turnIndex++
      }
    }

    // Run overall evaluation if criteria provided
    let overallEvaluation = {
      passed: true,
      score: 100,
      reasoning: 'All turn evaluations passed',
    }

    if (!hasError) {
      // Check if any turn failed
      const anyTurnFailed = turnEvaluations.some((e) => !e.passed)

      if (testCase.evaluation_criteria) {
        // Use LLM for overall evaluation
        overallEvaluation = await evaluateOverall({
          criteria: testCase.evaluation_criteria,
          conversationLog,
          turnEvaluations,
          organizationId,
          locale,
        })
      } else if (anyTurnFailed) {
        // No criteria but turns failed
        overallEvaluation = {
          passed: false,
          score: Math.round(
            (turnEvaluations.filter((e) => e.passed).length / turnEvaluations.length) * 100
          ),
          reasoning: 'One or more turn evaluations failed',
        }
      }
    }

    // Determine final status based on score primarily
    // passed: evaluator said passed AND score >= 80
    // partial: score >= 50 (covers high scores with issues, like 90/100 but passed=false)
    // failed: score < 50
    let status: 'passed' | 'partial' | 'failed' | 'error' = 'passed'
    if (hasError) {
      status = 'error'
    } else if (overallEvaluation.passed && overallEvaluation.score >= 80) {
      status = 'passed'
    } else if (overallEvaluation.score >= 50) {
      status = 'partial' // Either not fully passed or score below 80
    } else {
      status = 'failed'
    }

    const durationMs = Date.now() - startTime

    // Update test run with results
    const evaluationResult: EvaluationResult = {
      turn_evaluations: turnEvaluations,
      overall_evaluation: overallEvaluation,
    }

    const { data: updatedRun, error: updateError } = await supabase
      .from('test_runs')
      .update({
        status,
        conversation_log: conversationLog,
        evaluation_result: evaluationResult,
        error_message: errorMessage,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runData.id)
      .select()
      .single()

    if (updateError) {
      console.error('[Autotest Runner] Error updating test run:', updateError)
      return { run: runData as TestRun, error: updateError.message }
    }

    debug('[Autotest Runner] Test completed:', {
      testCaseId: testCase.id,
      status,
      durationMs,
      turnsEvaluated: turnEvaluations.length,
    })

    return { run: updatedRun as unknown as TestRun, error: undefined }
  } catch (error) {
    console.error('[Autotest Runner] Unexpected error:', error)

    // Update test run with error
    await supabase
      .from('test_runs')
      .update({
        status: 'error',
        error_message: String(error),
        duration_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runData.id)

    return { run: runData as TestRun, error: String(error) }
  }
}

interface RunTestSuiteParams {
  suiteId: string
  organizationId: string
}

interface RunTestSuiteResult {
  runs: TestRun[]
  summary: {
    total: number
    passed: number
    failed: number
    errors: number
    duration_ms: number
  }
  error?: string
}

/**
 * Run all test cases in a test suite
 */
export async function runTestSuite(params: RunTestSuiteParams): Promise<RunTestSuiteResult> {
  const { suiteId, organizationId } = params
  const supabase = createServiceRoleClient()
  const startTime = Date.now()

  // Fetch suite and test cases
  const { data: suite, error: suiteError } = await supabase
    .from('test_suites')
    .select('*, test_cases(*)')
    .eq('id', suiteId)
    .single()

  if (suiteError || !suite) {
    return {
      runs: [],
      summary: { total: 0, passed: 0, failed: 0, errors: 0, duration_ms: 0 },
      error: suiteError?.message || 'Suite not found',
    }
  }

  const suiteData = suite as unknown as RawSuiteData

  const testCases = (suiteData.test_cases || [])
    .filter((tc) => tc.is_active)
    .sort((a, b) => a.position - b.position)

  const runs: TestRun[] = []
  let passed = 0
  let failed = 0
  let errors = 0

  // Run each test case sequentially to avoid rate limits
  for (const testCase of testCases) {
    const result = await runTestCase({
      testCase,
      assistantId: suiteData.assistant_id,
      organizationId,
      testSuiteId: suiteId,
    })

    if (result.run) {
      runs.push(result.run)

      if (result.run.status === 'passed') {
        passed++
      } else if (result.run.status === 'failed') {
        failed++
      } else {
        errors++
      }
    } else {
      errors++
    }
  }

  return {
    runs,
    summary: {
      total: testCases.length,
      passed,
      failed,
      errors,
      duration_ms: Date.now() - startTime,
    },
  }
}
