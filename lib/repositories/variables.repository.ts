import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { VariableDefinition } from '@/types/variables'

/**
 * Get variable definitions for extraction using service role.
 * Used by webhook handlers where RLS cannot apply.
 */
export async function getAssistantVariableDefinitionsForExtraction(
  assistantId: string
): Promise<{ definitions: VariableDefinition[]; error?: string }> {
  const supabase = createServiceRoleClient()

  const { data: definitions, error } = await supabase
    .from('variable_definitions')
    .select('*')
    .eq('assistant_id', assistantId)
    .order('position', { ascending: true })

  if (error) {
    console.error('Error fetching variable definitions for extraction:', error)
    return { definitions: [], error: error.message }
  }

  return { definitions: definitions as unknown as VariableDefinition[] }
}
