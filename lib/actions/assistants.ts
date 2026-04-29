'use server'

import { debug } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { revalidatePath } from 'next/cache'
import { DEFAULT_ELEVENLABS_VOICE_ID } from '@/lib/constants/voices'
import { redirect } from 'next/navigation'
import { createPromptVersion } from './prompt-versions'
import { generateAssistantAvatar } from '@/lib/services/avatar-generator'
import { createScenario, updateScenario } from './scenarios'
import type { ScenarioNode } from '@/types/scenarios'

interface Assistant {
  id: string
  organization_id: string
  name: string
  is_active: boolean
  created_at: string
  [key: string]: unknown
}

export async function getOrganizationAssistants(orgId: string) {
  const supabase = await createClient()

  // Verify user has access to this organization
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { assistants: [] }
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return { assistants: [] }
  }

  // Fetch assistants
  const { data: assistants, error } = await supabase
    .from('assistants')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching assistants:', error)
    return { assistants: [] }
  }

  return { assistants: (assistants as unknown as Assistant[]) || [] }
}

export async function getAssistant(assistantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { assistant: null }
  }

  const { data: assistantData, error } = await supabase
    .from('assistants')
    .select('*')
    .eq('id', assistantId)
    .single()

  if (error || !assistantData) {
    return { assistant: null }
  }

  const assistant = assistantData as unknown as Assistant

  // Verify user has access to this assistant's organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', assistant.organization_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return { assistant: null }
  }

  return { assistant }
}

export interface AssistantScenarioLink {
  scenarioId: string
  scenarioName: string
  phoneNumbers: string[]
}

/**
 * Find all scenarios where this assistant is the entry agent, with their phone numbers.
 */
export async function getAssistantScenarioLinks(
  assistantId: string
): Promise<AssistantScenarioLink[]> {
  const supabase = await createClient()

  const { data: scenarios } = await supabase
    .from('call_scenarios')
    .select('id, name, nodes')
    .not('nodes', 'eq', '[]')

  if (!scenarios) return []

  const matchingScenarioIds: { id: string; name: string }[] = []
  for (const scenario of scenarios) {
    const nodes = scenario.nodes as Array<{ type?: string; data?: { assistant_id?: string } }>
    const hasAssistant = nodes.some(
      (n) =>
        (n.type === 'agent' || n.type === 'entry_agent') && n.data?.assistant_id === assistantId
    )
    if (hasAssistant) {
      matchingScenarioIds.push({ id: scenario.id, name: scenario.name as string })
    }
  }

  if (matchingScenarioIds.length === 0) return []

  const { data: phoneData } = await supabase
    .from('phone_numbers')
    .select('phone_number, scenario_id')
    .in(
      'scenario_id',
      matchingScenarioIds.map((s) => s.id)
    )
    .eq('is_active', true)
    .order('phone_number')

  return matchingScenarioIds.map((s) => ({
    scenarioId: s.id,
    scenarioName: s.name,
    phoneNumbers: (phoneData ?? [])
      .filter((p) => p.scenario_id === s.id)
      .map((p) => p.phone_number),
  }))
}

export interface AssistantWithLinks extends Assistant {
  scenarioLinks: AssistantScenarioLink[]
}

/**
 * List all assistants in an organization with their scenario / phone-number
 * links pre-joined. Avoids the N+1 that calling `getAssistantScenarioLinks`
 * per row would cause.
 */
