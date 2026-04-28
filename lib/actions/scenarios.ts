'use server'

import { createClient } from '@/lib/supabase/server'
import { autoAssignPhoneNumberToFlow } from '@/lib/actions/phone-numbers'
import type {
  CallScenario,
  ScenarioNode,
  ScenarioEdge,
  ScenarioSummary,
  ScenarioVersion,
} from '@/types/scenarios'
import { getScenarioByIdServiceRole as _getScenarioByIdServiceRole } from '@/lib/repositories/scenarios.repository'

export async function getScenarios(
  orgId: string
): Promise<{ scenarios: ScenarioSummary[]; error: string | null }> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { scenarios: [], error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('call_scenarios')
    .select(
      `
      id, name, description, is_published, version, nodes, created_at, updated_at,
      deployed_at, has_undeployed_changes,
      phone_numbers (phone_number)
    `
    )
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false })

  if (error) {
    return { scenarios: [], error: error.message }
  }

  const scenarios: ScenarioSummary[] = (data || []).map((f) => {
    const raw = f as unknown as Record<string, unknown>
    const phoneNumbers = raw.phone_numbers as Array<{ phone_number: string }> | null
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      is_published: f.is_published ?? false,
      version: f.version ?? 1,
      deployed_at: (raw.deployed_at as string | null) ?? null,
      has_undeployed_changes: (raw.has_undeployed_changes as boolean | null) ?? false,
      node_count: Array.isArray(f.nodes) ? f.nodes.length : 0,
      phone_number: phoneNumbers?.[0]?.phone_number ?? null,
      created_at: f.created_at,
      updated_at: f.updated_at,
    }
  })

  return { scenarios, error: null }
}

export async function getScenario(
  id: string
): Promise<{ scenario: CallScenario | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('call_scenarios')
    .select('*, phone_numbers(phone_number)')
    .eq('id', id)
    .single()

  if (error || !data) {
    return { scenario: null, error: error?.message || 'Scenario not found' }
  }

  const raw = data as unknown as Record<string, unknown>
  const phoneNumbers = raw.phone_numbers as Array<{ phone_number: string }> | null
  return {
    scenario: {
      ...(raw as unknown as CallScenario),
      nodes: (raw.nodes as ScenarioNode[]) || [],
      edges: (raw.edges as ScenarioEdge[]) || [],
      is_published: (raw.is_published as boolean) ?? false,
      version: (raw.version as number) ?? 1,
      phone_number: phoneNumbers?.[0]?.phone_number ?? null,
    },
    error: null,
  }
}

export async function getScenarioByIdServiceRole(
  ...args: Parameters<typeof _getScenarioByIdServiceRole>
) {
  return _getScenarioByIdServiceRole(...args)
}

export async function createScenario(
  orgId: string,
  input: { name: string; description?: string; skipPhoneNumberCheck?: boolean }
): Promise<{ scenario: CallScenario | null; error: string | null; noPhoneNumbers?: boolean }> {
  const supabase = await createClient()

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return { scenario: null, error: 'Unauthorized' }

  // Check if any unassigned phone numbers are available
  if (!input.skipPhoneNumberCheck) {
    const { data: availableNumbers } = await supabase
      .from('phone_numbers')
      .select('id')
      .eq('organization_id', orgId)
      .is('scenario_id', null)
      .eq('is_active', true)
      .limit(1)

    if (!availableNumbers || availableNumbers.length === 0) {
      return { scenario: null, error: 'NO_PHONE_NUMBERS', noPhoneNumbers: true }
    }
  }

  const { data, error } = await supabase
    .from('call_scenarios')
    .insert({
      organization_id: orgId,
      name: input.name,
      description: input.description || null,
      nodes: [],
      edges: [],
      version: 1,
      is_published: false,
      has_undeployed_changes: true,
      created_by: user.user.id,
    })
    .select()
    .single()

  if (error || !data) {
    return { scenario: null, error: error?.message || 'Failed to create scenario' }
  }

  const scenarioId = (data as unknown as Record<string, unknown>).id as string

  // Auto-assign an available phone number (best-effort, non-critical)
  try {
    await autoAssignPhoneNumberToFlow(scenarioId, orgId)
  } catch (err) {
    console.warn('[createScenario] Auto phone assignment failed:', err)
  }

  const raw = data as unknown as Record<string, unknown>
  return {
    scenario: {
      ...(raw as unknown as CallScenario),
      nodes: [],
      edges: [],
      is_published: false,
      version: 1,
    },
    error: null,
  }
}

