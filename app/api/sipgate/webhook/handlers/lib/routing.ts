import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getScenarioByIdServiceRole } from '@/lib/repositories/scenarios.repository'
import type { ScenarioNode, ScenarioEdge } from '@/types/scenarios'
import type { AssistantConfig, PhoneNumberRouting } from './types'

/**
 * Route incoming call to the correct scenario based on to_phone_number.
 * Every phone number routes through a scenario (single-agent or multi-agent).
 */
export async function routeCallToAssistant(
  toPhoneNumber: string,
  organizationId: string
): Promise<{
  phoneNumber: PhoneNumberRouting
  scenario: {
    id: string
    nodes: ScenarioNode[]
    edges: ScenarioEdge[]
    voice_provider: string | null
    voice_id: string | null
    voice_language: string | null
  }
} | null> {
  const supabase = createServiceRoleClient()

  // Normalize phone number: ensure it starts with +
  const normalizedNumber = toPhoneNumber.startsWith('+') ? toPhoneNumber : `+${toPhoneNumber}`

  const { data: phoneNumber, error } = await supabase
    .from('phone_numbers')
    .select('id, phone_number, scenario_id')
    .eq('phone_number', normalizedNumber)
    .eq('organization_id', organizationId)
    .single()

  if (error || !phoneNumber) {
    console.error('No phone number found:', normalizedNumber, error)
    return null
  }

  const pn = phoneNumber as unknown as PhoneNumberRouting

  const { scenario: callScenario, error: scenarioError } = await getScenarioByIdServiceRole(
    pn.scenario_id,
    { deployment: 'published' }
  )
  if (scenarioError || !callScenario) {
    console.error('Scenario not found for phone number:', pn.scenario_id, scenarioError)
    return null
  }

  return {
    phoneNumber: { id: pn.id, phone_number: pn.phone_number, scenario_id: pn.scenario_id },
    scenario: {
      id: callScenario.id,
      nodes: callScenario.nodes,
      edges: callScenario.edges,
      voice_provider: callScenario.voice_provider,
      voice_id: callScenario.voice_id,
      voice_language: callScenario.voice_language,
    },
  }
}

/**
 * Load an assistant config by ID using service role.
 */
export async function loadAssistantConfig(assistantId: string): Promise<AssistantConfig | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('assistants')
    .select(
      `
      id, name, organization_id, avatar_url,
      voice_provider, voice_id, voice_language,
      llm_provider, llm_model, llm_temperature, thinking_level,
      system_prompt, opening_message, is_active, enable_hesitation, enable_semantic_eot,
      stt_provider, stt_languages
    `
    )
    .eq('id', assistantId)
    .single()
  if (error || !data) return null

  const { data: versions } = await supabase
    .from('assistant_versions')
    .select(
      `
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
    .eq('assistant_id', assistantId)
    .order('version', { ascending: false })
    .limit(1)

  const version = (versions?.[0] as Record<string, unknown> | undefined) ?? null
  if (!version) return data as unknown as AssistantConfig

  return {
    ...(data as unknown as AssistantConfig),
    system_prompt: version.system_prompt as string | null,
    llm_provider: version.llm_provider as string | null,
    llm_model: version.llm_model as string | null,
    llm_temperature: version.llm_temperature as number | null,
    thinking_level: version.thinking_level as string | null,
    voice_provider: version.voice_provider as string | null,
    voice_id: version.voice_id as string | null,
    voice_language: version.voice_language as string | null,
    opening_message: version.opening_message as string | null,
    enable_hesitation: version.enable_hesitation as boolean | null,
    enable_semantic_eot: version.enable_semantic_eot as boolean | null,
    stt_provider: version.stt_provider as string | null,
    stt_languages: version.stt_languages as string[] | null,
  }
}