export async function getOrganizationAssistantsWithLinks(orgId: string): Promise<{
  assistants: AssistantWithLinks[]
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { assistants: [] }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()
  if (!membership) return { assistants: [] }

  const [assistantsResult, scenariosResult] = await Promise.all([
    supabase
      .from('assistants')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('call_scenarios')
      .select('id, name, nodes')
      .eq('organization_id', orgId)
      .not('nodes', 'eq', '[]'),
  ])

  const assistants = (assistantsResult.data ?? []) as unknown as Assistant[]
  if (assistants.length === 0) return { assistants: [] }

  const scenarios =
    (scenariosResult.data ?? []) as Array<{ id: string; name: string; nodes: unknown }>

  // assistantId → array of { scenarioId, scenarioName }
  const scenarioByAssistant = new Map<string, Array<{ scenarioId: string; scenarioName: string }>>()
  const matchingScenarioIds = new Set<string>()
  for (const sc of scenarios) {
    const nodes = Array.isArray(sc.nodes)
      ? (sc.nodes as Array<{ type?: string; data?: { assistant_id?: string } }>)
      : []
    const seen = new Set<string>()
    for (const n of nodes) {
      const aid = n?.data?.assistant_id
      if (!aid) continue
      if (n.type !== 'agent' && n.type !== 'entry_agent') continue
      if (seen.has(aid)) continue
      seen.add(aid)
      const existing = scenarioByAssistant.get(aid) ?? []
      existing.push({ scenarioId: sc.id, scenarioName: sc.name })
      scenarioByAssistant.set(aid, existing)
      matchingScenarioIds.add(sc.id)
    }
  }

  // Single phone-number lookup for every matching scenario.
  const phonesByScenario = new Map<string, string[]>()
  if (matchingScenarioIds.size > 0) {
    const { data: phoneRows } = await supabase
      .from('phone_numbers')
      .select('phone_number, scenario_id')
      .in('scenario_id', Array.from(matchingScenarioIds))
      .eq('is_active', true)
      .order('phone_number')
    for (const p of phoneRows ?? []) {
      const sid = p.scenario_id as string
      const list = phonesByScenario.get(sid) ?? []
      list.push(p.phone_number as string)
      phonesByScenario.set(sid, list)
    }
  }

  return {
    assistants: assistants.map((a) => {
      const links = scenarioByAssistant.get(a.id) ?? []
      return {
        ...a,
        scenarioLinks: links.map((l) => ({
          scenarioId: l.scenarioId,
          scenarioName: l.scenarioName,
          phoneNumbers: phonesByScenario.get(l.scenarioId) ?? [],
        })),
      }
    }),
  }
}

export async function createAssistant(
  orgId: string,
  data: {
    name: string
    description?: string
    voice_provider?: string
    voice_id?: string
    voice_language?: string
    llm_provider?: string
    llm_model?: string
    llm_temperature?: number
    thinking_level?: string | null
    system_prompt?: string
    opening_message?: string
    is_active?: boolean
    enable_hesitation?: boolean
    barge_in_strategy?: string
    barge_in_allow_after_ms?: number
    barge_in_minimum_characters?: number
    create_scenario?: boolean
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify user has permission (owner/admin)
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'You do not have permission to create assistants' }
  }

  const { data: assistant, error } = await supabase
    .from('assistants')
    .insert({
      organization_id: orgId,
      name: data.name,
      description: data.description || null,
      voice_provider: data.voice_provider || 'elevenlabs',
      voice_id: data.voice_id || DEFAULT_ELEVENLABS_VOICE_ID,
      voice_language: data.voice_language || null,
      llm_provider: data.llm_provider || 'google',
      llm_model: data.llm_model || 'gemini-2.5-flash',
      llm_temperature: data.llm_temperature ?? 0.0,
      thinking_level: data.thinking_level || 'minimal',
      system_prompt: data.system_prompt || null,
      opening_message: data.opening_message || null,
      is_active: data.is_active ?? true,
      enable_hesitation: data.enable_hesitation ?? false,
    })
    .select()
    .single()

  if (error || !assistant) {
    console.error('Error creating assistant:', error)
    return { error: error?.message || 'Failed to create assistant' }
  }

  const typedAssistant = assistant as unknown as Assistant

  // Generate avatar in background (don't await to not block the response)
  generateAssistantAvatar(data.name, data.description)
    .then(async ({ url, error: avatarError }) => {
      if (url) {
        const serviceClient = createServiceRoleClient()
        await serviceClient
          .from('assistants')
          .update({ avatar_url: url })
          .eq('id', typedAssistant.id)
        debug('[Assistant] Avatar generated for:', data.name)
      } else if (avatarError) {
        console.warn('Could not generate avatar:', avatarError)
      }
    })
    .catch((err) => {
      console.warn('Avatar generation failed:', err)
    })

  // Auto-create a scenario with this assistant as the entry agent
  let scenarioId: string | null = null
  if (data.create_scenario) {
    try {
      const scenarioResult = await createScenario(orgId, {
        name: data.name,
        description: data.description,
        skipPhoneNumberCheck: true,
      })
      if (scenarioResult.error) {
        console.warn(
          '[createAssistant] Auto scenario creation returned error:',
          scenarioResult.error
        )
      }
      if (scenarioResult.scenario) {
        scenarioId = scenarioResult.scenario.id
        const entryNode: ScenarioNode = {
          id: crypto.randomUUID(),
          type: 'entry_agent',
          position: { x: 300, y: 200 },
          data: {
            assistant_id: typedAssistant.id,
            label: data.name,
            avatar_url: null,
            transfer_instruction: '',
            inherit_voice: false,
            send_greeting: true,
          },
        }
        await updateScenario(scenarioResult.scenario.id, [entryNode], [])
      }
    } catch (err) {
      console.warn('[createAssistant] Auto scenario creation failed:', err)
    }
  }

  revalidatePath('/', 'layout')
  return { assistant: typedAssistant, scenarioId }
}