export async function updateScenario(
  id: string,
  nodes: ScenarioNode[],
  edges: ScenarioEdge[],
  name?: string,
  description?: string,
  options?: { markUndeployed?: boolean; clearUndeployed?: boolean }
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const updates: Record<string, unknown> = {
    nodes: nodes as unknown as Record<string, unknown>[],
    edges: edges as unknown as Record<string, unknown>[],
    updated_at: new Date().toISOString(),
  }
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (options?.clearUndeployed) {
    updates.has_undeployed_changes = false
  } else if (options?.markUndeployed ?? true) {
    updates.has_undeployed_changes = true
  }

  const { error } = await supabase.from('call_scenarios').update(updates).eq('id', id)

  return { error: error?.message || null }
}

export async function deleteScenario(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.from('call_scenarios').delete().eq('id', id)

  return { error: error?.message || null }
}

export async function publishScenario(id: string): Promise<{ error: string | null }> {
  return deployScenario(id)
}

export async function deployScenario(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  // Get current scenario
  const { data: scenario, error: fetchError } = await supabase
    .from('call_scenarios')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !scenario) {
    return { error: fetchError?.message || 'Scenario not found' }
  }

  const rawScenario = scenario as unknown as Record<string, unknown>
  const newVersion = ((rawScenario.version as number) ?? 1) + 1
  const now = new Date().toISOString()

  // Save version snapshot
  const { error: versionError } = await supabase.from('call_scenario_versions').insert({
    scenario_id: id,
    version: (rawScenario.version as number) ?? 1,
    nodes: rawScenario.nodes as unknown[],
    edges: rawScenario.edges as unknown[],
    variables: rawScenario.variables as Record<string, unknown>,
    voice_provider: rawScenario.voice_provider as string | null,
    voice_id: rawScenario.voice_id as string | null,
    voice_language: rawScenario.voice_language as string | null,
    published_at: now,
  })
  if (versionError) {
    return { error: versionError.message }
  }

  // Update scenario
  const { error } = await supabase
    .from('call_scenarios')
    .update({
      is_published: true,
      version: newVersion,
      updated_at: now,
      deployed_at: now,
      has_undeployed_changes: false,
    })
    .eq('id', id)

  return { error: error?.message || null }
}

export async function revertScenario(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: latestVersion, error: fetchError } = await supabase
    .from('call_scenario_versions')
    .select('nodes, edges, voice_provider, voice_id, voice_language')
    .eq('scenario_id', id)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (fetchError || !latestVersion) {
    return { error: fetchError?.message || 'No deployed version found' }
  }

  const { error } = await supabase
    .from('call_scenarios')
    .update({
      nodes: latestVersion.nodes as unknown as Record<string, unknown>[],
      edges: latestVersion.edges as unknown as Record<string, unknown>[],
      voice_provider: latestVersion.voice_provider,
      voice_id: latestVersion.voice_id,
      voice_language: latestVersion.voice_language,
      updated_at: new Date().toISOString(),
      has_undeployed_changes: false,
    })
    .eq('id', id)

  return { error: error?.message || null }
}

export async function getScenarioVersions(
  id: string
): Promise<{ versions: ScenarioVersion[]; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('call_scenario_versions')
    .select('id, version, published_at, created_by')
    .eq('scenario_id', id)
    .order('version', { ascending: false })

  return { versions: (data ?? []) as ScenarioVersion[], error: error?.message || null }
}

export async function restoreScenarioVersion(
  scenarioId: string,
  versionId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: version, error: fetchError } = await supabase
    .from('call_scenario_versions')
    .select('nodes, edges, voice_provider, voice_id, voice_language')
    .eq('id', versionId)
    .single()

  if (fetchError || !version) {
    return { error: fetchError?.message || 'Version not found' }
  }

  const { error } = await supabase
    .from('call_scenarios')
    .update({
      nodes: version.nodes as unknown as Record<string, unknown>[],
      edges: version.edges as unknown as Record<string, unknown>[],
      voice_provider: version.voice_provider,
      voice_id: version.voice_id,
      voice_language: version.voice_language,
      updated_at: new Date().toISOString(),
      has_undeployed_changes: true,
    })
    .eq('id', scenarioId)

  if (error) {
    return { error: error.message }
  }

  return deployScenario(scenarioId)
}

/**
 * Update scenario settings (enable_csat, voice, etc.)
 */
export async function updateScenarioSettings(
  scenarioId: string,
  settings: {
    enable_csat?: boolean
    voice_provider?: string | null
    voice_id?: string | null
    voice_language?: string | null
  }
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (settings.enable_csat !== undefined) updates.enable_csat = settings.enable_csat
  const changesVoice =
    'voice_provider' in settings || 'voice_id' in settings || 'voice_language' in settings
  if ('voice_provider' in settings) updates.voice_provider = settings.voice_provider
  if ('voice_id' in settings) updates.voice_id = settings.voice_id
  if ('voice_language' in settings) updates.voice_language = settings.voice_language
  if (changesVoice) updates.has_undeployed_changes = true

  const { error } = await supabase.from('call_scenarios').update(updates).eq('id', scenarioId)

  return { error: error?.message || null }
}
