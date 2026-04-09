'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { ExportFormat } from '@/lib/export/call-export-config'

interface CallSession {
  id: string
  session_id: string
  organization_id: string
  assistant_id: string | null
  phone_number_id: string | null
  caller_number: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  metadata: Record<string, unknown>
}

interface CallTranscript {
  id: string
  call_session_id: string
  speaker: string
  text: string
  timestamp: string | null
  confidence: number | null
  metadata: Record<string, unknown>
}

/**
 * Get all call sessions for an organization
 */
export async function getOrganizationCalls(orgId: string) {
  const supabase = await createClient()

  // Verify user has access to this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { calls: [], error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('call_sessions')
    .select(`
      *,
      assistants (
        id,
        name
      ),
      phone_numbers (
        id,
        phone_number
      ),
      call_scenarios:scenario_id (
        id,
        name
      ),
      extracted_variables (
        id,
        name,
        label,
        type,
        value,
        confidence
      ),
      call_notes (
        id,
        content
      )
    `)
    .eq('organization_id', orgId)
    .order('started_at', { ascending: false })

  if (error) {
    console.error('Error fetching calls:', error)
    return { calls: [], error: error.message }
  }

  return { calls: data, error: null }
}

/**
 * Get active call sessions that have been running for more than 2 hours
 */
export async function getStaleActiveCalls(orgId: string) {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { calls: [], error: 'Unauthorized' }
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('call_sessions')
    .select(`
      id,
      session_id,
      caller_number,
      started_at,
      assistants (
        id,
        name
      )
    `)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .lt('started_at', twoHoursAgo)

  if (error) {
    console.error('Error fetching stale calls:', error)
    return { calls: [], error: error.message }
  }

  return { calls: data ?? [], error: null }
}

/**
 * Mark an active call session as failed (stuck/stale)
 */
