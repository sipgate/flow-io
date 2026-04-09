'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { revalidatePath } from 'next/cache'
import type {
  VariableDefinition,
  VariableDefinitionInsert,
  VariableDefinitionUpdate,
  ExtractedVariable,
} from '@/types/variables'

/**
 * Get all variable definitions for an assistant
 */
export async function getAssistantVariableDefinitions(assistantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { definitions: [], error: 'Unauthorized' }
  }

  const { data: definitions, error } = await supabase
    .from('variable_definitions')
    .select('*')
    .eq('assistant_id', assistantId)
    .order('position', { ascending: true })

  if (error) {
    console.error('Error fetching variable definitions:', error)
    return { definitions: [], error: error.message }
  }

  return { definitions: definitions as unknown as VariableDefinition[] }
}

/**
 * Create a new variable definition
 */
export async function createVariableDefinition(data: VariableDefinitionInsert) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { definition: null, error: 'Unauthorized' }
  }

  // Get the next position
  const { data: existing } = await supabase
    .from('variable_definitions')
    .select('position')
    .eq('assistant_id', data.assistant_id)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

  const { data: definition, error } = await supabase
    .from('variable_definitions')
    .insert({
      ...data,
      position: data.position ?? nextPosition,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating variable definition:', error)
    return { definition: null, error: error.message }
  }

  return { definition: definition as unknown as VariableDefinition }
}

/**
 * Update a variable definition
 */
export async function updateVariableDefinition(
  definitionId: string,
  data: VariableDefinitionUpdate
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { definition: null, error: 'Unauthorized' }
  }

  const { data: definition, error } = await supabase
    .from('variable_definitions')
    .update(data)
    .eq('id', definitionId)
    .select()
    .single()

  if (error) {
    console.error('Error updating variable definition:', error)
    return { definition: null, error: error.message }
  }

  return { definition: definition as unknown as VariableDefinition }
}

/**
 * Delete a variable definition
 */
export async function deleteVariableDefinition(definitionId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('variable_definitions')
    .delete()
    .eq('id', definitionId)

  if (error) {
    console.error('Error deleting variable definition:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Reorder variable definitions
 */
export async function reorderVariableDefinitions(
  assistantId: string,
  orderedIds: string[]
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Update positions in a transaction-like manner
  const updates = orderedIds.map((id, index) =>
    supabase
      .from('variable_definitions')
      .update({ position: index })
      .eq('id', id)
      .eq('assistant_id', assistantId)
  )

  const results = await Promise.all(updates)
  const hasError = results.some((r) => r.error)

  if (hasError) {
    return { success: false, error: 'Failed to reorder definitions' }
  }

  return { success: true }
}

/**
 * Get extracted variables for a call session
 */
export async function getCallExtractedVariables(callSessionId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { variables: [], error: 'Unauthorized' }
  }

  const { data: variables, error } = await supabase
    .from('extracted_variables')
    .select('*')
    .eq('call_session_id', callSessionId)
    .order('extracted_at', { ascending: true })

  if (error) {
    console.error('Error fetching extracted variables:', error)
    return { variables: [], error: error.message }
  }

  return { variables: variables as unknown as ExtractedVariable[] }
}

/**
 * Store extracted variables (called by the extractor service)
 * Uses service role client to bypass RLS
 */
export async function storeExtractedVariables(
  callSessionId: string,
  organizationId: string,
  variables: Array<{
    variable_definition_id?: string | null
    name: string
    label: string
    type: string
    value: string | null
    confidence: number | null
  }>
) {
  const supabase = createServiceRoleClient()

  const records = variables.map((v) => ({
    call_session_id: callSessionId,
    organization_id: organizationId,
    variable_definition_id: v.variable_definition_id || null,
    // Old columns (for backward compatibility)
    variable_name: v.name,
    variable_value: v.value,
    // New columns
    name: v.name,
    label: v.label,
    type: v.type,
    value: v.value,
    confidence: v.confidence,
  }))

  const { data, error } = await supabase
    .from('extracted_variables')
    .insert(records)
    .select()

  if (error) {
    console.error('Error storing extracted variables:', error)
    return { variables: [], error: error.message }
  }

  return { variables: data as unknown as ExtractedVariable[] }
}

/**
 * Check if an assistant has variable definitions
 */
export async function hasAssistantVariables(assistantId: string) {
  const supabase = createServiceRoleClient()

  const { count, error } = await supabase
    .from('variable_definitions')
    .select('*', { count: 'exact', head: true })
    .eq('assistant_id', assistantId)

  if (error) {
    console.error('Error checking variable definitions:', error)
    return { hasVariables: false }
  }

  return { hasVariables: (count ?? 0) > 0 }
}

export async function getAssistantVariableDefinitionsForExtraction(...args: Parameters<typeof import('@/lib/repositories/variables.repository').getAssistantVariableDefinitionsForExtraction>) {
  const { getAssistantVariableDefinitionsForExtraction: fn } = await import('@/lib/repositories/variables.repository')
  return fn(...args)
}

/**
 * Trigger re-extraction of variables for a call session
 * Runs in the background and returns immediately
 */
export async function triggerVariableReextraction(callSessionId: string): Promise<{
  success: boolean
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { reextractVariables } = await import('@/lib/services/variable-extractor')
  reextractVariables(callSessionId).catch((err) => {
    console.error('[Variables] Background re-extraction error:', err)
  })

  return { success: true, error: null }
}
