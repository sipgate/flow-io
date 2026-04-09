'use server'

import { createClient } from '@/lib/supabase/server'

export type TimeRange = '7d' | '30d' | '90d' | 'custom'

export interface DateRange {
  from: Date
  to: Date
}

export interface AnalyticsSummary {
  totalCalls: number
  completedCalls: number
  failedCalls: number
  avgDuration: number
  totalDuration: number
  variablesExtracted: number
}

export interface CallsByDay {
  date: string
  total: number
  completed: number
  failed: number
  avgDuration: number
}

export interface CallsByHour {
  hour: number
  count: number
}

export interface CallsByDayOfWeek {
  day: number
  dayName: string
  count: number
}

export interface AssistantStats {
  id: string
  name: string
  totalCalls: number
  avgDuration: number
  variablesExtracted: number
}

export interface DurationDistribution {
  range: string
  count: number
}

function getDateRange(range: TimeRange, customRange?: DateRange): { start: Date; end: Date } {
  if (range === 'custom' && customRange) {
    return { start: customRange.from, end: customRange.to }
  }

  const end = new Date()
  const start = new Date()

  switch (range) {
    case '7d':
      start.setDate(start.getDate() - 7)
      break
    case '30d':
      start.setDate(start.getDate() - 30)
      break
    case '90d':
      start.setDate(start.getDate() - 90)
      break
  }

  return { start, end }
}

/**
 * Get analytics summary for a time range
 */
export async function getAnalyticsSummary(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange
): Promise<AnalyticsSummary> {
  const supabase = await createClient()
  const { start, end } = getDateRange(range, customRange)

  const { data: calls } = await supabase
    .from('call_sessions')
    .select('id, status, duration_seconds')
    .eq('organization_id', organizationId)
    .gte('started_at', start.toISOString())

  const { count: variablesCount } = await supabase
    .from('extracted_variables')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gte('extracted_at', start.toISOString())

  const callList = calls || []
  const completedCalls = callList.filter((c) => c.status === 'completed').length
  const failedCalls = callList.filter((c) => c.status === 'failed').length
  const totalDuration = callList.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
  const avgDuration = callList.length > 0 ? Math.round(totalDuration / callList.length) : 0

  return {
    totalCalls: callList.length,
    completedCalls,
    failedCalls,
    avgDuration,
    totalDuration,
    variablesExtracted: variablesCount || 0,
  }
}

/**
 * Get calls grouped by day
 */
export async function getCallsByDay(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange
): Promise<CallsByDay[]> {
  const supabase = await createClient()
  const { start, end } = getDateRange(range, customRange)

  const { data: calls } = await supabase
    .from('call_sessions')
    .select('started_at, status, duration_seconds')
    .eq('organization_id', organizationId)
    .gte('started_at', start.toISOString())
    .lte('started_at', end.toISOString())

  // Group by day
  const dayMap = new Map<string, { total: number; completed: number; failed: number; durations: number[] }>()

  // Initialize all days in range
  const current = new Date(start)
  while (current <= end) {
    const dateKey = current.toISOString().split('T')[0]
    dayMap.set(dateKey, { total: 0, completed: 0, failed: 0, durations: [] })
    current.setDate(current.getDate() + 1)
  }

  // Fill in data
  for (const call of calls || []) {
    if (!call.started_at) continue
    const dateKey = call.started_at.split('T')[0]
    const day = dayMap.get(dateKey)
    if (day) {
      day.total++
      if (call.status === 'completed') day.completed++
      if (call.status === 'failed') day.failed++
      if (call.duration_seconds) day.durations.push(call.duration_seconds)
    }
  }

  return Array.from(dayMap.entries()).map(([date, data]) => ({
    date,
    total: data.total,
    completed: data.completed,
    failed: data.failed,
    avgDuration: data.durations.length > 0
      ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
      : 0,
  }))
}

/**
 * Get calls grouped by hour of day
 */
export async function getCallsByHour(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange
): Promise<CallsByHour[]> {
  const supabase = await createClient()
  const { start } = getDateRange(range, customRange)

  const { data: calls } = await supabase
    .from('call_sessions')
    .select('started_at')
    .eq('organization_id', organizationId)
    .gte('started_at', start.toISOString())

  // Initialize all hours
  const hours: CallsByHour[] = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }))

  // Count calls per hour
  for (const call of calls || []) {
    if (!call.started_at) continue
    const hour = new Date(call.started_at).getHours()
    hours[hour].count++
  }

  return hours
}

