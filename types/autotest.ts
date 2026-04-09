// Autotest Types - Test suites, cases, and runs

export type TestStatus = 'pending' | 'running' | 'passed' | 'partial' | 'failed' | 'error'

// Conversation flow turn types
export interface ConversationTurn {
  role: 'user' | 'assistant'
  content?: string  // User's message content
  expected?: string // Expected behavior/criteria for assistant turns
}

// Test Suite - Groups related test cases
export interface TestSuite {
  id: string
  organization_id: string
  assistant_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TestSuiteInsert {
  organization_id: string
  assistant_id: string
  name: string
  description?: string | null
  is_active?: boolean
}

export interface TestSuiteUpdate {
  name?: string
  description?: string | null
  is_active?: boolean
}

// Test Suite with relations
export interface TestSuiteWithRelations extends TestSuite {
  assistant?: {
    id: string
    name: string
  }
  test_cases?: TestCase[]
  latest_run?: TestRun | null
  stats?: {
    total_cases: number
    passed: number
    partial: number
    failed: number
    average_score: number | null
    last_run_at: string | null
  }
}

// Test Case - Individual test scenario
export interface TestCase {
  id: string
  test_suite_id: string
  organization_id: string
  name: string
  description: string | null
  conversation_flow: ConversationTurn[]
  evaluation_criteria: string | null
  position: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TestCaseInsert {
  test_suite_id: string
  organization_id: string
  name: string
  description?: string | null
  conversation_flow: ConversationTurn[]
  evaluation_criteria?: string | null
  position?: number
  is_active?: boolean
}

export interface TestCaseUpdate {
  name?: string
  description?: string | null
  conversation_flow?: ConversationTurn[]
  evaluation_criteria?: string | null
  position?: number
  is_active?: boolean
}

// Test Case with relations
export interface TestCaseWithRelations extends TestCase {
  test_suite?: TestSuite
  latest_run?: TestRun | null
}

// Turn evaluation result from LLM
export interface TurnEvaluation {
  turn_index: number
  role: 'assistant'
  expected: string
  actual: string
  passed: boolean
  score: number
  reasoning: string
}

// Overall evaluation result
export interface OverallEvaluation {
  passed: boolean
  score: number
  reasoning: string
}

// Full evaluation result stored in test_runs
export interface EvaluationResult {
  turn_evaluations: TurnEvaluation[]
  overall_evaluation: OverallEvaluation
}

// Performance metrics for a single LLM call
export interface LLMPerformanceMetrics {
  ttftMs: number        // Time to first token (ms)
  totalTimeMs: number   // Total generation time (ms)
  tokensPerSecond: number
}

// Conversation log entry
export interface ConversationLogEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  // Performance metrics for assistant responses
  performance?: LLMPerformanceMetrics
  model?: string
}

// Test Run - Execution record
export interface TestRun {
  id: string
  test_suite_id: string | null
  test_case_id: string | null
  organization_id: string
  assistant_id: string
  status: TestStatus
  conversation_log: ConversationLogEntry[] | null
  evaluation_result: EvaluationResult | null
  error_message: string | null
  duration_ms: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  prompt_override: string | null
}

export interface TestRunInsert {
  test_suite_id?: string | null
  test_case_id?: string | null
  organization_id: string
  assistant_id: string
  status?: TestStatus
  conversation_log?: ConversationLogEntry[] | null
  evaluation_result?: EvaluationResult | null
  error_message?: string | null
  duration_ms?: number | null
  started_at?: string | null
  completed_at?: string | null
}

export interface TestRunUpdate {
  status?: TestStatus
  conversation_log?: ConversationLogEntry[] | null
  evaluation_result?: EvaluationResult | null
  error_message?: string | null
  duration_ms?: number | null
  started_at?: string | null
  completed_at?: string | null
}

// Test Run with relations
export interface TestRunWithRelations extends TestRun {
  test_suite?: TestSuite | null
  test_case?: TestCase | null
  assistant?: {
    id: string
    name: string
  }
}

// Generated test suggestion from LLM
export interface GeneratedTestSuggestion {
  name: string
  description: string
  conversation_flow: ConversationTurn[]
  evaluation_criteria: string
}

// Test execution progress for real-time updates
export interface TestExecutionProgress {
  test_case_id: string
  status: 'queued' | 'running' | 'completed'
  current_turn: number
  total_turns: number
  result?: 'passed' | 'failed' | 'error'
}

// Suite run progress
export interface SuiteExecutionProgress {
  suite_id: string
  total_cases: number
  completed_cases: number
  passed_cases: number
  failed_cases: number
  current_test?: TestExecutionProgress
}