export async function updateAssistant(
  assistantId: string,
  data: {
    name?: string
    description?: string
    voice_provider?: string
    voice_id?: string
    voice_language?: string
    llm_provider?: string
    llm_model?: string
    llm_temperature?: number
    system_prompt?: string
    opening_message?: string
    is_active?: boolean
    enable_hesitation?: boolean
    enable_semantic_eot?: boolean
    thinking_level?: string | null
    stt_provider?: string | null
    stt_languages?: string[] | null
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get assistant to verify organization and check current prompt
  const { data: assistant } = await supabase
    .from('assistants')
    .select(
      `
      organization_id,
      system_prompt,
      llm_provider,
      llm_model,
      llm_temperature,
      thinking_level,
      voice_provider,
      voice_id,
      voice_language,
      opening_message,
      enable_hesitation,
      enable_semantic_eot,
      stt_provider,
      stt_languages
    `
    )
    .eq('id', assistantId)
    .single()

  if (!assistant) {
    return { error: 'Assistant not found' }
  }

  const previousAssistant = assistant as Record<string, unknown>
  const previousPrompt = previousAssistant.system_prompt

  // Verify user has permission
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', assistant.organization_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'You do not have permission to update this assistant' }
  }

  const deploymentFields = [
    'system_prompt',
    'llm_provider',
    'llm_model',
    'llm_temperature',
    'thinking_level',
    'voice_provider',
    'voice_id',
    'voice_language',
    'opening_message',
    'enable_hesitation',
    'enable_semantic_eot',
    'stt_provider',
    'stt_languages',
  ] as const

  const updatePayload: Record<string, unknown> = {
    ...data,
    updated_at: new Date().toISOString(),
  }
  const incoming = data as Record<string, unknown>
  const hasDeploymentChanges = deploymentFields.some((field) => {
    if (!(field in incoming)) return false
    return (
      JSON.stringify(incoming[field] ?? null) !== JSON.stringify(previousAssistant[field] ?? null)
    )
  })
  if (hasDeploymentChanges) {
    updatePayload.has_undeployed_changes = true
  }

  const { error } = await supabase.from('assistants').update(updatePayload).eq('id', assistantId)

  if (error) {
    console.error('Error updating assistant:', error)
    return { error: error.message }
  }

  // If system_prompt changed, save a new version and reset test results
  if (data.system_prompt !== undefined && data.system_prompt !== previousPrompt) {
    // Save the new prompt as a version
    await createPromptVersion(
      assistantId,
      previousAssistant.organization_id as string,
      data.system_prompt
    )

    // Reset all test results - old results are no longer valid with the new prompt
    const { error: deleteError } = await supabase
      .from('test_runs')
      .delete()
      .eq('assistant_id', assistantId)

    if (deleteError) {
      console.error('Error resetting test runs after prompt change:', deleteError)
      // Don't fail the operation, assistant was already updated
    }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export interface AssistantVersion {
  id: string
  version: number
  deployed_at: string
  created_by: string | null
  restored_from_version: number | null
  change_summary: AssistantVersionChange[]
}

export type AssistantVersionChange =
  | 'initial'
  | 'instructions'
  | 'model'
  | 'voice'
  | 'opening_message'
  | 'turn_taking'
  | 'transcription'

type AssistantVersionSnapshot = {
  version: number
  system_prompt: string | null
  llm_provider: string | null
  llm_model: string | null
  llm_temperature: number | null
  thinking_level: string | null
  voice_provider: string | null
  voice_id: string | null
  voice_language: string | null
  opening_message: string | null
  enable_hesitation: boolean | null
  enable_semantic_eot: boolean | null
  stt_provider: string | null
  stt_languages: string[] | null
  restored_from_version?: number | null
  change_summary?: string[] | null
}

const assistantVersionChanges: AssistantVersionChange[] = [
  'initial',
  'instructions',
  'model',
  'voice',
  'opening_message',
  'turn_taking',
  'transcription',
]

function stableAssistantValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableAssistantValue)
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>
    return Object.keys(input)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableAssistantValue(input[key])
        return acc
      }, {})
  }
  return value ?? null
}

function sameAssistantValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableAssistantValue(left)) === JSON.stringify(stableAssistantValue(right))
}

function toAssistantSnapshot(row: Record<string, unknown>): AssistantVersionSnapshot {
  return {
    version: typeof row.version === 'number' ? row.version : 0,
    system_prompt: (row.system_prompt as string | null) ?? null,
    llm_provider: (row.llm_provider as string | null) ?? null,
    llm_model: (row.llm_model as string | null) ?? null,
    llm_temperature: (row.llm_temperature as number | null) ?? null,
    thinking_level: (row.thinking_level as string | null) ?? null,
    voice_provider: (row.voice_provider as string | null) ?? null,
    voice_id: (row.voice_id as string | null) ?? null,
    voice_language: (row.voice_language as string | null) ?? null,
    opening_message: (row.opening_message as string | null) ?? null,
    enable_hesitation: (row.enable_hesitation as boolean | null) ?? null,
    enable_semantic_eot: (row.enable_semantic_eot as boolean | null) ?? null,
    stt_provider: (row.stt_provider as string | null) ?? null,
    stt_languages: Array.isArray(row.stt_languages) ? (row.stt_languages as string[]) : null,
    restored_from_version:
      typeof row.restored_from_version === 'number' ? row.restored_from_version : null,
    change_summary: Array.isArray(row.change_summary) ? (row.change_summary as string[]) : [],
  }
}

function summarizeAssistantVersionChange(
  current: AssistantVersionSnapshot,
  previous?: AssistantVersionSnapshot
): AssistantVersionChange[] {
  if (!previous) return ['initial']

  const changes: AssistantVersionChange[] = []
  if (!sameAssistantValue(current.system_prompt, previous.system_prompt)) {
    changes.push('instructions')
  }
  if (
    !sameAssistantValue(
      {
        llm_provider: current.llm_provider,
        llm_model: current.llm_model,
        llm_temperature: current.llm_temperature,
        thinking_level: current.thinking_level,
      },
      {
        llm_provider: previous.llm_provider,
        llm_model: previous.llm_model,
        llm_temperature: previous.llm_temperature,
        thinking_level: previous.thinking_level,
      }
    )
  ) {
    changes.push('model')
  }
  if (
    !sameAssistantValue(
      {
        voice_provider: current.voice_provider,
        voice_id: current.voice_id,
        voice_language: current.voice_language,
      },
      {
        voice_provider: previous.voice_provider,
        voice_id: previous.voice_id,
        voice_language: previous.voice_language,
      }
    )
  ) {
    changes.push('voice')
  }
  if (!sameAssistantValue(current.opening_message, previous.opening_message)) {
    changes.push('opening_message')
  }
  if (
    !sameAssistantValue(
      {
        enable_hesitation: current.enable_hesitation,
        enable_semantic_eot: current.enable_semantic_eot,
      },
      {
        enable_hesitation: previous.enable_hesitation,
        enable_semantic_eot: previous.enable_semantic_eot,
      }
    )
  ) {
    changes.push('turn_taking')
  }
  if (
    !sameAssistantValue(
      { stt_provider: current.stt_provider, stt_languages: current.stt_languages },
      { stt_provider: previous.stt_provider, stt_languages: previous.stt_languages }
    )
  ) {
    changes.push('transcription')
  }
  return changes
}

function normalizeAssistantChangeSummary(value: string[] | null | undefined) {
  return (value ?? []).filter((change): change is AssistantVersionChange =>
    assistantVersionChanges.includes(change as AssistantVersionChange)
  )
}

