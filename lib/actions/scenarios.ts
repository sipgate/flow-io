'use server'

import { createClient } from '@/lib/supabase/server'
import { autoAssignPhoneNumberToFlow } from '@/lib/actions/phone-numbers'
import type {
  CallScenario,
  ScenarioNode,
  ScenarioEdge,
  ScenarioSummary,
  ScenarioVersion,
  ScenarioNodeData,
  ScenarioVersionChange,
} from '@/types/scenarios'
import { getScenarioByIdServiceRole as _getScenarioByIdServiceRole } from '@/lib/repositories/scenarios.repository'

type ScenarioVersionSnapshot = {
  version: number
  nodes: ScenarioNode[]
  edges: ScenarioEdge[]
  variables: Record<string, unknown> | null
  voice_provider: string | null
  voice_id: string | null
  voice_language: string | null
  change_summary?: string[] | null
  restored_from_version?: number | null
}

const scenarioVersionChanges: ScenarioVersionChange[] = [
  'initial',
  'assistant',
  'instructions',
  'routing',
  'nodes',
  'voice',
  'settings',
]

const scenarioAssistantFields: Array<keyof ScenarioNodeData> = ['assistant_id']
const scenarioInstructionFields: Array<keyof ScenarioNodeData> = [
  'transfer_instruction',
  'prompt',
  'error_prompt',
]
const scenarioSettingsFields: Array<keyof ScenarioNodeData> = [
  'inherit_voice',
  'send_greeting',
  'timeout_seconds',
  'max_digits',
  'terminator',
  'variable_name',
  'max_retries',
  'target_phone_number',
  'caller_id_name',
  'caller_id_number',
]

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>
    return Object.keys(input)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableValue(input[key])
        return acc
      }, {})
  }
  return value ?? null
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
}

function sortSnapshots<T>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    JSON.stringify(stableValue(a)).localeCompare(JSON.stringify(stableValue(b)))
  )
}

function commonScenarioNodes(
  current: ScenarioNode[],
  previous: ScenarioNode[] | undefined
): { current: ScenarioNode[]; previous: ScenarioNode[] } {
  if (!previous) return { current: [], previous: [] }
  const previousIds = new Set(previous.map((node) => node.id))
  const currentIds = new Set(current.map((node) => node.id))
  const commonIds = new Set([...currentIds].filter((id) => previousIds.has(id)))
  return {
    current: current.filter((node) => commonIds.has(node.id)),
    previous: previous.filter((node) => commonIds.has(node.id)),
  }
}

function nodeDataSnapshot(nodes: ScenarioNode[], fields: Array<keyof ScenarioNodeData>) {
  return sortSnapshots(
    nodes.map((node) => ({
      id: node.id,
      type: node.type ?? null,
      values: fields.reduce<Record<string, unknown>>((acc, field) => {
        acc[field] = node.data?.[field] ?? null
        return acc
      }, {}),
    }))
  )
}

function nodeShapeSnapshot(nodes: ScenarioNode[]) {
  return sortSnapshots(
    nodes.map((node) => ({
      id: node.id,
      type: node.type ?? null,
      label: node.data?.label ?? null,
    }))
  )
}

function edgeRouteSnapshot(edges: ScenarioEdge[]) {
  return sortSnapshots(
    edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      label: edge.label ?? null,
      type: edge.type ?? null,
    }))
  )
}

function scenarioVoiceSnapshot(snapshot: ScenarioVersionSnapshot) {
  return {
    voice_provider: snapshot.voice_provider,
    voice_id: snapshot.voice_id,
    voice_language: snapshot.voice_language,
  }
}

function summarizeScenarioVersionChange(
  current: ScenarioVersionSnapshot,
  previous?: ScenarioVersionSnapshot
): ScenarioVersionChange[] {
  if (!previous) return ['initial']

  const changes: ScenarioVersionChange[] = []
  const commonNodes = commonScenarioNodes(current.nodes, previous.nodes)

  if (
    !sameValue(
      nodeDataSnapshot(commonNodes.current, scenarioAssistantFields),
      nodeDataSnapshot(commonNodes.previous, scenarioAssistantFields)
    )
  ) {
    changes.push('assistant')
  }

  if (
    !sameValue(
      nodeDataSnapshot(commonNodes.current, scenarioInstructionFields),
      nodeDataSnapshot(commonNodes.previous, scenarioInstructionFields)
    )
  ) {
    changes.push('instructions')
  }

  if (!sameValue(edgeRouteSnapshot(current.edges), edgeRouteSnapshot(previous.edges))) {
    changes.push('routing')
  }

  if (!sameValue(nodeShapeSnapshot(current.nodes), nodeShapeSnapshot(previous.nodes))) {
    changes.push('nodes')
  }

  if (!sameValue(scenarioVoiceSnapshot(current), scenarioVoiceSnapshot(previous))) {
    changes.push('voice')
  }

  if (
    !sameValue(
      nodeDataSnapshot(commonNodes.current, scenarioSettingsFields),
      nodeDataSnapshot(commonNodes.previous, scenarioSettingsFields)
    ) ||
    !sameValue(current.variables, previous.variables)
  ) {
    changes.push('settings')
  }

  return changes
}

