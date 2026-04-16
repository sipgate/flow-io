import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Create a new call session using service role.
 * Used by webhook handlers where RLS cannot apply.
 */
export async function createCallSession(data: {
  session_id: string
  organization_id: string
  assistant_id: string
  phone_number_id?: string
  scenario_id?: string | null
  caller_number: string
  metadata?: unknown
}) {
  const supabase = createServiceRoleClient()

  const { data: session, error } = await supabase
    .from('call_sessions')
    .insert({
      session_id: data.session_id,
      organization_id: data.organization_id,
      assistant_id: data.assistant_id,
      phone_number_id: data.phone_number_id || null,
      scenario_id: data.scenario_id || null,
      caller_number: data.caller_number,
      status: 'active',
      metadata: data.metadata || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating call session:', error)
    return { session: null, error: error.message }
  }

  return { session, error: null }
}

/**
 * Update a call session by sipgate session ID using service role.
 */
export async function updateCallSession(
  sessionId: string,
  updates: {
    status?: string
    ended_at?: string
    duration_seconds?: number
    metadata?: unknown
  }
) {
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('call_sessions')
    .update(updates)
    .eq('session_id', sessionId)

  if (error) {
    console.error('Error updating call session:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Add a transcript message to a call session using service role.
 */
export async function addTranscriptMessage(data: {
  call_session_id: string
  speaker: 'user' | 'assistant' | 'system' | 'tool'
  text: string
  confidence?: number
  metadata?: unknown
  assistant_name?: string
  assistant_avatar_url?: string | null
}) {
  const supabase = createServiceRoleClient()

  let metadata = data.assistant_name
    ? { ...(data.metadata as Record<string, unknown> | undefined), assistant_name: data.assistant_name }
    : data.metadata || null
  if (data.assistant_avatar_url && metadata) {
    metadata = { ...(metadata as Record<string, unknown>), assistant_avatar_url: data.assistant_avatar_url }
  }

  const { data: inserted, error } = await supabase.from('call_transcripts').insert({
    call_session_id: data.call_session_id,
    speaker: data.speaker,
    text: data.text,
    confidence: data.confidence || null,
    metadata,
  }).select('id').single()

  if (error) {
    console.error('Error adding transcript message:', error)
    return { error: error.message }
  }

  return { error: null, id: inserted?.id as string | undefined }
}
