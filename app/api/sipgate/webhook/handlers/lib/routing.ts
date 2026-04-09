import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getScenarioByIdServiceRole } from '@/lib/repositories/scenarios.repository'
import type { ScenarioNode, ScenarioEdge } from '@/types/scenarios'
import type { AssistantConfig, PhoneNumberRouting } from './types'

/**
 * Route incoming call to the correct assistant/scenario based on to_phone_number.
 * Returns assistant if phone number is assigned directly, or scenario data for scenario routing.
 */
export async function routeCallToAssistant(toPhoneNumber: string, organizationId: string): Promise<{
  phoneNumber: PhoneNumberRouting
  assistant: AssistantConfig | null
  scenario: { id: string; nodes: ScenarioNode[]; edges: ScenarioEdge[] } | null
} | null> {
  const supabase = createServiceRoleClient()

  // Normalize phone number: ensure it starts with +
  const normalizedNumber = toPhoneNumber.startsWith('+')
    ? toPhoneNumber
    : `+${toPhoneNumber}`

  const { data: phoneNumber, error } = await supabase
    .from('phone_numbers')
    .select(
      `
      id,
      phone_number,
      assistant_id,
      scenario_id,
      assistants (
        id,
        name,
        organization_id,
        voice_provider,
        voice_id,
        voice_language,
        llm_provider,
        llm_model,
        llm_temperature,
        system_prompt,
        opening_message,
        is_active
      )
    `
    )
    .eq('phone_number', normalizedNumber)
    .eq('organization_id', organizationId)
    .single()

  if (error || !phoneNumber) {
    console.error('No phone number found:', normalizedNumber, error)
    return null
  }

  const pn = phoneNumber as unknown as PhoneNumberRouting & {
    assistants: AssistantConfig | null
  }

  // Scenario routing takes precedence over direct assistant assignment
  if (pn.scenario_id) {
    const { scenario: callScenario, error: scenarioError } = await getScenarioByIdServiceRole(pn.scenario_id)
    if (scenarioError || !callScenario) {
      console.error('Scenario not found for phone number:', pn.scenario_id, scenarioError)
      return null
    }
    return {
      phoneNumber: { id: pn.id, phone_number: pn.phone_number, assistant_id: null, scenario_id: pn.scenario_id },
      assistant: null,
      scenario: { id: callScenario.id, nodes: callScenario.nodes, edges: callScenario.edges },
    }
  }

  // Direct assistant routing
  if (!pn.assistant_id || !pn.assistants) {
    console.error('No assistant or scenario assigned to number:', normalizedNumber)
    return null
  }

  return {
    phoneNumber: { id: pn.id, phone_number: pn.phone_number, assistant_id: pn.assistant_id, scenario_id: null },
    assistant: pn.assistants,
    scenario: null,
  }
}

/**
 * Load an assistant config by ID using service role.
 */
export async function loadAssistantConfig(assistantId: string): Promise<AssistantConfig | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('assistants')
    .select(`
      id, name, organization_id,
      voice_provider, voice_id, voice_language,
      llm_provider, llm_model, llm_temperature,
      system_prompt, opening_message, is_active
    `)
    .eq('id', assistantId)
    .single()
  if (error || !data) return null
  return data as unknown as AssistantConfig
}