export async function markCallAsFailed(callId: string) {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('call_sessions')
    .select('organization_id, metadata')
    .eq('id', callId)
    .single()

  if (!session) {
    return { error: 'Call not found' }
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', session.organization_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { error: 'Unauthorized' }
  }

  // Use service role for the update — RLS only allows SELECT for regular users on call_sessions
  const serviceSupabase = createServiceRoleClient()
  const { error } = await serviceSupabase
    .from('call_sessions')
    .update({
      status: 'failed',
      ended_at: new Date().toISOString(),
      metadata: {
        ...(session.metadata as Record<string, unknown> ?? {}),
        auto_flagged_stale: true,
        flagged_at: new Date().toISOString(),
      },
    })
    .eq('id', callId)

  if (error) {
    console.error('Error marking call as failed:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Get a single call session with transcripts
 */
export async function getCallSession(callId: string) {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('call_sessions')
    .select(`
      *,
      assistants (
        id,
        name
      ),
      phone_numbers (
        id,
        phone_number
      )
    `)
    .eq('id', callId)
    .single()

  if (sessionError || !session) {
    return { session: null, transcripts: [], extractedVariables: [], error: 'Call not found' }
  }

  const typedSession = session as unknown as CallSession

  // Verify user has access to this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', typedSession.organization_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { session: null, transcripts: [], extractedVariables: [], error: 'Unauthorized' }
  }

  // Fetch transcripts
  const { data: transcripts } = await supabase
    .from('call_transcripts')
    .select('*')
    .eq('call_session_id', typedSession.id)
    .order('timestamp', { ascending: true })

  // Fetch extracted variables
  const { data: extractedVariables } = await supabase
    .from('extracted_variables')
    .select('*')
    .eq('call_session_id', typedSession.id)
    .order('extracted_at', { ascending: true })

  return {
    session: typedSession,
    transcripts: transcripts || [],
    extractedVariables: extractedVariables || [],
    error: null
  }
}

export async function createCallSession(...args: Parameters<typeof import('@/lib/repositories/calls.repository').createCallSession>) {
  const { createCallSession: fn } = await import('@/lib/repositories/calls.repository')
  return fn(...args)
}

export async function updateCallSession(...args: Parameters<typeof import('@/lib/repositories/calls.repository').updateCallSession>) {
  const { updateCallSession: fn } = await import('@/lib/repositories/calls.repository')
  return fn(...args)
}

export async function addTranscriptMessage(...args: Parameters<typeof import('@/lib/repositories/calls.repository').addTranscriptMessage>) {
  const { addTranscriptMessage: fn } = await import('@/lib/repositories/calls.repository')
  return fn(...args)
}

interface ExportOptions {
  organizationId: string
  fields: string[]
  format: ExportFormat
  dateFrom?: string
  dateTo?: string
}

interface ExportCallData {
  [key: string]: string | number | null | undefined
}

/**
 * Format duration as mm:ss
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Get calls data for export
 */
export async function getCallsForExport(options: ExportOptions): Promise<{
  data: ExportCallData[]
  error: string | null
}> {
  const supabase = await createClient()

  // Verify user has access to this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', options.organizationId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { data: [], error: 'Unauthorized' }
  }

  // Build query
  let query = supabase
    .from('call_sessions')
    .select(`
      id,
      session_id,
      caller_number,
      status,
      started_at,
      ended_at,
      duration_seconds,
      csat_score,
      csat_reasoning,
      metadata,
      assistants (
        id,
        name
      ),
      phone_numbers (
        id,
        phone_number
      ),
      extracted_variables (
        id,
        name,
        label,
        value
      ),
      call_notes (
        id,
        content
      )
    `)
    .eq('organization_id', options.organizationId)
    .order('started_at', { ascending: false })

  // Apply date filters
  if (options.dateFrom) {
    query = query.gte('started_at', options.dateFrom)
  }
  if (options.dateTo) {
    // Add one day to include the end date
    const endDate = new Date(options.dateTo)
    endDate.setDate(endDate.getDate() + 1)
    query = query.lt('started_at', endDate.toISOString())
  }

  const { data: calls, error } = await query

  if (error) {
    console.error('Error fetching calls for export:', error)
    return { data: [], error: error.message }
  }

  // Fetch transcripts if needed
  const transcriptsMap: Map<string, string> = new Map()
  if (options.fields.includes('transcript') && calls) {
    const callIds = calls.map(c => c.id)
    const { data: transcripts } = await supabase
      .from('call_transcripts')
      .select('call_session_id, speaker, text, timestamp')
      .in('call_session_id', callIds)
      .order('timestamp', { ascending: true })

    if (transcripts) {
      // Group transcripts by call
      const grouped = new Map<string, { speaker: string; text: string }[]>()
      for (const t of transcripts) {
        const existing = grouped.get(t.call_session_id) || []
        existing.push({ speaker: t.speaker, text: t.text })
        grouped.set(t.call_session_id, existing)
      }
      // Format as string
      for (const [callId, messages] of grouped) {
        const formatted = messages
          .map(m => `${m.speaker === 'assistant' ? 'Agent' : 'User'}: ${m.text}`)
          .join('\n')
        transcriptsMap.set(callId, formatted)
      }
    }
  }

  // Fetch criteria results if needed
  const criteriaMap: Map<string, string> = new Map()
  if (options.fields.includes('criteria_results') && calls) {
    const callIds = calls.map(c => c.id)
    const { data: results } = await supabase
      .from('call_criteria_results')
      .select(`
        call_session_id,
        passed,
        call_criteria (
          name
        )
      `)
      .in('call_session_id', callIds)

    if (results) {
      const grouped = new Map<string, string[]>()
      for (const r of results) {
        const existing = grouped.get(r.call_session_id) || []
        const criterion = (r as unknown as { call_session_id: string; passed: boolean | null; call_criteria: { name: string } | null }).call_criteria
        const status = r.passed === true ? 'Pass' : r.passed === false ? 'Fail' : 'N/A'
        existing.push(`${criterion?.name || 'Unknown'}: ${status}`)
        grouped.set(r.call_session_id, existing)
      }
      for (const [callId, items] of grouped) {
        criteriaMap.set(callId, items.join('; '))
      }
    }
  }

  // Transform data for export
  const exportData: ExportCallData[] = (calls || []).map(call => {
    const row: ExportCallData = {}
    const callWithJoins = call as unknown as {
      assistants?: { name: string }
      phone_numbers?: { phone_number: string }
      extracted_variables?: { label?: string; name: string; value: unknown }[]
      call_notes?: { content: string }[]
    }
    const assistant = callWithJoins.assistants
    const phoneNumber = callWithJoins.phone_numbers
    const variables = callWithJoins.extracted_variables || []
    const notes = callWithJoins.call_notes || []

    for (const field of options.fields) {
      switch (field) {
        case 'caller_number':
          row['Caller Number'] = call.caller_number
          break
        case 'assistant_name':
          row['Assistant'] = assistant?.name || ''
          break
        case 'phone_number':
          row['Phone Number'] = phoneNumber?.phone_number || ''
          break
        case 'status':
          row['Status'] = call.status
          break
        case 'started_at':
          row['Started At'] = call.started_at
          break
        case 'ended_at':
          row['Ended At'] = call.ended_at
          break
        case 'duration_seconds':
          row['Duration (seconds)'] = call.duration_seconds
          break
        case 'duration_formatted':
          row['Duration'] = formatDuration(call.duration_seconds)
          break
        case 'csat_score':
          row['CSAT Score'] = call.csat_score
          break
        case 'csat_reasoning':
          row['CSAT Reasoning'] = call.csat_reasoning
          break
        case 'extracted_variables':
          row['Extracted Variables'] = variables
            .map((v) => `${v.label || v.name}: ${v.value}`)
            .join('; ')
          break
        case 'notes':
          row['Notes'] = notes.map((n) => n.content).join('; ')
          break
        case 'transcript':
          row['Transcript'] = transcriptsMap.get(call.id) || ''
          break
        case 'criteria_results':
          row['Criteria Results'] = criteriaMap.get(call.id) || ''
          break
      }
    }

    return row
  })

  return { data: exportData, error: null }
}