function toScenarioSnapshot(row: Record<string, unknown>): ScenarioVersionSnapshot {
  return {
    version: typeof row.version === 'number' ? row.version : 0,
    nodes: Array.isArray(row.nodes) ? (row.nodes as ScenarioNode[]) : [],
    edges: Array.isArray(row.edges) ? (row.edges as ScenarioEdge[]) : [],
    variables: (row.variables as Record<string, unknown> | null) ?? null,
    voice_provider: (row.voice_provider as string | null) ?? null,
    voice_id: (row.voice_id as string | null) ?? null,
    voice_language: (row.voice_language as string | null) ?? null,
    change_summary: Array.isArray(row.change_summary) ? (row.change_summary as string[]) : [],
    restored_from_version:
      typeof row.restored_from_version === 'number' ? row.restored_from_version : null,
  }
}

function normalizeScenarioChangeSummary(value: string[] | null | undefined) {
  return (value ?? []).filter((change): change is ScenarioVersionChange =>
    scenarioVersionChanges.includes(change as ScenarioVersionChange)
  )
}

function sameScenarioSnapshot(current: ScenarioVersionSnapshot, previous: ScenarioVersionSnapshot) {
  return (
    sameValue(current.nodes, previous.nodes) &&
    sameValue(current.edges, previous.edges) &&
    sameValue(current.variables, previous.variables) &&
    sameValue(scenarioVoiceSnapshot(current), scenarioVoiceSnapshot(previous))
  )
}

function inferScenarioRestoredFromVersion(
  current: ScenarioVersionSnapshot,
  previousVersions: ScenarioVersionSnapshot[]
) {
  const candidates = previousVersions.filter((version) => version.version < current.version - 1)
  for (const candidate of candidates.reverse()) {
    if (sameScenarioSnapshot(current, candidate)) return candidate.version
  }
  return null
}

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

export async function deployScenario(
  id: string,
  options?: { restoredFromVersion?: number | null }
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
  const currentSnapshot = toScenarioSnapshot({
    version: (rawScenario.version as number) ?? 1,
    nodes: rawScenario.nodes,
    edges: rawScenario.edges,
    variables: rawScenario.variables,
    voice_provider: rawScenario.voice_provider,
    voice_id: rawScenario.voice_id,
    voice_language: rawScenario.voice_language,
  })
  const { data: previousVersions } = await supabase
    .from('call_scenario_versions')
    .select('version, nodes, edges, variables, voice_provider, voice_id, voice_language')
    .eq('scenario_id', id)
    .order('version', { ascending: false })
    .limit(1)
  const previousSnapshot = previousVersions?.[0]
    ? toScenarioSnapshot(previousVersions[0] as unknown as Record<string, unknown>)
    : undefined

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
    created_by: user?.id ?? null,
    change_summary: summarizeScenarioVersionChange(currentSnapshot, previousSnapshot),
    restored_from_version: options?.restoredFromVersion ?? null,
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

export async function revertScenario(id: string): Promise<{
  error: string | null
  nodes?: ScenarioNode[]
  edges?: ScenarioEdge[]
}> {
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

  if (error) {
    return { error: error.message }
  }

  return {
    error: null,
    nodes: latestVersion.nodes as unknown as ScenarioNode[],
    edges: latestVersion.edges as unknown as ScenarioEdge[],
  }
}

export async function getScenarioVersions(
  id: string
): Promise<{ versions: ScenarioVersion[]; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('call_scenario_versions')
    .select(
      'id, version, published_at, created_by, nodes, edges, variables, voice_provider, voice_id, voice_language, change_summary, restored_from_version'
    )
    .eq('scenario_id', id)
    .order('version', { ascending: true })

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
  const snapshots = rows.map(toScenarioSnapshot)
  const versions = rows
    .map((row, index): ScenarioVersion => {
      const snapshot = snapshots[index]
      const storedChangeSummary = normalizeScenarioChangeSummary(snapshot.change_summary)
      return {
        id: row.id as string,
        version: snapshot.version,
        published_at: (row.published_at as string | null) ?? '',
        created_by: (row.created_by as string | null) ?? null,
        restored_from_version:
          snapshot.restored_from_version ??
          inferScenarioRestoredFromVersion(snapshot, snapshots.slice(0, index)),
        change_summary:
          storedChangeSummary.length > 0
            ? storedChangeSummary
            : summarizeScenarioVersionChange(snapshot, snapshots[index - 1]),
      }
    })
    .reverse()

  return { versions, error: error?.message || null }
}

export async function restoreScenarioVersion(
  scenarioId: string,
  versionId: string
): Promise<{ error: string | null; nodes?: ScenarioNode[]; edges?: ScenarioEdge[] }> {
  const supabase = await createClient()

  const { data: version, error: fetchError } = await supabase
    .from('call_scenario_versions')
    .select('version, nodes, edges, voice_provider, voice_id, voice_language')
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

  const deployResult = await deployScenario(scenarioId, {
    restoredFromVersion: (version as unknown as Record<string, unknown>).version as number,
  })
  if (deployResult.error) {
    return deployResult
  }

  return {
    error: null,
    nodes: version.nodes as unknown as ScenarioNode[],
    edges: version.edges as unknown as ScenarioEdge[],
  }
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