function sameAssistantSnapshot(current: AssistantVersionSnapshot, previous: AssistantVersionSnapshot) {
  return sameAssistantValue(
    {
      system_prompt: current.system_prompt,
      llm_provider: current.llm_provider,
      llm_model: current.llm_model,
      llm_temperature: current.llm_temperature,
      thinking_level: current.thinking_level,
      voice_provider: current.voice_provider,
      voice_id: current.voice_id,
      voice_language: current.voice_language,
      opening_message: current.opening_message,
      enable_hesitation: current.enable_hesitation,
      enable_semantic_eot: current.enable_semantic_eot,
      stt_provider: current.stt_provider,
      stt_languages: current.stt_languages,
    },
    {
      system_prompt: previous.system_prompt,
      llm_provider: previous.llm_provider,
      llm_model: previous.llm_model,
      llm_temperature: previous.llm_temperature,
      thinking_level: previous.thinking_level,
      voice_provider: previous.voice_provider,
      voice_id: previous.voice_id,
      voice_language: previous.voice_language,
      opening_message: previous.opening_message,
      enable_hesitation: previous.enable_hesitation,
      enable_semantic_eot: previous.enable_semantic_eot,
      stt_provider: previous.stt_provider,
      stt_languages: previous.stt_languages,
    }
  )
}

function inferAssistantRestoredFromVersion(
  current: AssistantVersionSnapshot,
  previousVersions: AssistantVersionSnapshot[]
) {
  const candidates = previousVersions.filter((version) => version.version < current.version - 1)
  for (const candidate of candidates.reverse()) {
    if (sameAssistantSnapshot(current, candidate)) return candidate.version
  }
  return null
}

export async function deployAssistant(
  id: string,
  options?: { restoredFromVersion?: number | null }
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: assistant, error: fetchError } = await supabase
    .from('assistants')
    .select(
      'system_prompt, llm_provider, llm_model, llm_temperature, thinking_level, voice_provider, voice_id, voice_language, opening_message, enable_hesitation, enable_semantic_eot, stt_provider, stt_languages, deployed_version'
    )
    .eq('id', id)
    .single()

  if (fetchError || !assistant) return { error: fetchError?.message || 'Assistant not found' }

  const raw = assistant as unknown as Record<string, unknown>
  const newVersion = ((raw.deployed_version as number) ?? 0) + 1
  const now = new Date().toISOString()
  const currentSnapshot = toAssistantSnapshot({ ...raw, version: newVersion })
  const { data: previousVersions } = await supabase
    .from('assistant_versions')
    .select(
      'version, system_prompt, llm_provider, llm_model, llm_temperature, thinking_level, voice_provider, voice_id, voice_language, opening_message, enable_hesitation, enable_semantic_eot, stt_provider, stt_languages'
    )
    .eq('assistant_id', id)
    .order('version', { ascending: false })
    .limit(1)
  const previousSnapshot = previousVersions?.[0]
    ? toAssistantSnapshot(previousVersions[0] as unknown as Record<string, unknown>)
    : undefined

  const { error: versionError } = await supabase.from('assistant_versions').insert({
    assistant_id: id,
    version: newVersion,
    system_prompt: raw.system_prompt as string | null,
    llm_provider: raw.llm_provider as string | null,
    llm_model: raw.llm_model as string | null,
    llm_temperature: raw.llm_temperature as number | null,
    thinking_level: raw.thinking_level as string | null,
    voice_provider: raw.voice_provider as string | null,
    voice_id: raw.voice_id as string | null,
    voice_language: raw.voice_language as string | null,
    opening_message: raw.opening_message as string | null,
    enable_hesitation: raw.enable_hesitation as boolean | null,
    enable_semantic_eot: raw.enable_semantic_eot as boolean | null,
    stt_provider: raw.stt_provider as string | null,
    stt_languages: raw.stt_languages as string[] | null,
    deployed_at: now,
    created_by: user.id,
    change_summary: summarizeAssistantVersionChange(currentSnapshot, previousSnapshot),
    restored_from_version: options?.restoredFromVersion ?? null,
  })
  if (versionError) return { error: versionError.message }

  const { error } = await supabase
    .from('assistants')
    .update({
      deployed_at: now,
      deployed_version: newVersion,
      updated_at: now,
      has_undeployed_changes: false,
    })
    .eq('id', id)

  revalidatePath('/', 'layout')
  return { error: error?.message || null }
}

