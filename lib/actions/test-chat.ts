'use server'

import { createClient } from '@/lib/supabase/server'

interface TestSession {
  id: string
  organization_id: string
  assistant_id: string
  name: string | null
  status: string
  started_at: string
  last_message_at: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface TestTranscript {
  id: string
  test_session_id: string
  organization_id: string
  role: string
  content: string
  timestamp: string
  sequence_number: number
  metadata: Record<string, unknown>
  created_at: string
}

/**
 * Get all test sessions for an organization
 */
export async function getOrganizationTestSessions(orgId: string) {
  const supabase = await createClient()

  // Verify user has access to this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { sessions: [], error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('test_sessions')
    .select(`
      *,
      assistants (
        id,
        name
      )
    `)
    .eq('organization_id', orgId)
    .order('last_message_at', { ascending: false })

  if (error) {
    console.error('Error fetching test sessions:', error)
    return { sessions: [], error: error.message }
  }

  return { sessions: data, error: null }
}

/**
 * Get a single test session with transcripts
 */
export async function getTestSession(sessionId: string) {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('test_sessions')
    .select(`
      *,
      assistants (
        id,
        name,
        llm_provider,
        llm_model,
        llm_temperature,
        system_prompt,
        opening_message
      )
    `)
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return { session: null, transcripts: [], error: 'Session not found' }
  }

  const typedSession = session as unknown as TestSession

  // Verify user has access to this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', typedSession.organization_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { session: null, transcripts: [], error: 'Unauthorized' }
  }

  // Get transcripts for this session
  const { data: transcripts, error: transcriptsError } = await supabase
    .from('test_transcripts')
    .select('*')
    .eq('test_session_id', sessionId)
    .order('sequence_number', { ascending: true })

  if (transcriptsError) {
    console.error('Error fetching transcripts:', transcriptsError)
    return { session: typedSession, transcripts: [], error: transcriptsError.message }
  }

  return { session: typedSession, transcripts: transcripts || [], error: null }
}

/**
 * Create a new test session
 */
export async function createTestSession(data: {
  organization_id: string
  assistant_id: string
  name?: string
}) {
  const supabase = await createClient()

  // Verify user has access to this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', data.organization_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { session: null, error: 'Unauthorized' }
  }

  // Verify assistant exists and belongs to organization
  const { data: assistant } = await supabase
    .from('assistants')
    .select('id, organization_id')
    .eq('id', data.assistant_id)
    .eq('organization_id', data.organization_id)
    .single()

  if (!assistant) {
    return { session: null, error: 'Assistant not found' }
  }

  const { data: session, error } = await supabase
    .from('test_sessions')
    .insert({
      organization_id: data.organization_id,
      assistant_id: data.assistant_id,
      name: data.name || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating test session:', error)
    return { session: null, error: error.message }
  }

  return { session, error: null }
}

/**
 * Update a test session (rename, archive)
 */
export async function updateTestSession(
  sessionId: string,
  updates: {
    name?: string
    status?: 'active' | 'archived'
  }
) {
  const supabase = await createClient()

  // Get session to verify access
  const { data: session } = await supabase
    .from('test_sessions')
    .select('organization_id')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return { session: null, error: 'Session not found' }
  }

  // Verify user has access
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', session.organization_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { session: null, error: 'Unauthorized' }
  }

  const { data: updatedSession, error } = await supabase
    .from('test_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) {
    console.error('Error updating test session:', error)
    return { session: null, error: error.message }
  }

  return { session: updatedSession, error: null }
}

/**
 * Delete a test session
 */
export async function deleteTestSession(sessionId: string) {
  const supabase = await createClient()

  // Get session to verify access
  const { data: session } = await supabase
    .from('test_sessions')
    .select('organization_id')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return { error: 'Session not found' }
  }

  // Verify user has access
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', session.organization_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('test_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    console.error('Error deleting test session:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Add a transcript message to a test session
 */
export async function addTestTranscriptMessage(data: {
  test_session_id: string
  organization_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sequence_number: number
  metadata?: Record<string, unknown>
}) {
  const supabase = await createClient()

  // Verify user has access
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', data.organization_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { transcript: null, error: 'Unauthorized' }
  }

  const { data: transcript, error } = await supabase
    .from('test_transcripts')
    .insert({
      test_session_id: data.test_session_id,
      organization_id: data.organization_id,
      role: data.role,
      content: data.content,
      sequence_number: data.sequence_number,
      metadata: data.metadata || {},
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding transcript message:', error)
    return { transcript: null, error: error.message }
  }

  return { transcript, error: null }
}

/**
 * Get the next sequence number for a test session
 */
export async function getNextSequenceNumber(testSessionId: string) {
  const supabase = await createClient()

  const { data: transcripts } = await supabase
    .from('test_transcripts')
    .select('sequence_number')
    .eq('test_session_id', testSessionId)
    .order('sequence_number', { ascending: false })
    .limit(1)

  if (!transcripts || transcripts.length === 0) {
    return { sequenceNumber: 1, error: null }
  }

  return { sequenceNumber: transcripts[0].sequence_number + 1, error: null }
}

/**
 * Get conversation history for a test session
 */
export async function getTestSessionHistory(testSessionId: string) {
  const supabase = await createClient()

  const { data: transcripts, error } = await supabase
    .from('test_transcripts')
    .select('id, role, content, timestamp, sequence_number, metadata')
    .eq('test_session_id', testSessionId)
    .order('sequence_number', { ascending: true })

  if (error) {
    console.error('Error fetching session history:', error)
    return { history: [], error: error.message }
  }

  return { history: transcripts || [], error: null }
}
