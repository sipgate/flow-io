import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { CallScenario, ScenarioNode, ScenarioEdge } from '@/types/scenarios'

/**
 * Fetch a call scenario by ID using service role.
 * Used by webhook handlers where RLS cannot apply.
 */
export async function getScenarioByIdServiceRole(
  id: string
): Promise<{ scenario: CallScenario | null; error: string | null }> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('call_scenarios')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return { scenario: null, error: error?.message || 'Scenario not found' }
  }

  const raw = data as unknown as Record<string, unknown>
  return {
    scenario: {
      ...(raw as unknown as CallScenario),
      nodes: (raw.nodes as ScenarioNode[]) || [],
      edges: (raw.edges as ScenarioEdge[]) || [],
      is_published: (raw.is_published as boolean) ?? false,
      version: (raw.version as number) ?? 1,
    },
    error: null,
  }
}
