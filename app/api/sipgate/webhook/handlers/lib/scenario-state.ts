import { debug } from '@/lib/utils/logger'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getScenarioByIdServiceRole } from '@/lib/repositories/scenarios.repository'
import { generateLLMResponse } from '@/lib/services/llm-conversation'
import { sessionState } from '@/lib/services/session-state'
import type { ScenarioSessionState } from '@/lib/services/session-state'
import type { ScenarioNode, ScenarioEdge } from '@/types/scenarios'
import type { CallSessionWithAssistant } from './types'
import { DEFAULT_ELEVENLABS_VOICE_ID } from '@/lib/constants/voices'

/**
 * Find the entry node of a scenario: the node with no incoming edges (topologically first).
 * Falls back to the first node in the array if all nodes have incoming edges (cycle).
 */
export function findScenarioEntryNode(
  nodes: ScenarioNode[],
  edges: ScenarioEdge[]
): ScenarioNode | undefined {
  const targetIds = new Set(edges.map((e) => e.target))
  return nodes.find((n) => !targetIds.has(n.id)) ?? nodes[0]
}

/**
 * Find the first agent node in the scenario — used to get voice config
 * when the entry node is a DTMF node (which has no own voice).
 */
export function findScenarioVoiceNode(nodes: ScenarioNode[]): ScenarioNode | undefined {
  return nodes.find((n) => n.type === 'agent' || n.type === 'entry_agent')
}

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

  const entryNode = findScenarioEntryNode(scenario.nodes, scenario.edges)
  if (!entryNode) return null

  // Scenario-level voice; fall back to system default — never to a random agent's voice.
  const entryVoiceConfig: ScenarioSessionState['entryVoiceConfig'] = {
    voice_provider: scenario.voice_provider ?? 'elevenlabs',
    voice_id: scenario.voice_id ?? DEFAULT_ELEVENLABS_VOICE_ID,
    voice_language: scenario.voice_language ?? null,
  }

  const activeNodeId = (session.metadata?.scenario_active_node_id as string | undefined) ?? entryNode.id
  const dtmfVariables = (session.metadata?.dtmf_variables as Record<string, string> | undefined) ?? {}
  const state: ScenarioSessionState = {
    scenarioId: scenario.id,
    activeNodeId,
    entryNodeId: entryNode.id,
    entryVoiceConfig,
    nodes: scenario.nodes,
    edges: scenario.edges,
    dtmfVariables,
  }
  sessionState.setScenarioState(sipgateSessionId, state)
  debug(`[ScenarioState] Rebuilt from DB: scenarioId=${scenario.id} activeNodeId=${activeNodeId}`)
  return state
}
