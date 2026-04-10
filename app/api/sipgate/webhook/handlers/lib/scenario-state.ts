import { debug } from '@/lib/utils/logger'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getScenarioByIdServiceRole } from '@/lib/repositories/scenarios.repository'
import { generateLLMResponse } from '@/lib/services/llm-conversation'
import { sessionState } from '@/lib/services/session-state'
import type { ScenarioSessionState } from '@/lib/services/session-state'
import type { ScenarioNode } from '@/types/scenarios'
import type { CallSessionWithAssistant, AssistantConfig } from './types'
import { loadAssistantConfig } from './routing'

/**
 * Generate a contextual greeting from the new agent after a scenario transfer.
 * Returns the greeting text, or null if send_greeting is disabled or generation fails.
 */
export async function generateScenarioGreeting(
  targetNode: ScenarioNode,
  organizationId: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  handoffMessage: string,
  sessionId: string,
): Promise<string | null> {
  if (!targetNode.data.send_greeting || !targetNode.data.assistant_id) return null
  try {
    const result = await generateLLMResponse({
      assistantId: targetNode.data.assistant_id,
      organizationId,
      conversationHistory: [
        ...conversationHistory,
        { role: 'assistant', content: handoffMessage },
        { role: 'user', content: '[Transfer complete. Greet the caller briefly and offer your help.]' },
      ],
      sessionId,
      disableHesitation: true,
    })
    return result.response || null
  } catch {
    return null
  }
}

/** Persist active node ID to DB so it survives across serverless instances */
export async function persistActiveNodeId(sipgateSessionId: string, activeNodeId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data: current } = await supabase
    .from('call_sessions')
    .select('metadata')
    .eq('session_id', sipgateSessionId)
    .single()
  await supabase
    .from('call_sessions')
    .update({
      metadata: {
        ...(current?.metadata as Record<string, unknown> ?? {}),
        scenario_active_node_id: activeNodeId,
      },
    })
    .eq('session_id', sipgateSessionId)
}

/** Rebuild scenarioState from DB when in-memory state is lost (e.g. different serverless instance) */
export async function rebuildScenarioState(
  session: CallSessionWithAssistant,
  sipgateSessionId: string
): Promise<ScenarioSessionState | null> {
  if (!session.scenario_id) return null
  const { scenario } = await getScenarioByIdServiceRole(session.scenario_id)
  if (!scenario) return null
  const entryNode = scenario.nodes.find((n) => n.type === 'entry_agent')
  if (!entryNode?.data.assistant_id) return null
  const entryAssistant: AssistantConfig | null = await loadAssistantConfig(entryNode.data.assistant_id)
  if (!entryAssistant) return null
  const activeNodeId = (session.metadata?.scenario_active_node_id as string | undefined) ?? entryNode.id
  const state: ScenarioSessionState = {
    scenarioId: scenario.id,
    activeNodeId,
    entryNodeId: entryNode.id,
    entryVoiceConfig: {
      voice_provider: entryAssistant.voice_provider,
      voice_id: entryAssistant.voice_id,
      voice_language: entryAssistant.voice_language,
    },
    nodes: scenario.nodes,
    edges: scenario.edges,
  }
  sessionState.setScenarioState(sipgateSessionId, state)
  debug(`[ScenarioState] Rebuilt from DB: scenarioId=${scenario.id} activeNodeId=${activeNodeId}`)
  return state
}
