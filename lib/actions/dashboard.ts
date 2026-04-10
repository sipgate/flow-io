'use server'

import { createClient } from '@/lib/supabase/server'

export interface DashboardStats {
  totalAssistants: number
  activeCalls: number
  callsToday: number
  callsThisWeek: number
  avgCallDuration: number
  totalKnowledgeDocs: number
  variablesExtractedToday: number
  phoneNumbersActive: number
}

export interface RecentCallNote {
  id: string
  content: string
}

export interface RecentCallVariable {
  name: string
  value: string | null
}

export interface RecentCall {
  id: string
  session_id: string
  caller_number: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  assistant_name: string | null
  phone_number: string | null
  extracted_variables: RecentCallVariable[]
  notes: RecentCallNote[]
}

export interface CallVolumeData {
  date: string
  calls: number
  avgDuration: number
}

export interface TopVariable {
  name: string
  label: string
  count: number
}

/**
 * Get dashboard statistics for an organization
 */
export async function getDashboardStats(organizationId: string): Promise<DashboardStats> {
  const supabase = await createClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all stats in parallel
  const [
    assistantsResult,
    activeCallsResult,
    callsTodayResult,
    callsThisWeekResult,
    knowledgeDocsResult,
    variablesTodayResult,
    phoneNumbersResult,
  ] = await Promise.all([
    // Total assistants
    supabase
      .from('assistants')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),

    // Active calls
    supabase
      .from('call_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'active'),

    // Calls today with duration for average
    supabase
      .from('call_sessions')
      .select('id, duration_seconds')
      .eq('organization_id', organizationId)
      .gte('started_at', todayStart),

    // Calls this week
    supabase
      .from('call_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('started_at', weekStart),

    // Knowledge base documents
    supabase
      .from('kb_documents')
      .select('id, knowledge_bases!inner(organization_id)', { count: 'exact', head: true })
      .eq('knowledge_bases.organization_id', organizationId),

    // Variables extracted today
    supabase
      .from('extracted_variables')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('extracted_at', todayStart),

    // Active phone numbers
    supabase
      .from('phone_numbers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .not('assistant_id', 'is', null),
  ])

  // Calculate average duration from today's calls
  const callsToday = callsTodayResult.data || []
  const totalDuration = callsToday.reduce((sum, call) => sum + (call.duration_seconds || 0), 0)
  const avgDuration = callsToday.length > 0 ? Math.round(totalDuration / callsToday.length) : 0

  return {
    totalAssistants: assistantsResult.count || 0,
    activeCalls: activeCallsResult.count || 0,
    callsToday: callsToday.length,
    callsThisWeek: callsThisWeekResult.count || 0,
    avgCallDuration: avgDuration,
    totalKnowledgeDocs: knowledgeDocsResult.count || 0,
    variablesExtractedToday: variablesTodayResult.count || 0,
    phoneNumbersActive: phoneNumbersResult.count || 0,
  }
}

/**
 * Get recent calls for dashboard
 */
export async function getRecentCalls(organizationId: string, limit = 5): Promise<RecentCall[]> {
  const supabase = await createClient()

  const { data: calls, error } = await supabase
    .from('call_sessions')
    .select(`
      id,
      session_id,
      caller_number,
      status,
      started_at,
      ended_at,
      duration_seconds,
      assistants (name),
      phone_numbers (phone_number),
      extracted_variables (name, value),
      call_notes (id, content)
    `)
    .eq('organization_id', organizationId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error || !calls) {
    console.error('Error fetching recent calls:', error)
    return []
  }

  type CallWithJoins = {
    id: string
    session_id: string
    caller_number: string | null
    status: string | null
    started_at: string | null
    ended_at: string | null
    duration_seconds: number | null
    assistants?: { name: string } | null
    phone_numbers?: { phone_number: string } | null
    extracted_variables?: { name: string; value: string | null }[]
    call_notes?: { id: string; content: string }[]
  }
  return (calls as unknown as CallWithJoins[]).map((call) => ({
    id: call.id,
    session_id: call.session_id,
    caller_number: call.caller_number,
    status: call.status,
    started_at: call.started_at,
    ended_at: call.ended_at,
    duration_seconds: call.duration_seconds,
    assistant_name: call.assistants?.name || null,
    phone_number: call.phone_numbers?.phone_number || null,
    extracted_variables: (call.extracted_variables || []).map((v) => ({
      name: v.name,
      value: v.value,
    })),
    notes: (call.call_notes || []).map((n) => ({
      id: n.id,
      content: n.content,
    })),
  }))
}

/**
 * Get call volume data for the last 7 days
 */
export async function getCallVolumeData(organizationId: string): Promise<CallVolumeData[]> {
  const supabase = await createClient()

  const days: CallVolumeData[] = []
  const now = new Date()

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    const { data: calls } = await supabase
      .from('call_sessions')
      .select('id, duration_seconds')
      .eq('organization_id', organizationId)
      .gte('started_at', dayStart.toISOString())
      .lt('started_at', dayEnd.toISOString())

    const callCount = calls?.length || 0
    const totalDuration = calls?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0
    const avgDuration = callCount > 0 ? Math.round(totalDuration / callCount) : 0

    days.push({
      date: dayStart.toISOString().split('T')[0],
      calls: callCount,
      avgDuration,
    })
  }

  return days
}

/**
 * Get top extracted variables
 */
export async function getTopVariables(organizationId: string, limit = 5): Promise<TopVariable[]> {
  const supabase = await createClient()

  const { data: variables, error } = await supabase
    .from('extracted_variables')
    .select('name, label')
    .eq('organization_id', organizationId)
    .not('value', 'is', null)

  if (error || !variables) {
    return []
  }

  // Count occurrences
  const counts: Record<string, { label: string; count: number }> = {}
  for (const v of variables) {
    if (!counts[v.name]) {
      counts[v.name] = { label: v.label || v.name, count: 0 }
    }
    counts[v.name].count++
  }

  // Sort and return top
  return Object.entries(counts)
    .map(([name, data]) => ({ name, label: data.label, count: data.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/**
 * Check which optional features are enabled for an organization
 */
export interface FeatureFlags {
  hasCriteria: boolean
  hasCsatEnabled: boolean
  hasVariableDefinitions: boolean
}

export async function getFeatureFlags(organizationId: string): Promise<FeatureFlags> {
  const supabase = await createClient()

  const [criteriaResult, csatResult, variablesResult] = await Promise.all([
    supabase
      .from('call_criteria')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('call_scenarios')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('enable_csat', true),
    supabase
      .from('variable_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
  ])

  return {
    hasCriteria: (criteriaResult.count || 0) > 0,
    hasCsatEnabled: (csatResult.count || 0) > 0,
    hasVariableDefinitions: (variablesResult.count || 0) > 0,
  }
}

/**
 * Get system status (phone numbers and their connection status)
 */
export async function getSystemStatus(organizationId: string) {
  const supabase = await createClient()

  // Get phone numbers assigned to this org's assistants
  const { data: phoneNumbers } = await supabase
    .from('phone_numbers')
    .select(`
      id,
      phone_number,
      assistant_id,
      assistants!inner (
        id,
        name,
        organization_id
      )
    `)
    .eq('assistants.organization_id', organizationId)

  // Get total assistant count
  const { count: assistantCount } = await supabase
    .from('assistants')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  const connectedCount = phoneNumbers?.length || 0

  return {
    connectedCount,
    assistantCount: assistantCount || 0,
    allAssistantsHavePhoneNumber: assistantCount !== null && assistantCount > 0 && connectedCount >= assistantCount,
  }
}
