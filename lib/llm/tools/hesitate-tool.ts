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
      'Announce to the caller in one short sentence what you are about to do — in the same language the caller is using. ' +
      'After this you will get the opportunity to call the actual tool.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Sehr kurze natürliche Ankündigung in einem einzigen Satz.',
        },
      },
      required: ['message'],
    },
  },
}

export function isHesitateTool(name: string): boolean {
  return name === HESITATE_TOOL_NAME
}
