'use server'

import { createClient } from '@/lib/supabase/server'
import { createPromptVersion } from './prompt-versions'
import type {
  TestSuite,
  TestSuiteInsert,
  TestSuiteUpdate,
  TestSuiteWithRelations,
  TestCase,
  TestCaseInsert,
  TestCaseUpdate,
  TestCaseWithRelations,
  TestRun,
  TestRunInsert,
  TestRunUpdate,
  TestRunWithRelations,
  ConversationTurn,
} from '@/types/autotest'

// ============================================================================
// Test Suites
// ============================================================================

// Helper types for raw data from Supabase (before typing is generated)
interface RawSuiteData {
  id: string
  organization_id: string
  assistant_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  assistants: { id: string; name: string } | null
}

interface RawTestCaseData {
  id: string
  test_suite_id: string
  organization_id: string
  name: string
  description: string | null
  conversation_flow: unknown
  evaluation_criteria: string | null
  position: number
  is_active: boolean
  created_at: string
  updated_at: string
  test_suites?: unknown
}

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
  assistants?: { id: string; name: string } | null
  test_suites?: unknown
  test_cases?: unknown
}

/**
 * Get all test suites for an organization
 */
export async function getTestSuites(organizationId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('test_suites')
    .select(`
      *,
      assistants (id, name)
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching test suites:', error)
    return { suites: [], error: error.message }
  }

  const rawData = data as unknown as RawSuiteData[]

  // Get test case counts and latest run for each suite
  const suitesWithStats = await Promise.all(
    (rawData || []).map(async (suite) => {
      // Get test cases with their latest runs including evaluation results
      const { data: testCases } = await supabase
        .from('test_cases')
        .select(`
          id,
          test_runs (
            status,
            evaluation_result,
            completed_at,
            created_at
          )
        `)
        .eq('test_suite_id', suite.id)
        .eq('is_active', true)

      const caseCount = testCases?.length || 0

      // For each test case, determine pass/partial/fail based on latest run only
      let passedCount = 0
      let partialCount = 0
      let failedCount = 0
      let lastRunAt: string | null = null
      const scores: number[] = []

      for (const tc of testCases || []) {
        const runs = tc.test_runs as Array<{
          status: string
          evaluation_result: { overall_evaluation?: { score?: number } } | null
          completed_at: string
          created_at: string
        }> | null
        if (runs && runs.length > 0) {
          // Sort by created_at descending to get latest run
          const latestRun = runs.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]

          if (latestRun.status === 'passed') {
            passedCount++
          } else if (latestRun.status === 'partial') {
            partialCount++
          } else if (latestRun.status === 'failed' || latestRun.status === 'error') {
            failedCount++
          }

          // Collect score for average calculation
          const score = latestRun.evaluation_result?.overall_evaluation?.score
          if (score != null) {
            scores.push(score)
          }

          // Track overall last run time
          if (!lastRunAt || new Date(latestRun.completed_at) > new Date(lastRunAt)) {
            lastRunAt = latestRun.completed_at
          }
        }
      }

      // Calculate average score
      const averageScore = scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        : null

      return {
        ...suite,
        assistant: suite.assistants,
        stats: {
          total_cases: caseCount || 0,
          passed: passedCount,
          partial: partialCount,
          failed: failedCount,
          average_score: averageScore,
          last_run_at: lastRunAt,
        },
      }
    })
  )

  return { suites: suitesWithStats as TestSuiteWithRelations[], error: null }
}

/**
 * Get a single test suite by ID
 */
export async function getTestSuite(suiteId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('test_suites')
    .select(`
      *,
      assistants (id, name)
    `)
    .eq('id', suiteId)
    .single()

  if (error) {
    console.error('Error fetching test suite:', error)
    return { suite: null, error: error.message }
  }

  const rawData = data as unknown as RawSuiteData

  return {
    suite: {
      ...rawData,
      assistant: rawData.assistants,
    } as TestSuiteWithRelations,
    error: null,
  }
}

/**
 * Create a new test suite
 */
export async function createTestSuite(data: TestSuiteInsert) {
  const supabase = await createClient()

  const { data: suite, error } = await supabase
    .from('test_suites')
    .insert(data)
    .select()
    .single()

  if (error) {
    console.error('Error creating test suite:', error)
    return { suite: null, error: error.message }
  }

  return { suite: suite as unknown as TestSuite, error: null }
}

/**
 * Update a test suite
 */
export async function updateTestSuite(suiteId: string, data: TestSuiteUpdate) {
  const supabase = await createClient()

  const { data: suite, error } = await supabase
    .from('test_suites')
    .update(data)
    .eq('id', suiteId)
    .select()
    .single()

  if (error) {
    console.error('Error updating test suite:', error)
    return { suite: null, error: error.message }
  }

  return { suite: suite as unknown as TestSuite, error: null }
}

/**
 * Delete a test suite (soft delete by setting is_active to false)
 */
export async function deleteTestSuite(suiteId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('test_suites')
    .update({ is_active: false })
    .eq('id', suiteId)

  if (error) {
    console.error('Error deleting test suite:', error)
    return { error: error.message }
  }

  return { error: null }
}

// ============================================================================
// Test Cases
// ============================================================================

/**
 * Get all test cases for a suite
 */
export async function getTestCases(suiteId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('test_cases')
    .select('*')
    .eq('test_suite_id', suiteId)
    .eq('is_active', true)
    .order('position', { ascending: true })

  if (error) {
    console.error('Error fetching test cases:', error)
    return { cases: [], error: error.message }
  }

  const rawData = data as unknown as RawTestCaseData[]

  // Get latest run for each test case
  const casesWithRuns = await Promise.all(
    (rawData || []).map(async (testCase) => {
      const { data: latestRun } = await supabase
        .from('test_runs')
        .select('*')
        .eq('test_case_id', testCase.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      return {
        ...testCase,
        conversation_flow: testCase.conversation_flow as ConversationTurn[],
        latest_run: latestRun as TestRun | null,
      }
    })
  )

  return { cases: casesWithRuns as TestCaseWithRelations[], error: null }
}

/**
 * Get a single test case by ID
 */
export async function getTestCase(caseId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('test_cases')
    .select(`
      *,
      test_suites (*)
    `)
    .eq('id', caseId)
    .single()

  if (error) {
    console.error('Error fetching test case:', error)
    return { testCase: null, error: error.message }
  }

  const rawData = data as unknown as RawTestCaseData

  // Get latest run
  const { data: latestRun } = await supabase
    .from('test_runs')
    .select('*')
    .eq('test_case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return {
    testCase: {
      ...rawData,
      conversation_flow: rawData.conversation_flow as ConversationTurn[],
      test_suite: rawData.test_suites as TestSuite,
      latest_run: latestRun as TestRun | null,
    } as TestCaseWithRelations,
    error: null,
  }
}

/**
 * Create a new test case
 */
export async function createTestCase(data: TestCaseInsert) {
  const supabase = await createClient()

  // Get max position for this suite
  const { data: maxPos } = await supabase
    .from('test_cases')
    .select('position')
    .eq('test_suite_id', data.test_suite_id)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const position = (maxPos?.position ?? -1) + 1

  const { data: testCase, error } = await supabase
    .from('test_cases')
    .insert({ ...data, position })
    .select()
    .single()

  if (error) {
    console.error('Error creating test case:', error)
    return { testCase: null, error: error.message }
  }

  const rawData = testCase as unknown as RawTestCaseData

  return {
    testCase: {
      ...rawData,
      conversation_flow: rawData.conversation_flow as ConversationTurn[],
    } as TestCase,
    error: null,
  }
}

/**
 * Update a test case
 */
export async function updateTestCase(caseId: string, data: TestCaseUpdate) {
  const supabase = await createClient()

  const { data: testCase, error } = await supabase
    .from('test_cases')
    .update(data)
    .eq('id', caseId)
    .select()
    .single()

  if (error) {
    console.error('Error updating test case:', error)
    return { testCase: null, error: error.message }
  }

  const rawData = testCase as unknown as RawTestCaseData

  return {
    testCase: {
      ...rawData,
      conversation_flow: rawData.conversation_flow as ConversationTurn[],
    } as TestCase,
    error: null,
  }
}

/**
 * Delete a test case (soft delete)
 */
export async function deleteTestCase(caseId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('test_cases')
    .update({ is_active: false })
    .eq('id', caseId)

  if (error) {
    console.error('Error deleting test case:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Reorder test cases within a suite
 */
export async function reorderTestCases(suiteId: string, caseIds: string[]) {
  const supabase = await createClient()

  // Update positions for each case
  const updates = caseIds.map((id, index) =>
    supabase
      .from('test_cases')
      .update({ position: index })
      .eq('id', id)
      .eq('test_suite_id', suiteId)
  )

  const results = await Promise.all(updates)
  const errors = results.filter((r) => r.error)

  if (errors.length > 0) {
    console.error('Error reordering test cases:', errors)
    return { error: 'Failed to reorder some test cases' }
  }

  return { error: null }
}

// ============================================================================
// Test Runs
// ============================================================================

/**
 * Get test runs for a test case
 */
export async function getTestRuns(testCaseId: string, limit: number = 20) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('test_runs')
    .select(`
      *,
      assistants (id, name)
    `)
    .eq('test_case_id', testCaseId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching test runs:', error)
    return { runs: [], error: error.message }
  }

  const rawData = data as unknown as RawTestRunData[]

  return {
    runs: (rawData || []).map((run) => ({
      ...run,
      assistant: run.assistants,
    })) as TestRunWithRelations[],
    error: null,
  }
}

/**
 * Get a single test run by ID
 */
export async function getTestRun(runId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('test_runs')
    .select(`
      *,
      test_suites (*),
      test_cases (*),
      assistants (id, name)
    `)
    .eq('id', runId)
    .single()

  if (error) {
    console.error('Error fetching test run:', error)
    return { run: null, error: error.message }
  }

  const rawData = data as unknown as RawTestRunData

  return {
    run: {
      ...rawData,
      test_suite: rawData.test_suites as TestSuite,
      test_case: rawData.test_cases as TestCase,
      assistant: rawData.assistants,
    } as TestRunWithRelations,
    error: null,
  }
}

/**
 * Create a new test run
 */
export async function createTestRun(data: TestRunInsert) {
  const supabase = await createClient()

  const { data: run, error } = await supabase
    .from('test_runs')
    .insert({
      ...data,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating test run:', error)
    return { run: null, error: error.message }
  }

  return { run: run as unknown as TestRun, error: null }
}

/**
 * Update a test run
 */
export async function updateTestRun(runId: string, data: TestRunUpdate) {
  const supabase = await createClient()

  const { data: run, error } = await supabase
    .from('test_runs')
    .update(data)
    .eq('id', runId)
    .select()
    .single()

  if (error) {
    console.error('Error updating test run:', error)
    return { run: null, error: error.message }
  }

  return { run: run as unknown as TestRun, error: null }
}

/**
 * Cancel a running test
 */
export async function cancelTestRun(testCaseId: string) {
  const supabase = await createClient()

  // Find the running test for this test case
  const { data: runningTest, error: findError } = await supabase
    .from('test_runs')
    .select('id')
    .eq('test_case_id', testCaseId)
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (findError || !runningTest) {
    return { success: false, error: 'No running test found' }
  }

  // Update the test run status to error with a cancellation message
  const { error: updateError } = await supabase
    .from('test_runs')
    .update({
      status: 'error',
      error_message: 'Test cancelled by user',
      completed_at: new Date().toISOString(),
    })
    .eq('id', runningTest.id)

  if (updateError) {
    console.error('Error cancelling test run:', updateError)
    return { success: false, error: updateError.message }
  }

  return { success: true, error: null }
}

/**
 * Get suite run history
 */
export async function getSuiteRunHistory(suiteId: string, limit: number = 20) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('test_runs')
    .select(`
      *,
      test_cases (id, name)
    `)
    .eq('test_suite_id', suiteId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching suite run history:', error)
    return { runs: [], error: error.message }
  }

  return { runs: data as unknown as TestRunWithRelations[], error: null }
}

/**
 * Get count of running tests for an organization
 * Excludes stale tests (running for more than 5 minutes)
 */
export async function getRunningTestsCount(organizationId: string) {
  const supabase = await createClient()
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { count, error } = await supabase
    .from('test_runs')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'running'])
    .gte('started_at', fiveMinutesAgo) // Exclude stale tests

  if (error) {
    console.error('Error fetching running tests count:', error)
    return { count: 0, error: error.message }
  }

  return { count: count || 0, error: null }
}

/**
 * Get suite IDs that have running tests
 * Excludes stale tests (running for more than 5 minutes)
 */
export async function getRunningSuiteIds(organizationId: string) {
  const supabase = await createClient()
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('test_runs')
    .select('test_suite_id')
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'running'])
    .gte('started_at', fiveMinutesAgo) // Exclude stale tests
    .not('test_suite_id', 'is', null)

  if (error) {
    console.error('Error fetching running suite IDs:', error)
    return { suiteIds: [] as string[], error: error.message }
  }

  // Get unique suite IDs
  const suiteIds = [...new Set(data?.map((r) => r.test_suite_id).filter(Boolean) as string[])]
  return { suiteIds, error: null }
}

/**
 * Get overall test status for the organization
 * Returns: 'running' | 'passed' | 'partial' | 'failed' | 'none'
 * Excludes stale tests (running for more than 5 minutes)
 */
export async function getOverallTestStatus(organizationId: string) {
  const supabase = await createClient()
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  // First check if any tests are running (excluding stale ones)
  const { data: runningTests, count: runningCount } = await supabase
    .from('test_runs')
    .select('prompt_override', { count: 'exact' })
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'running'])
    .gte('started_at', fiveMinutesAgo) // Exclude stale tests

  if (runningCount && runningCount > 0) {
    // Check if any running test has a custom prompt
    const hasCustomPrompt = runningTests?.some((run) => run.prompt_override !== null) || false
    return { status: 'running' as const, runningCount, hasCustomPrompt, error: null }
  }

  // Get the latest run for each test case to determine overall status
  // We use a subquery approach: get all test cases and their latest run status
  const { data: testCases, error: casesError } = await supabase
    .from('test_cases')
    .select(`
      id,
      test_runs (
        status,
        created_at
      )
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (casesError) {
    console.error('Error fetching test cases for status:', casesError)
    return { status: 'none' as const, runningCount: 0, hasCustomPrompt: false, error: casesError.message }
  }

  if (!testCases || testCases.length === 0) {
    return { status: 'none' as const, runningCount: 0, hasCustomPrompt: false, error: null }
  }

  // For each test case, get the latest run's status
  let hasAnyRuns = false
  let allPassed = true
  let hasPartial = false
  let hasFailed = false

  for (const tc of testCases) {
    const runs = tc.test_runs as Array<{ status: string; created_at: string }> | null
    if (runs && runs.length > 0) {
      hasAnyRuns = true
      // Sort by created_at descending and get the latest
      const latestRun = runs.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      if (latestRun.status === 'partial') {
        hasPartial = true
        allPassed = false
      } else if (latestRun.status === 'failed' || latestRun.status === 'error') {
        hasFailed = true
        allPassed = false
      } else if (latestRun.status !== 'passed') {
        allPassed = false
      }
    }
  }

  if (!hasAnyRuns) {
    return { status: 'none' as const, runningCount: 0, hasCustomPrompt: false, error: null }
  }

  // Determine overall status: passed > partial > failed
  let overallStatus: 'passed' | 'partial' | 'failed'
  if (allPassed) {
    overallStatus = 'passed'
  } else if (hasFailed) {
    overallStatus = 'failed'
  } else if (hasPartial) {
    overallStatus = 'partial'
  } else {
    overallStatus = 'failed' // Default to failed if not passed and not partial
  }

  return {
    status: overallStatus,
    runningCount: 0,
    hasCustomPrompt: false,
    error: null,
  }
}

// ============================================================================
// Prompt Improvement Suggestions
// ============================================================================

/**
 * Get prompt improvement suggestions for a test run
 */
export async function getPromptImprovementSuggestions(
  testRunId: string,
  locale: string = 'en'
) {
  const supabase = await createClient()

  // Fetch the test run with its data
  const { data: testRun, error: runError } = await supabase
    .from('test_runs')
    .select('*')
    .eq('id', testRunId)
    .single()

  if (runError || !testRun) {
    console.error('Error fetching test run:', runError)
    return { suggestions: null, error: 'Test run not found' }
  }

  const typedTestRun = testRun as unknown as RawTestRunData

  // Fetch the assistant's system prompt
  const { data: assistant, error: assistantError } = await supabase
    .from('assistants')
    .select('system_prompt')
    .eq('id', typedTestRun.assistant_id)
    .single()

  if (assistantError || !assistant) {
    console.error('Error fetching assistant:', assistantError)
    return { suggestions: null, error: 'Assistant not found' }
  }

  // Import and call the suggestion service
  const { suggestPromptImprovements } = await import('@/lib/services/autotest-evaluator')

  const conversationLog = (typedTestRun.conversation_log || []) as Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>
  const evaluationResult = typedTestRun.evaluation_result as {
    turn_evaluations?: Array<{
      turn_index: number
      role: 'assistant'
      expected: string
      actual: string
      passed: boolean
      score: number
      reasoning: string
    }>
    overall_evaluation?: { passed: boolean; score: number; reasoning: string }
  } | null

  const result = await suggestPromptImprovements({
    systemPrompt: assistant.system_prompt || '',
    conversationLog,
    turnEvaluations: evaluationResult?.turn_evaluations || [],
    overallEvaluation: evaluationResult?.overall_evaluation || null,
    locale,
  })

  if (result.error) {
    return {
      analysis: null,
      changes: null,
      revisedPrompt: null,
      assistantId: null,
      error: result.error
    }
  }

  return {
    analysis: result.analysis,
    changes: result.changes,
    revisedPrompt: result.revisedPrompt,
    assistantId: typedTestRun.assistant_id,
    error: null
  }
}

/**
 * Apply a revised system prompt to an assistant
 */
export async function applyPromptChanges(
  assistantId: string,
  newSystemPrompt: string,
  note?: string
) {
  const supabase = await createClient()

  // Get the assistant to get organization_id
  const { data: assistant } = await supabase
    .from('assistants')
    .select('organization_id')
    .eq('id', assistantId)
    .single()

  if (!assistant) {
    return { success: false, error: 'Assistant not found' }
  }

  const { error } = await supabase
    .from('assistants')
    .update({ system_prompt: newSystemPrompt })
    .eq('id', assistantId)

  if (error) {
    console.error('Error applying prompt changes:', error)
    return { success: false, error: error.message }
  }

  // Save the new prompt as a version
  await createPromptVersion(
    assistantId,
    assistant.organization_id,
    newSystemPrompt,
    note || 'Applied from autotest suggestions'
  )

  // Reset all test results for this assistant since the prompt has changed
  // Old test results are no longer valid with the new prompt
  const { error: deleteError } = await supabase
    .from('test_runs')
    .delete()
    .eq('assistant_id', assistantId)

  if (deleteError) {
    console.error('Error resetting test runs:', deleteError)
    // Don't fail the operation, prompt was already updated
  }

  return { success: true, error: null }
}
