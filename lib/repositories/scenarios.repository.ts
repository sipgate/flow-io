import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { CallScenario, ScenarioNode, ScenarioEdge } from '@/types/scenarios'

/**
 * Fetch a call scenario by ID using service role.
 * Used by webhook handlers where RLS cannot apply.
 */
export async function getScenarioByIdServiceRole(
  id: string,
  options: { deployment?: 'draft' | 'published' } = {}
): Promise<{ scenario: CallScenario | null; error: string | null }> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.from('call_scenarios').select('*').eq('id', id).single()

  if (error || !data) {
    return { scenario: null, error: error?.message || 'Scenario not found' }
  }

  const raw = data as unknown as Record<string, unknown>
  let deployedVersion: Record<string, unknown> | null = null

  if (options.deployment === 'published') {
    const { data: versions } = await supabase
      .from('call_scenario_versions')
      .select(
        'nodes, edges, variables, version, published_at, voice_provider, voice_id, voice_language'
      )
      .eq('scenario_id', id)
      .order('version', { ascending: false })
      .limit(1)

    deployedVersion = (versions?.[0] as Record<string, unknown> | undefined) ?? null

    if (!deployedVersion && !raw.is_published && !raw.deployed_at) {
      return { scenario: null, error: 'Scenario has not been applied to calls' }
    }
  }

  return {
    scenario: {
      ...(raw as unknown as CallScenario),
      nodes: ((deployedVersion ? deployedVersion.nodes : raw.nodes) as ScenarioNode[]) || [],
      edges: ((deployedVersion ? deployedVersion.edges : raw.edges) as ScenarioEdge[]) || [],
      variables: (deployedVersion
        ? deployedVersion.variables
        : raw.variables) as CallScenario['variables'],
      voice_provider: (deployedVersion ? deployedVersion.voice_provider : raw.voice_provider) as
        | string
        | null,
      voice_id: (deployedVersion ? deployedVersion.voice_id : raw.voice_id) as string | null,
      voice_language: (deployedVersion ? deployedVersion.voice_language : raw.voice_language) as
        | string
        | null,
      is_published: (raw.is_published as boolean) ?? false,
      version: (raw.version as number) ?? 1,
    },
    error: null,
  }
}