export async function revertAssistant(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: latestVersion, error: fetchError } = await supabase
    .from('assistant_versions')
    .select(
      'system_prompt, llm_provider, llm_model, llm_temperature, thinking_level, voice_provider, voice_id, voice_language, opening_message, enable_hesitation, enable_semantic_eot, stt_provider, stt_languages'
    )
    .eq('assistant_id', id)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (fetchError || !latestVersion)
    return { error: fetchError?.message || 'No deployed version found' }

  const v = latestVersion as unknown as Record<string, unknown>
  const result = await updateAssistant(id, {
    system_prompt: v.system_prompt as string | undefined,
    llm_provider: v.llm_provider as string | undefined,
    llm_model: v.llm_model as string | undefined,
    llm_temperature: v.llm_temperature as number | undefined,
    thinking_level: v.thinking_level as string | null | undefined,
    voice_provider: v.voice_provider as string | undefined,
    voice_id: v.voice_id as string | undefined,
    voice_language: v.voice_language as string | undefined,
    opening_message: v.opening_message as string | undefined,
    enable_hesitation: v.enable_hesitation as boolean | undefined,
    enable_semantic_eot: v.enable_semantic_eot as boolean | undefined,
    stt_provider: v.stt_provider as string | null | undefined,
    stt_languages: v.stt_languages as string[] | null | undefined,
  })
  if ('error' in result && result.error) return { error: result.error }
  // Reverting restores deployed state — clear the undeployed flag
  await supabase.from('assistants').update({ has_undeployed_changes: false }).eq('id', id)
  return { error: null }
}

export async function getAssistantVersions(
  id: string
): Promise<{ versions: AssistantVersion[]; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('assistant_versions')
    .select(
      'id, version, deployed_at, created_by, system_prompt, llm_provider, llm_model, llm_temperature, thinking_level, voice_provider, voice_id, voice_language, opening_message, enable_hesitation, enable_semantic_eot, stt_provider, stt_languages, change_summary, restored_from_version'
    )
    .eq('assistant_id', id)
    .order('version', { ascending: true })

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
  const snapshots = rows.map(toAssistantSnapshot)
  const versions = rows
    .map((row, index): AssistantVersion => {
      const snapshot = snapshots[index]
      const storedChangeSummary = normalizeAssistantChangeSummary(snapshot.change_summary)
      return {
        id: row.id as string,
        version: snapshot.version,
        deployed_at: (row.deployed_at as string | null) ?? '',
        created_by: (row.created_by as string | null) ?? null,
        restored_from_version:
          snapshot.restored_from_version ??
          inferAssistantRestoredFromVersion(snapshot, snapshots.slice(0, index)),
        change_summary:
          storedChangeSummary.length > 0
            ? storedChangeSummary
            : summarizeAssistantVersionChange(snapshot, snapshots[index - 1]),
      }
    })
    .reverse()

  return { versions, error: error?.message || null }
}

export async function restoreAssistantVersion(
  assistantId: string,
  versionId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: version, error: fetchError } = await supabase
    .from('assistant_versions')
    .select(
      'version, system_prompt, llm_provider, llm_model, llm_temperature, thinking_level, voice_provider, voice_id, voice_language, opening_message, enable_hesitation, enable_semantic_eot, stt_provider, stt_languages'
    )
    .eq('id', versionId)
    .single()

  if (fetchError || !version) return { error: fetchError?.message || 'Version not found' }

  const v = version as unknown as Record<string, unknown>
  const result = await updateAssistant(assistantId, {
    system_prompt: v.system_prompt as string | undefined,
    llm_provider: v.llm_provider as string | undefined,
    llm_model: v.llm_model as string | undefined,
    llm_temperature: v.llm_temperature as number | undefined,
    thinking_level: v.thinking_level as string | null | undefined,
    voice_provider: v.voice_provider as string | undefined,
    voice_id: v.voice_id as string | undefined,
    voice_language: v.voice_language as string | undefined,
    opening_message: v.opening_message as string | undefined,
    enable_hesitation: v.enable_hesitation as boolean | undefined,
    enable_semantic_eot: v.enable_semantic_eot as boolean | undefined,
    stt_provider: v.stt_provider as string | null | undefined,
    stt_languages: v.stt_languages as string[] | null | undefined,
  })
  if ('error' in result && result.error) return { error: result.error }
  return deployAssistant(assistantId, {
    restoredFromVersion: (version as unknown as Record<string, unknown>).version as number,
  })
}