/**
 * Get calls grouped by day of week
 */
export async function getCallsByDayOfWeek(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange
): Promise<CallsByDayOfWeek[]> {
  const supabase = await createClient()
  const { start } = getDateRange(range, customRange)

  const { data: calls } = await supabase
    .from('call_sessions')
    .select('started_at')
    .eq('organization_id', organizationId)
    .gte('started_at', start.toISOString())

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const days: CallsByDayOfWeek[] = dayNames.map((name, i) => ({ day: i, dayName: name, count: 0 }))

  for (const call of calls || []) {
    if (!call.started_at) continue
    const dayOfWeek = new Date(call.started_at).getDay()
    days[dayOfWeek].count++
  }

  return days
}

/**
 * Get per-assistant statistics
 */
export async function getAssistantStats(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange
): Promise<AssistantStats[]> {
  const supabase = await createClient()
  const { start } = getDateRange(range, customRange)

  // Get assistants
  const { data: assistants } = await supabase
    .from('assistants')
    .select('id, name')
    .eq('organization_id', organizationId)

  if (!assistants || assistants.length === 0) return []

  // Get calls for each assistant
  const stats: AssistantStats[] = []

  for (const assistant of assistants) {
    const { data: calls } = await supabase
      .from('call_sessions')
      .select('id, duration_seconds')
      .eq('assistant_id', assistant.id)
      .gte('started_at', start.toISOString())

    const { count: variablesCount } = await supabase
      .from('extracted_variables')
      .select('id, call_sessions!inner(assistant_id)', { count: 'exact', head: true })
      .eq('call_sessions.assistant_id', assistant.id)
      .gte('extracted_at', start.toISOString())

    const callList = calls || []
    const totalDuration = callList.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)

    stats.push({
      id: assistant.id,
      name: assistant.name,
      totalCalls: callList.length,
      avgDuration: callList.length > 0 ? Math.round(totalDuration / callList.length) : 0,
      variablesExtracted: variablesCount || 0,
    })
  }

  return stats.sort((a, b) => b.totalCalls - a.totalCalls)
}

/**
 * Get call duration distribution
 */
export async function getDurationDistribution(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange
): Promise<DurationDistribution[]> {
  const supabase = await createClient()
  const { start } = getDateRange(range, customRange)

  const { data: calls } = await supabase
    .from('call_sessions')
    .select('duration_seconds')
    .eq('organization_id', organizationId)
    .gte('started_at', start.toISOString())
    .not('duration_seconds', 'is', null)

  const ranges = [
    { range: '0-30s', min: 0, max: 30, count: 0 },
    { range: '30s-1m', min: 30, max: 60, count: 0 },
    { range: '1-2m', min: 60, max: 120, count: 0 },
    { range: '2-5m', min: 120, max: 300, count: 0 },
    { range: '5-10m', min: 300, max: 600, count: 0 },
    { range: '10m+', min: 600, max: Infinity, count: 0 },
  ]

  for (const call of calls || []) {
    const duration = call.duration_seconds || 0
    for (const r of ranges) {
      if (duration >= r.min && duration < r.max) {
        r.count++
        break
      }
    }
  }

  return ranges.map(({ range, count }) => ({ range, count }))
}

/**
 * CSAT Analytics - Overview for dashboard
 */
export interface CSATOverview {
  totalRatings: number
  averageScore: number
  distribution: { score: number; count: number }[]
}

export async function getCSATOverview(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange
): Promise<CSATOverview> {
  const supabase = await createClient()
  const { start } = getDateRange(range, customRange)

  const { data: calls } = await supabase
    .from('call_sessions')
    .select('csat_score')
    .eq('organization_id', organizationId)
    .gte('started_at', start.toISOString())
    .not('csat_score', 'is', null)

  const scores = (calls || []).map(c => c.csat_score).filter((s): s is number => s !== null)
  const totalRatings = scores.length
  const averageScore = totalRatings > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / totalRatings) * 10) / 10
    : 0

  // Count distribution
  const distribution = [1, 2, 3, 4, 5].map(score => ({
    score,
    count: scores.filter(s => s === score).length
  }))

  return { totalRatings, averageScore, distribution }
}

/**
 * CSAT Analytics - Trend by day
 */
export interface CSATByDay {
  date: string
  averageScore: number
  count: number
}

