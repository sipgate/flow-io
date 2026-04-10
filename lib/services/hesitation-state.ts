import { debug } from '@/lib/utils/logger'
import type { ScenarioTransferNode } from '@/lib/llm/tools/scenario-transfer-tool'

/**
 * Hesitation State Manager
 *
 * When the LLM calls the `hesitate` tool, it announces to the caller what it's about to do.
 * The hesitation message is spoken immediately. The params for the follow-up LLM call
 * (which will actually execute the tool) are stored here.
 *
 * Flow:
 *   user_speak → LLM calls hesitate({message}) → speak message → store state
 *   assistant_speech_ended → load state → run follow-up LLM (real tool call)
 */

export interface HesitationParams {
  assistantId: string
  organizationId: string
  /** Conversation history including the hesitation message as the last assistant turn */
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  sessionId: string
  variableContext?: { callerNumber?: string; callDirection?: 'inbound' | 'outbound' }
  variableCollectionPrompt?: string
  validationContext?: string
  scenarioTransferNodes?: ScenarioTransferNode[]
}

const hesitationStates = new Map<string, HesitationParams>()

export function startHesitation(sessionId: string, params: HesitationParams): void {
  hesitationStates.set(sessionId, params)
  debug(`[HesitationState] Started for session ${sessionId}`)
}

export function getHesitationState(sessionId: string): HesitationParams | undefined {
  return hesitationStates.get(sessionId)
}

export function hasHesitationState(sessionId: string): boolean {
  return hesitationStates.has(sessionId)
}

export function clearHesitation(sessionId: string): void {
  if (hesitationStates.has(sessionId)) {
    hesitationStates.delete(sessionId)
    debug(`[HesitationState] Cleared for session ${sessionId}`)
  }
}