export async function deleteAssistant(assistantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get assistant to verify organization
  const { data: assistant } = await supabase
    .from('assistants')
    .select('organization_id')
    .eq('id', assistantId)
    .single()

  if (!assistant) {
    return { error: 'Assistant not found' }
  }

  // Verify user has permission
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', assistant.organization_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'You do not have permission to delete this assistant' }
  }

  const { error } = await supabase.from('assistants').delete().eq('id', assistantId)

  if (error) {
    console.error('Error deleting assistant:', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assistant Overview (single-page summary used by `/[orgSlug]/agents/[id]`)
// ─────────────────────────────────────────────────────────────────────────────

export interface AssistantOverviewLink {
  id: string
  name: string
}

export interface AssistantOverviewStats {
  totalCalls30d: number
  completedCalls30d: number
  failedCalls30d: number
  successRate: number | null
  avgDurationSeconds: number
  avgCsat: number | null
  csatCount: number
}

export interface AssistantOverviewRecentCall {
  id: string
  caller_number: string | null
  started_at: string | null
  duration_seconds: number | null
  csat_score: number | null
  status: string
}

export interface AssistantOverview {
  scenarioLinks: AssistantScenarioLink[]
  stats: AssistantOverviewStats
  latestVersion: { version: number } | null
  knowledgeBases: AssistantOverviewLink[]
  mcpServers: AssistantOverviewLink[]
  webhookTools: AssistantOverviewLink[]
  variableCount: number
  callToolsEnabled: number
  contextWebhook: { active: boolean } | null
  variableWebhook: { active: boolean } | null
  phonemeSetsCount: number
  recentCalls: AssistantOverviewRecentCall[]
}

const EMPTY_OVERVIEW: AssistantOverview = {
  scenarioLinks: [],
  stats: {
    totalCalls30d: 0,
    completedCalls30d: 0,
    failedCalls30d: 0,
    successRate: null,
    avgDurationSeconds: 0,
    avgCsat: null,
    csatCount: 0,
  },
  latestVersion: null,
  knowledgeBases: [],
  mcpServers: [],
  webhookTools: [],
  variableCount: 0,
  callToolsEnabled: 0,
  contextWebhook: null,
  variableWebhook: null,
  phonemeSetsCount: 0,
  recentCalls: [],
}

export async function getAssistantOverview(assistantId: string): Promise<AssistantOverview> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return EMPTY_OVERVIEW

  // Confirm membership + get organization_id once.
  const { data: assistantRow } = await supabase
    .from('assistants')
    .select('id, organization_id')
    .eq('id', assistantId)
    .single()
  if (!assistantRow) return EMPTY_OVERVIEW

  const { data: membership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', assistantRow.organization_id)
    .eq('user_id', user.id)
    .single()
  if (!membership) return EMPTY_OVERVIEW

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    scenarioLinks,
    callsResult,
    latestVersionResult,
    kbResult,
    mcpResult,
    webhookToolsResult,
    variableDefsResult,
    callToolConfigResult,
    contextWebhookResult,
    variableWebhookResult,
    phonemeSetsCountResult,
    recentCallsResult,
  ] = await Promise.all([
    getAssistantScenarioLinks(assistantId),
    supabase
      .from('call_sessions')
      .select('status, duration_seconds, csat_score')
      .eq('assistant_id', assistantId)
      .gte('started_at', since30d),
    supabase
      .from('assistant_versions')
      .select('version')
      .eq('assistant_id', assistantId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('assistant_knowledge_bases')
      .select('knowledge_bases(id, name)')
      .eq('assistant_id', assistantId),
    supabase
      .from('assistant_mcp_servers')
      .select('mcp_servers(id, name)')
      .eq('assistant_id', assistantId),
    supabase
      .from('assistant_webhook_tools')
      .select('webhook_tools(id, name)')
      .eq('assistant_id', assistantId),
    supabase
      .from('variable_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('assistant_id', assistantId),
    supabase
      .from('call_tool_configs')
      .select('hangup_enabled, forward_enabled, note_enabled')
      .eq('assistant_id', assistantId)
      .maybeSingle(),
    supabase
      .from('context_webhooks')
      .select('enabled')
      .eq('assistant_id', assistantId)
      .maybeSingle(),
    supabase
      .from('variable_webhooks')
      .select('enabled')
      .eq('assistant_id', assistantId),
    supabase
      .from('assistant_phoneme_sets')
      .select('id', { count: 'exact', head: true })
      .eq('assistant_id', assistantId),
    supabase
      .from('call_sessions')
      .select('id, caller_number, started_at, duration_seconds, csat_score, status')
      .eq('assistant_id', assistantId)
      .order('started_at', { ascending: false })
      .limit(5),
  ])

  const calls = callsResult.data ?? []
  const totalCalls30d = calls.length
  const completedCalls30d = calls.filter((c) => c.status === 'completed').length
  const failedCalls30d = calls.filter((c) => c.status === 'failed').length
  const decidedCalls = completedCalls30d + failedCalls30d
  const successRate =
    decidedCalls > 0 ? Math.round((completedCalls30d / decidedCalls) * 100) : null

  const durationsSum = calls.reduce(
    (sum, c) => sum + (typeof c.duration_seconds === 'number' ? c.duration_seconds : 0),
    0,
  )
  const avgDurationSeconds = totalCalls30d > 0 ? Math.round(durationsSum / totalCalls30d) : 0

  const csatValues = calls
    .map((c) => c.csat_score)
    .filter((v): v is number => typeof v === 'number')
  const csatCount = csatValues.length
  const avgCsat = csatCount > 0 ? csatValues.reduce((sum, v) => sum + v, 0) / csatCount : null

  // Junction-table joins return the related row nested under the FK target's
  // table name. Narrow at the boundary — Supabase types these as `unknown[]`.
  const flattenLinks = (rows: unknown, key: string): AssistantOverviewLink[] => {
    if (!Array.isArray(rows)) return []
    const links: AssistantOverviewLink[] = []
    for (const row of rows as Array<Record<string, unknown>>) {
      const target = row[key]
      if (target && typeof target === 'object') {
        const t = target as { id?: unknown; name?: unknown }
        if (typeof t.id === 'string' && typeof t.name === 'string') {
          links.push({ id: t.id, name: t.name })
        }
      }
    }
    return links
  }

  const callToolConfig = callToolConfigResult.data as
    | {
        hangup_enabled: boolean | null
        forward_enabled: boolean | null
        note_enabled: boolean | null
      }
    | null
  const callToolsEnabled = callToolConfig
    ? [
        callToolConfig.hangup_enabled,
        callToolConfig.forward_enabled,
        callToolConfig.note_enabled,
      ].filter(Boolean).length
    : 0

  const variableWebhookRows = (variableWebhookResult.data ?? []) as Array<{ enabled: boolean | null }>
  const variableWebhook =
    variableWebhookRows.length > 0
      ? { active: variableWebhookRows.some((r) => r.enabled === true) }
      : null

  const contextWebhookRow = contextWebhookResult.data as { enabled: boolean | null } | null
  const contextWebhook = contextWebhookRow ? { active: contextWebhookRow.enabled === true } : null

  const recentCalls: AssistantOverviewRecentCall[] = (recentCallsResult.data ?? []).map((c) => ({
    id: c.id as string,
    caller_number: (c.caller_number as string | null) ?? null,
    started_at: (c.started_at as string | null) ?? null,
    duration_seconds: (c.duration_seconds as number | null) ?? null,
    csat_score: (c.csat_score as number | null) ?? null,
    status: (c.status as string | null) ?? 'unknown',
  }))

  return {
    scenarioLinks,
    stats: {
      totalCalls30d,
      completedCalls30d,
      failedCalls30d,
      successRate,
      avgDurationSeconds,
      avgCsat,
      csatCount,
    },
    latestVersion: latestVersionResult.data
      ? { version: (latestVersionResult.data as { version: number }).version }
      : null,
    knowledgeBases: flattenLinks(kbResult.data, 'knowledge_bases'),
    mcpServers: flattenLinks(mcpResult.data, 'mcp_servers'),
    webhookTools: flattenLinks(webhookToolsResult.data, 'webhook_tools'),
    variableCount: variableDefsResult.count ?? 0,
    callToolsEnabled,
    contextWebhook,
    variableWebhook,
    phonemeSetsCount: phonemeSetsCountResult.count ?? 0,
    recentCalls,
  }
}
