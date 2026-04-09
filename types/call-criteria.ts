/**
 * Call Criteria Types
 * Defines pass/fail criteria for evaluating call transcripts
 */

export interface CallCriterion {
  id: string
  organization_id: string
  assistant_id: string | null  // null = org-level default
  name: string
  description: string
  is_active: boolean | null
  position: number | null
  created_at: string | null
  updated_at: string | null
}

export interface CallCriteriaResult {
  id: string
  call_session_id: string
  criterion_id: string
  passed: boolean | null  // true = passed, false = failed, null = could not be evaluated
  reasoning: string | null
  evaluated_at: string
  // Joined data
  criterion?: CallCriterion
}

export interface CallCriterionInput {
  organization_id: string
  assistant_id?: string | null
  name: string
  description: string
  is_active?: boolean
  position?: number
}

export interface CallCriterionUpdate {
  name?: string
  description?: string
  is_active?: boolean
  position?: number
}

// For display in calls table - compact summary
export interface CallCriteriaSummary {
  total: number
  passed: number
  failed: number
  inconclusive: number  // could not be evaluated
  results: Array<{
    criterion_id: string
    criterion_name: string
    passed: boolean | null  // null = inconclusive
  }>
}

// For the evaluator service
export interface CriterionEvaluationResult {
  criterion_id: string
  passed: boolean | null  // null = could not be evaluated
  reasoning: string
}

export interface CallEvaluationResult {
  call_session_id: string
  results: CriterionEvaluationResult[]
  evaluated_at: string
}