export async function getCSATByDay(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange
): Promise<CSATByDay[]> {
  const supabase = await createClient()
  const { start, end } = getDateRange(range, customRange)

  const { data: calls } = await supabase
    .from('call_sessions')
    .select('started_at, csat_score')
    .eq('organization_id', organizationId)
    .gte('started_at', start.toISOString())
    .lte('started_at', end.toISOString())
    .not('csat_score', 'is', null)

  // Group by day
  const dayMap = new Map<string, number[]>()

  // Initialize all days in range
  const current = new Date(start)
  while (current <= end) {
    const dateKey = current.toISOString().split('T')[0]
    dayMap.set(dateKey, [])
    current.setDate(current.getDate() + 1)
  }

  // Fill in data
  for (const call of calls || []) {
    if (!call.started_at || call.csat_score === null) continue
    const dateKey = call.started_at.split('T')[0]
    const scores = dayMap.get(dateKey)
    if (scores) {
      scores.push(call.csat_score)
    }
  }

  // Convert to array
  return Array.from(dayMap.entries()).map(([date, scores]) => ({
    date,
    averageScore: scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0,
    count: scores.length
  }))
}

// ============================================
// ENHANCED ANALYTICS - Professional Dashboards
// ============================================

/**
 * Heatmap data: calls by hour and day of week
 */
export interface HeatmapCell {
  dayOfWeek: number
  dayName: string
  hour: number
  count: number
  avgDuration: number
  avgCsat: number | null
}

export async function getCallHeatmap(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange
): Promise<HeatmapCell[]> {
  const supabase = await createClient()
  const { start } = getDateRange(range, customRange)

  const { data: calls } = await supabase
    .from('call_sessions')
    .select('started_at, duration_seconds, csat_score')
    .eq('organization_id', organizationId)
    .gte('started_at', start.toISOString())
    .not('started_at', 'is', null)

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Initialize heatmap grid (7 days x 24 hours)
  const grid: Map<string, { count: number; durations: number[]; csats: number[] }> = new Map()

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      grid.set(`${day}-${hour}`, { count: 0, durations: [], csats: [] })
    }
  }

  // Fill in data
  for (const call of calls || []) {
    if (!call.started_at) continue
    const date = new Date(call.started_at)
    const day = date.getDay()
    const hour = date.getHours()
    const key = `${day}-${hour}`
    const cell = grid.get(key)!
    cell.count++
    if (call.duration_seconds) cell.durations.push(call.duration_seconds)
    if (call.csat_score) cell.csats.push(call.csat_score)
  }

  // Convert to array
  const result: HeatmapCell[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const cell = grid.get(`${day}-${hour}`)!
      result.push({
        dayOfWeek: day,
        dayName: dayNames[day],
        hour,
        count: cell.count,
        avgDuration: cell.durations.length > 0
          ? Math.round(cell.durations.reduce((a, b) => a + b, 0) / cell.durations.length)
          : 0,
        avgCsat: cell.csats.length > 0
          ? Math.round((cell.csats.reduce((a, b) => a + b, 0) / cell.csats.length) * 10) / 10
          : null,
      })
    }
  }

  return result
}

/**
 * Period comparison: compare current period with previous period
 */
export interface PeriodComparison {
  current: AnalyticsSummary & { avgCsat: number | null; criteriaPassRate: number | null }
  previous: AnalyticsSummary & { avgCsat: number | null; criteriaPassRate: number | null }
  changes: {
    totalCalls: number
    completedCalls: number
    avgDuration: number
    avgCsat: number | null
    criteriaPassRate: number | null
  }
}

