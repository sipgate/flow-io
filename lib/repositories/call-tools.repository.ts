import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { CallToolConfig } from '@/types/call-tools'

/**
 * Get call tool configuration for an assistant using service role.
 * Used by webhook handlers where RLS cannot apply.
 */
export async function getCallToolConfigServiceRole(
  assistantId: string
): Promise<CallToolConfig | null> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('call_tool_configs')
    .select('*')
    .eq('assistant_id', assistantId)
    .single()

  if (error) return null

  return data as unknown as CallToolConfig
}
