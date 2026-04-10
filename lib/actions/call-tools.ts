'use server'

import { debug } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { CallToolConfig, CallToolConfigInput, CallNote, CallNoteInput } from '@/types/call-tools'

/**
 * Get call tool configuration for an assistant
 */
export async function getCallToolConfig(
  assistantId: string
): Promise<{ config: CallToolConfig | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('call_tool_configs')
    .select('*')
    .eq('assistant_id', assistantId)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { config: null, error: error.message }
  }

  return { config: (data as unknown as CallToolConfig) || null, error: null }
}

export async function getCallToolConfigServiceRole(
  assistantId: string
): ReturnType<typeof import('@/lib/repositories/call-tools.repository').getCallToolConfigServiceRole> {
  const { getCallToolConfigServiceRole: fn } = await import('@/lib/repositories/call-tools.repository')
  return fn(assistantId)
}

/**
 * Create or update call tool configuration
 */
export async function upsertCallToolConfig(
  input: CallToolConfigInput
): Promise<{ config: CallToolConfig | null; error: string | null }> {
  const supabase = await createClient()

  // Check if config already exists
  const { data: existing } = await supabase
    .from('call_tool_configs')
    .select('id')
    .eq('assistant_id', input.assistant_id)
    .single()

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('call_tool_configs')
      .update({
        hangup_enabled: input.hangup_enabled,
        hangup_instructions: input.hangup_instructions,
        forward_enabled: input.forward_enabled,
        forward_phone_number: input.forward_phone_number,
        forward_caller_id_name: input.forward_caller_id_name,
        forward_caller_id_number: input.forward_caller_id_number,
        forward_instructions: input.forward_instructions,
        note_enabled: input.note_enabled,
        note_instructions: input.note_instructions,
        barge_in_strategy: input.barge_in_strategy,
        barge_in_minimum_characters: input.barge_in_minimum_characters,
        barge_in_allow_after_ms: input.barge_in_allow_after_ms,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      return { config: null, error: error.message }
    }

    return { config: data as unknown as CallToolConfig, error: null }
  } else {
    // Create new
    const { data, error } = await supabase
      .from('call_tool_configs')
      .insert({
        assistant_id: input.assistant_id,
        organization_id: input.organization_id,
        hangup_enabled: input.hangup_enabled ?? false,
        hangup_instructions: input.hangup_instructions,
        forward_enabled: input.forward_enabled ?? false,
        forward_phone_number: input.forward_phone_number,
        forward_caller_id_name: input.forward_caller_id_name,
        forward_caller_id_number: input.forward_caller_id_number,
        forward_instructions: input.forward_instructions,
        note_enabled: input.note_enabled ?? false,
        note_instructions: input.note_instructions,
        barge_in_strategy: input.barge_in_strategy ?? 'immediate',
        barge_in_minimum_characters: input.barge_in_minimum_characters ?? 0,
        barge_in_allow_after_ms: input.barge_in_allow_after_ms ?? 300,
      })
      .select()
      .single()

    if (error) {
      return { config: null, error: error.message }
    }

    return { config: data as unknown as CallToolConfig, error: null }
  }
}

/**
 * Update only barge-in configuration fields (preserves all other tool settings)
 */
export async function updateBargeInConfig(
  assistantId: string,
  organizationId: string,
  data: {
    barge_in_strategy: 'none' | 'manual' | 'minimum_characters' | 'immediate'
    barge_in_minimum_characters: number
    barge_in_allow_after_ms: number
  }
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('call_tool_configs')
    .select('id')
    .eq('assistant_id', assistantId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('call_tool_configs')
      .update({
        barge_in_strategy: data.barge_in_strategy,
        barge_in_minimum_characters: data.barge_in_minimum_characters,
        barge_in_allow_after_ms: data.barge_in_allow_after_ms,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return { error: error?.message ?? null }
  } else {
    const { error } = await supabase
      .from('call_tool_configs')
      .insert({
        assistant_id: assistantId,
        organization_id: organizationId,
        hangup_enabled: false,
        forward_enabled: false,
        note_enabled: false,
        barge_in_strategy: data.barge_in_strategy,
        barge_in_minimum_characters: data.barge_in_minimum_characters,
        barge_in_allow_after_ms: data.barge_in_allow_after_ms,
      })
    return { error: error?.message ?? null }
  }
}

/**
 * Create a call note (used by the LLM tool)
 * Includes deduplication to prevent duplicate notes from LLM calling the tool multiple times
 */
export async function createCallNote(
  input: CallNoteInput
): Promise<{ note: CallNote | null; error: string | null }> {
  const supabase = createServiceRoleClient()

  // Check for duplicate note (same content within last 60 seconds for this call)
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
  const { data: existing } = await supabase
    .from('call_notes')
    .select('id')
    .eq('call_session_id', input.call_session_id)
    .eq('content', input.content)
    .gte('created_at', oneMinuteAgo)
    .limit(1)

  if (existing && existing.length > 0) {
    debug('[CallTools] Duplicate note detected, skipping')
    return { note: null, error: null } // Silent skip, not an error
  }

  const { data, error } = await supabase
    .from('call_notes')
    .insert({
      call_session_id: input.call_session_id,
      organization_id: input.organization_id,
      assistant_id: input.assistant_id,
      content: input.content,
      category: input.category,
      priority: input.priority,
      conversation_context: input.conversation_context,
    })
    .select()
    .single()

  if (error) {
    return { note: null, error: error.message }
  }

  return { note: data as unknown as CallNote, error: null }
}

/**
 * Get notes for a call session
 */
export async function getCallNotes(
  callSessionId: string
): Promise<{ notes: CallNote[]; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('call_notes')
    .select('*')
    .eq('call_session_id', callSessionId)
    .order('created_at', { ascending: true })

  if (error) {
    return { notes: [], error: error.message }
  }

  return { notes: (data as unknown as CallNote[]) || [], error: null }
}

/**
 * Get all notes for an organization (for a notes dashboard)
 */
export async function getOrganizationCallNotes(
  organizationId: string,
  limit: number = 50
): Promise<{ notes: CallNote[]; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('call_notes')
    .select('*, call_sessions(caller_number, started_at), assistants(name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { notes: [], error: error.message }
  }

  return { notes: (data as unknown as CallNote[]) || [], error: null }
}
