import type { LLMTool } from '@/lib/llm/types'

export const HESITATE_TOOL_NAME = 'hesitate'

export const hesitateToolDefinition: LLMTool = {
  type: 'function',
  function: {
    name: HESITATE_TOOL_NAME,
    description:
      'Call this tool FIRST whenever you are about to use another tool (e.g. database query, knowledge base search, API call). ' +
      'Do NOT use this tool before call control actions (hangup_call, forward_call, take_note) — those execute immediately without announcement. ' +
      'Do NOT use this tool before wait_for_turn — that tool requires no announcement. ' +
      'The message MUST be a brief bridge phrase that signals you are processing — NOT your answer. ' +
      'WRONG: "Ich benötige Ihren Namen." / "Let me check your account." — these reveal the answer early. ' +
      'RIGHT: "Einen Moment..." / "Ich schaue kurz nach..." / "One moment..." / "Let me look that up..." ' +
      'After this you will get the opportunity to call the actual tool and give the real answer.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'A very short bridge phrase only — e.g. "Einen Moment...", "Ich schaue kurz nach...", "One moment...", "Let me check...". Never include your answer or what you need from the user.',
        },
      },
      required: ['message'],
    },
  },
}

export function isHesitateTool(name: string): boolean {
  return name === HESITATE_TOOL_NAME
}
