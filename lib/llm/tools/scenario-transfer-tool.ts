/**
 * LLM Tool for Scenario-based Agent Transfer
 *
 * When a call is routed through a Call Scenario, the active agent can transfer
 * the conversation to any neighboring agent node connected via an edge.
 */

import type { LLMTool } from '@/lib/llm/types'

export interface ScenarioTransferNode {
  nodeId: string
  assistantId: string
  label: string
  transferInstruction: string
  inheritVoice: boolean
}

export const SCENARIO_TRANSFER_TOOL_NAME = 'transfer_to_agent'

export function isScenarioTransferTool(toolName: string): boolean {
  return toolName === SCENARIO_TRANSFER_TOOL_NAME
}

export function buildScenarioTransferTool(reachableNodes: ScenarioTransferNode[]): LLMTool {
  const nodeDescriptions = reachableNodes
    .map((n) => `- "${n.nodeId}": ${n.label} — ${n.transferInstruction || 'Specialized agent'}`)
    .join('\n')

  return {
    type: 'function',
    function: {
      name: SCENARIO_TRANSFER_TOOL_NAME,
      description: `Transfer the conversation to a specialized agent. Use this when the caller's request is better handled by a different agent.\n\nAvailable agents:\n${nodeDescriptions}`,
      parameters: {
        type: 'object',
        properties: {
          agent_node_id: {
            type: 'string',
            enum: reachableNodes.map((n) => n.nodeId),
            description: 'The ID of the agent node to transfer to',
          },
          handoff_message: {
            type: 'string',
            description: 'A short message spoken DIRECTLY TO THE CALLER before the transfer. Address the caller in second person (e.g. "I\'ll connect you with our sales team right away."). Never summarize the situation in third person or speak about the caller. IMPORTANT: Always use the same language as the current conversation.',
          },
        },
        required: ['agent_node_id'],
      },
    },
  }
}

export interface ScenarioTransferToolArgs {
  agent_node_id: string
  handoff_message?: string
}