export async function getPeriodComparison(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange
): Promise<PeriodComparison> {
  const supabase = await createClient()
  const { start, end } = getDateRange(range, customRange)

  // Calculate previous period
  const periodLength = end.getTime() - start.getTime()
  const previousStart = new Date(start.getTime() - periodLength)
  const previousEnd = new Date(start.getTime())

  // Fetch current period
  const { data: currentCalls } = await supabase
    .from('call_sessions')
    .select('id, status, duration_seconds, csat_score')
    .eq('organization_id', organizationId)
    .gte('started_at', start.toISOString())
    .lt('started_at', end.toISOString())

  // Fetch previous period
  const { data: previousCalls } = await supabase
    .from('call_sessions')
    .select('id, status, duration_seconds, csat_score')
    .eq('organization_id', organizationId)
    .gte('started_at', previousStart.toISOString())
    .lt('started_at', previousEnd.toISOString())

  // Fetch criteria results for both periods
  const currentCallIds = (currentCalls || []).map(c => c.id)
  const previousCallIds = (previousCalls || []).map(c => c.id)

  const { data: currentCriteria } = currentCallIds.length > 0
    ? await supabase
        .from('call_criteria_results')
        .select('passed')
        .in('call_session_id', currentCallIds)
    : { data: [] }

  const { data: previousCriteria } = previousCallIds.length > 0
    ? await supabase
        .from('call_criteria_results')
        .select('passed')
        .in('call_session_id', previousCallIds)
    : { data: [] }

  // Calculate metrics for each period
  const calcMetrics = (calls: typeof currentCalls, criteria: typeof currentCriteria) => {
    const callList = calls || []
    const criteriaList = criteria || []
    const completed = callList.filter(c => c.status === 'completed').length
    const failed = callList.filter(c => c.status === 'failed').length
    const totalDuration = callList.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
    const csatScores = callList.filter(c => c.csat_score !== null).map(c => c.csat_score!)
    const passedCriteria = criteriaList.filter(c => c.passed === true).length

    return {
      totalCalls: callList.length,
      completedCalls: completed,
      failedCalls: failed,
      avgDuration: callList.length > 0 ? Math.round(totalDuration / callList.length) : 0,
      totalDuration,
      variablesExtracted: 0, // Would need separate query
      avgCsat: csatScores.length > 0
        ? Math.round((csatScores.reduce((a, b) => a + b, 0) / csatScores.length) * 10) / 10
        : null,
      criteriaPassRate: criteriaList.length > 0
        ? Math.round((passedCriteria / criteriaList.length) * 100)
        : null,
    }
  }

  const current = calcMetrics(currentCalls, currentCriteria)
  const previous = calcMetrics(previousCalls, previousCriteria)

  // Calculate percentage changes
  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  return {
    current,
    previous,
    changes: {
      totalCalls: calcChange(current.totalCalls, previous.totalCalls),
      completedCalls: calcChange(current.completedCalls, previous.completedCalls),
      avgDuration: calcChange(current.avgDuration, previous.avgDuration),
      avgCsat: current.avgCsat !== null && previous.avgCsat !== null
        ? Math.round((current.avgCsat - previous.avgCsat) * 10) / 10
        : null,
      criteriaPassRate: current.criteriaPassRate !== null && previous.criteriaPassRate !== null
        ? current.criteriaPassRate - previous.criteriaPassRate
        : null,
    },
  }
}

/**
 * Enhanced assistant comparison with more metrics
 */
export interface EnhancedAssistantStats {
  id: string
  name: string
  totalCalls: number
  completedCalls: number
  failedCalls: number
  completionRate: number
  avgDuration: number
  totalDuration: number
  avgCsat: number | null
  csatCount: number
  criteriaPassRate: number | null
  criteriaCount: number
  variablesExtracted: number
}

export async function getEnhancedAssistantStats(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange
): Promise<EnhancedAssistantStats[]> {
  const supabase = await createClient()
  const { start } = getDateRange(range, customRange)

  // Get assistants
  const { data: assistants } = await supabase
    .from('assistants')
    .select('id, name')
    .eq('organization_id', organizationId)

  if (!assistants || assistants.length === 0) return []

  const stats: EnhancedAssistantStats[] = []

  for (const assistant of assistants) {
    // Get calls
    const { data: calls } = await supabase
      .from('call_sessions')
      .select('id, status, duration_seconds, csat_score')
      .eq('assistant_id', assistant.id)
      .gte('started_at', start.toISOString())

    const callList = calls || []
    const callIds = callList.map(c => c.id)

    // Get criteria results
    const { data: criteria } = callIds.length > 0
      ? await supabase
          .from('call_criteria_results')
          .select('passed')
          .in('call_session_id', callIds)
      : { data: [] }

    // Get variables count
    const { count: variablesCount } = await supabase
      .from('extracted_variables')
      .select('id', { count: 'exact', head: true })
      .in('call_session_id', callIds)

    const completed = callList.filter(c => c.status === 'completed').length
    const failed = callList.filter(c => c.status === 'failed').length
    const totalDuration = callList.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
    const csatScores = callList.filter(c => c.csat_score !== null).map(c => c.csat_score!)
    const criteriaList = criteria || []
    const passedCriteria = criteriaList.filter(c => c.passed === true).length

    stats.push({
      id: assistant.id,
      name: assistant.name,
      totalCalls: callList.length,
      completedCalls: completed,
      failedCalls: failed,
      completionRate: callList.length > 0 ? Math.round((completed / callList.length) * 100) : 0,
      avgDuration: callList.length > 0 ? Math.round(totalDuration / callList.length) : 0,
      totalDuration,
      avgCsat: csatScores.length > 0
        ? Math.round((csatScores.reduce((a, b) => a + b, 0) / csatScores.length) * 10) / 10
        : null,
      csatCount: csatScores.length,
      criteriaPassRate: criteriaList.length > 0
        ? Math.round((passedCriteria / criteriaList.length) * 100)
        : null,
      criteriaCount: criteriaList.length,
      variablesExtracted: variablesCount || 0,
    })
  }

  return stats.sort((a, b) => b.totalCalls - a.totalCalls)
}

