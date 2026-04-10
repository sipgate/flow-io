'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { CallCriterion, CallCriterionInput, CallCriterionUpdate, CallCriteriaSummary } from '@/types/call-criteria'
import { evaluateCallCriteria } from '@/lib/services/call-criteria-evaluator'

/**
 * Get all criteria for an organization, optionally filtered by assistant
 * Returns org-level criteria merged with assistant-specific criteria
 */
export async function getCallCriteria(orgId: string, assistantId?: string | null): Promise<{
  criteria: CallCriterion[]
  error: string | null
}> {
  const supabase = await createClient()

  // Verify user has access to this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { criteria: [], error: 'Unauthorized' }
  }

  // Build query based on whether we want assistant-specific or all
  let query = supabase
    .from('call_criteria')
    .select('*')
    .eq('organization_id', orgId)
    .order('position', { ascending: true })

  if (assistantId) {
    // Get org-level (assistant_id IS NULL) + assistant-specific
    query = query.or(`assistant_id.is.null,assistant_id.eq.${assistantId}`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching call criteria:', error)
    return { criteria: [], error: error.message }
  }

  return { criteria: (data || []) as unknown as CallCriterion[], error: null }
}

/**
 * Get only org-level criteria (for settings page)
 */
export async function getOrgLevelCriteria(orgId: string): Promise<{
  criteria: CallCriterion[]
  error: string | null
}> {
  const supabase = await createClient()

  // Verify user has access
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { criteria: [], error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('call_criteria')
    .select('*')
    .eq('organization_id', orgId)
    .is('assistant_id', null)
    .is('scenario_id', null)
    .order('position', { ascending: true })

  if (error) {
    return { criteria: [], error: error.message }
  }

  return { criteria: (data || []) as unknown as CallCriterion[], error: null }
}

/**
 * Get criteria specific to a scenario
 */
export async function getScenarioCriteria(scenarioId: string): Promise<{
  criteria: CallCriterion[]
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('call_criteria')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('position', { ascending: true })

  if (error) {
    return { criteria: [], error: error.message }
  }

  return { criteria: (data || []) as unknown as CallCriterion[], error: null }
}

/**
 * Get criteria specific to an assistant
 */
export async function getAssistantCriteria(assistantId: string): Promise<{
  criteria: CallCriterion[]
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('call_criteria')
    .select('*')
    .eq('assistant_id', assistantId)
    .order('position', { ascending: true })

  if (error) {
    return { criteria: [], error: error.message }
  }

  return { criteria: (data || []) as unknown as CallCriterion[], error: null }
}

/**
 * Create a new criterion
 */
export async function createCallCriterion(input: CallCriterionInput): Promise<{
  criterion: CallCriterion | null
  error: string | null
}> {
  const supabase = await createClient()

  // Verify user is admin/owner
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', input.organization_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .in('role', ['owner', 'admin'])
    .single()

  if (!membership) {
    return { criterion: null, error: 'Unauthorized - admin access required' }
  }

  // Get max position for ordering
  const { data: maxPos } = await supabase
    .from('call_criteria')
    .select('position')
    .eq('organization_id', input.organization_id)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const position = (maxPos?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('call_criteria')
    .insert({
      organization_id: input.organization_id,
      assistant_id: input.assistant_id || null,
      scenario_id: input.scenario_id || null,
      name: input.name,
      description: input.description,
      is_active: input.is_active ?? true,
      position,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating criterion:', error)
    return { criterion: null, error: error.message }
  }

  return { criterion: data as unknown as CallCriterion, error: null }
}

/**
 * Update a criterion
 */
export async function updateCallCriterion(id: string, updates: CallCriterionUpdate): Promise<{
  criterion: CallCriterion | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('call_criteria')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating criterion:', error)
    return { criterion: null, error: error.message }
  }

  return { criterion: data as unknown as CallCriterion, error: null }
}

/**
 * Delete a criterion
 */
export async function deleteCallCriterion(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('call_criteria')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting criterion:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Reorder criteria
 */
export async function reorderCallCriteria(criteriaIds: string[]): Promise<{ error: string | null }> {
  const supabase = await createClient()

  // Update positions for all criteria
  const updates = criteriaIds.map((id, index) =>
    supabase
      .from('call_criteria')
      .update({ position: index })
      .eq('id', id)
  )

  try {
    await Promise.all(updates)
    return { error: null }
  } catch (error) {
    console.error('Error reordering criteria:', error)
    return { error: String(error) }
  }
}

// Type for joined criterion data
interface CriterionJoinResult {
  id: string
  criterion_id: string
  call_session_id: string
  passed: boolean | null  // null = inconclusive
  reasoning: string | null
  evaluated_at: string | null
  criterion: {
    id: string
    name: string
    description: string
    position: number | null
    is_active: boolean | null
  } | null
}

/**
 * Get criteria evaluation results for a call
 */
export async function getCallCriteriaResults(callSessionId: string): Promise<{
  results: Array<{
    id: string
    criterion_id: string
    passed: boolean | null  // null = inconclusive
    reasoning: string | null
    evaluated_at: string
    criterion: {
      id: string
      name: string
      description: string
      position: number
    } | null
  }>
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('call_criteria_results')
    .select(`
      *,
      criterion:call_criteria (
        id,
        name,
        description,
        position,
        is_active
      )
    `)
    .eq('call_session_id', callSessionId)

  if (error) {
    console.error('Error fetching criteria results:', error)
    return { results: [], error: error.message }
  }

  // Cast and transform the results, filtering out inactive criteria
  const results = (data as unknown as CriterionJoinResult[] || [])
    .filter(item => item.criterion?.is_active !== false)
    .map(item => ({
    id: item.id,
    criterion_id: item.criterion_id,
    passed: item.passed,
    reasoning: item.reasoning,
    evaluated_at: item.evaluated_at || new Date().toISOString(),
    criterion: item.criterion ? {
      id: item.criterion.id,
      name: item.criterion.name,
      description: item.criterion.description,
      position: item.criterion.position ?? 0,
    } : null,
  }))

  // Sort by criterion position
  const sorted = results.sort((a, b) => {
    const posA = a.criterion?.position ?? 999
    const posB = b.criterion?.position ?? 999
    return posA - posB
  })

  return { results: sorted, error: null }
}

// Type for summary join result
interface SummaryJoinResult {
  call_session_id: string
  criterion_id: string
  passed: boolean | null  // null = inconclusive
  criterion: {
    name: string
    position: number | null
    is_active: boolean | null
  } | null
}

/**
 * Get criteria summary for multiple calls (for calls table)
 * Returns a compact summary of pass/fail for each call
 */
export async function getCallsCriteriaSummaries(callSessionIds: string[]): Promise<{
  summaries: Record<string, CallCriteriaSummary>
  error: string | null
}> {
  if (callSessionIds.length === 0) {
    return { summaries: {}, error: null }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('call_criteria_results')
    .select(`
      call_session_id,
      criterion_id,
      passed,
      criterion:call_criteria (
        name,
        position,
        is_active
      )
    `)
    .in('call_session_id', callSessionIds)

  if (error) {
    console.error('Error fetching criteria summaries:', error)
    return { summaries: {}, error: error.message }
  }

  // Cast the data for proper typing and filter out inactive criteria
  const typedData = (data as unknown as SummaryJoinResult[])
    .filter(item => item.criterion?.is_active !== false)

  // Group by call_session_id
  const summaries: Record<string, CallCriteriaSummary> = {}

  for (const result of typedData || []) {
    if (!summaries[result.call_session_id]) {
      summaries[result.call_session_id] = {
        total: 0,
        passed: 0,
        failed: 0,
        inconclusive: 0,
        results: [],
      }
    }

    summaries[result.call_session_id].total++
    if (result.passed === true) {
      summaries[result.call_session_id].passed++
    } else if (result.passed === false) {
      summaries[result.call_session_id].failed++
    } else {
      // null = inconclusive
      summaries[result.call_session_id].inconclusive++
    }

    summaries[result.call_session_id].results.push({
      criterion_id: result.criterion_id,
      criterion_name: result.criterion?.name || 'Unknown',
      passed: result.passed,
    })
  }

  // Sort results within each summary by criterion position
  for (const summary of Object.values(summaries)) {
    summary.results.sort((a, b) => {
      const posA = typedData?.find(d => d.criterion_id === a.criterion_id)?.criterion?.position ?? 999
      const posB = typedData?.find(d => d.criterion_id === b.criterion_id)?.criterion?.position ?? 999
      return posA - posB
    })
  }

  return { summaries, error: null }
}

/**
 * Trigger evaluation for a call (runs in background)
 */
export async function triggerCallEvaluation(callSessionId: string): Promise<{
  success: boolean
  error: string | null
}> {
  // Run evaluation in background
  evaluateCallCriteria({ callSessionId }).catch(err => {
    console.error('[Call Criteria] Background evaluation error:', err)
  })

  return { success: true, error: null }
}

/**
 * Trigger CSAT evaluation for a call (runs in background)
 * This uses forceEvaluateCallCSAT which ignores the scenario's enable_csat setting
 */
export async function triggerCSATEvaluation(callSessionId: string): Promise<{
  success: boolean
  error: string | null
}> {
  // Import dynamically to avoid circular dependencies
  const { forceEvaluateCallCSAT } = await import('@/lib/services/csat-evaluator')

  // Run evaluation in background
  forceEvaluateCallCSAT(callSessionId).catch(err => {
    console.error('[CSAT] Background evaluation error:', err)
  })

  return { success: true, error: null }
}

/**
 * Get overall criteria analytics for an organization (for dashboard)
 */
export async function getCriteriaOverview(orgId: string, days: number = 7): Promise<{
  overview: {
    totalEvaluations: number
    passed: number
    failed: number
    inconclusive: number
    passRate: number
  }
  topFailingCriteria: Array<{
    criterion_id: string
    criterion_name: string
    failCount: number
    totalCount: number
    failRate: number
  }>
  error: string | null
}> {
  const supabase = await createClient()

  // Verify user has access
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return {
      overview: { totalEvaluations: 0, passed: 0, failed: 0, inconclusive: 0, passRate: 0 },
      topFailingCriteria: [],
      error: 'Unauthorized',
    }
  }

  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - days)

  // Get all results for org's calls in the time period
  const { data: results, error } = await supabase
    .from('call_criteria_results')
    .select(`
      id,
      passed,
      criterion_id,
      evaluated_at,
      call_sessions!inner (
        organization_id
      ),
      criterion:call_criteria (
        id,
        name,
        is_active
      )
    `)
    .eq('call_sessions.organization_id', orgId)
    .gte('evaluated_at', sinceDate.toISOString())

  if (error) {
    console.error('Error fetching criteria overview:', error)
    return {
      overview: { totalEvaluations: 0, passed: 0, failed: 0, inconclusive: 0, passRate: 0 },
      topFailingCriteria: [],
      error: error.message,
    }
  }

  // Filter to only include active criteria
  const typedResults = (results as unknown as Array<{
    id: string
    passed: boolean | null
    criterion_id: string
    evaluated_at: string
    criterion: { id: string; name: string; is_active: boolean | null } | null
  }>).filter(r => r.criterion?.is_active !== false)

  // Calculate overview
  const totalEvaluations = typedResults.length
  const passed = typedResults.filter(r => r.passed === true).length
  const failed = typedResults.filter(r => r.passed === false).length
  const inconclusive = typedResults.filter(r => r.passed === null).length
  const passRate = totalEvaluations > 0 ? Math.round((passed / totalEvaluations) * 100) : 0

  // Calculate top failing criteria
  const criteriaStats = new Map<string, { name: string; failCount: number; totalCount: number }>()

  for (const result of typedResults) {
    const key = result.criterion_id
    const name = result.criterion?.name || 'Unknown'

    if (!criteriaStats.has(key)) {
      criteriaStats.set(key, { name, failCount: 0, totalCount: 0 })
    }

    const stat = criteriaStats.get(key)!
    stat.totalCount++
    if (result.passed === false) {
      stat.failCount++
    }
  }

  const topFailingCriteria = Array.from(criteriaStats.entries())
    .map(([criterion_id, stats]) => ({
      criterion_id,
      criterion_name: stats.name,
      failCount: stats.failCount,
      totalCount: stats.totalCount,
      failRate: stats.totalCount > 0 ? Math.round((stats.failCount / stats.totalCount) * 100) : 0,
    }))
    .filter(c => c.failCount > 0)
    .sort((a, b) => b.failRate - a.failRate)
    .slice(0, 5)

  return {
    overview: { totalEvaluations, passed, failed, inconclusive, passRate },
    topFailingCriteria,
    error: null,
  }
}

/**
 * Get detailed criteria analytics (for analytics page)
 */
export async function getCriteriaAnalytics(orgId: string, days: number = 30): Promise<{
  byAssistant: Array<{
    assistant_id: string
    assistant_name: string
    totalEvaluations: number
    passed: number
    failed: number
    inconclusive: number
    passRate: number
  }>
  byCriterion: Array<{
    criterion_id: string
    criterion_name: string
    totalEvaluations: number
    passed: number
    failed: number
    inconclusive: number
    passRate: number
  }>
  dailyTrend: Array<{
    date: string
    passed: number
    failed: number
    inconclusive: number
  }>
  error: string | null
}> {
  const supabase = await createClient()

  // Verify user has access
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { byAssistant: [], byCriterion: [], dailyTrend: [], error: 'Unauthorized' }
  }

  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - days)

  // Get all results with assistant info
  const { data: results, error } = await supabase
    .from('call_criteria_results')
    .select(`
      id,
      passed,
      criterion_id,
      evaluated_at,
      call_sessions!inner (
        organization_id,
        assistant_id,
        assistants (
          id,
          name
        )
      ),
      criterion:call_criteria (
        id,
        name,
        is_active
      )
    `)
    .eq('call_sessions.organization_id', orgId)
    .gte('evaluated_at', sinceDate.toISOString())

  if (error) {
    console.error('Error fetching criteria analytics:', error)
    return { byAssistant: [], byCriterion: [], dailyTrend: [], error: error.message }
  }

  // Filter to only include active criteria
  const typedResults = (results as unknown as Array<{
    id: string
    passed: boolean | null
    criterion_id: string
    evaluated_at: string
    call_sessions: {
      assistant_id: string | null
      assistants: { id: string; name: string } | null
    }
    criterion: { id: string; name: string; is_active: boolean | null } | null
  }>).filter(r => r.criterion?.is_active !== false)

  // By Assistant
  const assistantStats = new Map<string, {
    name: string
    passed: number
    failed: number
    inconclusive: number
  }>()

  for (const result of typedResults) {
    const assistantId = result.call_sessions?.assistants?.id || 'unknown'
    const assistantName = result.call_sessions?.assistants?.name || 'Unknown'

    if (!assistantStats.has(assistantId)) {
      assistantStats.set(assistantId, { name: assistantName, passed: 0, failed: 0, inconclusive: 0 })
    }

    const stat = assistantStats.get(assistantId)!
    if (result.passed === true) stat.passed++
    else if (result.passed === false) stat.failed++
    else stat.inconclusive++
  }

  const byAssistant = Array.from(assistantStats.entries()).map(([assistant_id, stats]) => ({
    assistant_id,
    assistant_name: stats.name,
    totalEvaluations: stats.passed + stats.failed + stats.inconclusive,
    passed: stats.passed,
    failed: stats.failed,
    inconclusive: stats.inconclusive,
    passRate: (stats.passed + stats.failed + stats.inconclusive) > 0
      ? Math.round((stats.passed / (stats.passed + stats.failed + stats.inconclusive)) * 100)
      : 0,
  }))

  // By Criterion
  const criterionStats = new Map<string, {
    name: string
    passed: number
    failed: number
    inconclusive: number
  }>()

  for (const result of typedResults) {
    const criterionId = result.criterion_id
    const criterionName = result.criterion?.name || 'Unknown'

    if (!criterionStats.has(criterionId)) {
      criterionStats.set(criterionId, { name: criterionName, passed: 0, failed: 0, inconclusive: 0 })
    }

    const stat = criterionStats.get(criterionId)!
    if (result.passed === true) stat.passed++
    else if (result.passed === false) stat.failed++
    else stat.inconclusive++
  }

  const byCriterion = Array.from(criterionStats.entries()).map(([criterion_id, stats]) => ({
    criterion_id,
    criterion_name: stats.name,
    totalEvaluations: stats.passed + stats.failed + stats.inconclusive,
    passed: stats.passed,
    failed: stats.failed,
    inconclusive: stats.inconclusive,
    passRate: (stats.passed + stats.failed + stats.inconclusive) > 0
      ? Math.round((stats.passed / (stats.passed + stats.failed + stats.inconclusive)) * 100)
      : 0,
  }))

  // Daily trend
  const dailyStats = new Map<string, { passed: number; failed: number; inconclusive: number }>()

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateKey = date.toISOString().split('T')[0]
    dailyStats.set(dateKey, { passed: 0, failed: 0, inconclusive: 0 })
  }

  for (const result of typedResults) {
    const dateKey = result.evaluated_at.split('T')[0]
    if (dailyStats.has(dateKey)) {
      const stat = dailyStats.get(dateKey)!
      if (result.passed === true) stat.passed++
      else if (result.passed === false) stat.failed++
      else stat.inconclusive++
    }
  }

  const dailyTrend = Array.from(dailyStats.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { byAssistant, byCriterion, dailyTrend, error: null }
}