/**
 * Get calls for drill-down (when clicking on chart elements)
 */
export interface DrillDownCall {
  id: string
  caller_number: string | null
  status: string | null
  started_at: string | null
  duration_seconds: number | null
  csat_score: number | null
  assistant_name: string | null
}

export async function getDrillDownCalls(
  organizationId: string,
  filters: {
    date?: string
    hour?: number
    dayOfWeek?: number
    assistantId?: string
    status?: string
    csatMin?: number
    csatMax?: number
  },
  limit: number = 50
): Promise<DrillDownCall[]> {
  const supabase = await createClient()

  let query = supabase
    .from('call_sessions')
    .select(`
      id,
      caller_number,
      status,
      started_at,
      duration_seconds,
      csat_score,
      assistants (name)
    `)
    .eq('organization_id', organizationId)
    .order('started_at', { ascending: false })
    .limit(limit)

  // Apply filters
  if (filters.date) {
    const startOfDay = new Date(filters.date)
    const endOfDay = new Date(filters.date)
    endOfDay.setDate(endOfDay.getDate() + 1)
    query = query
      .gte('started_at', startOfDay.toISOString())
      .lt('started_at', endOfDay.toISOString())
  }

  if (filters.assistantId) {
    query = query.eq('assistant_id', filters.assistantId)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.csatMin !== undefined) {
    query = query.gte('csat_score', filters.csatMin)
  }

  if (filters.csatMax !== undefined) {
    query = query.lte('csat_score', filters.csatMax)
  }

  const { data: calls } = await query

  // Filter by hour and day of week in JS (can't do in Supabase easily)
  let result = (calls || []).map(call => ({
    id: call.id,
    caller_number: call.caller_number,
    status: call.status,
    started_at: call.started_at,
    duration_seconds: call.duration_seconds,
    csat_score: call.csat_score,
    assistant_name: (call as unknown as { assistants?: { name: string } }).assistants?.name || null,
  }))

  if (filters.hour !== undefined || filters.dayOfWeek !== undefined) {
    result = result.filter(call => {
      if (!call.started_at) return false
      const date = new Date(call.started_at)
      if (filters.hour !== undefined && date.getHours() !== filters.hour) return false
      if (filters.dayOfWeek !== undefined && date.getDay() !== filters.dayOfWeek) return false
      return true
    })
  }

  return result.slice(0, limit)
}

/**
 * Get top extracted variables with counts
 */
export interface TopVariable {
  name: string
  label: string
  count: number
  uniqueValues: number
  topValues: { value: string; count: number }[]
}

export async function getTopExtractedVariables(
  organizationId: string,
  range: TimeRange,
  customRange?: DateRange,
  limit: number = 10
): Promise<TopVariable[]> {
  const supabase = await createClient()
  const { start } = getDateRange(range, customRange)

  const { data: variables } = await supabase
    .from('extracted_variables')
    .select('name, label, value')
    .eq('organization_id', organizationId)
    .gte('extracted_at', start.toISOString())

  if (!variables || variables.length === 0) return []

  // Group by variable name
  const grouped = new Map<string, { label: string; values: string[] }>()

  for (const v of variables) {
    let existing = grouped.get(v.name)
    if (!existing) {
      existing = { label: v.label || v.name, values: [] as string[] }
      grouped.set(v.name, existing)
    }
    if (v.value) existing.values.push(v.value)
  }

  // Calculate stats for each variable
  const result: TopVariable[] = []

  for (const [name, data] of grouped) {
    // Count value occurrences
    const valueCounts = new Map<string, number>()
    for (const value of data.values) {
      valueCounts.set(value, (valueCounts.get(value) || 0) + 1)
    }

    // Get top values
    const topValues = Array.from(valueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }))

    result.push({
      name,
      label: data.label,
      count: data.values.length,
      uniqueValues: valueCounts.size,
      topValues,
    })
  }

  return result.sort((a, b) => b.count - a.count).slice(0, limit)
}
