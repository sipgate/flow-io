import type { LLMTool } from '@/lib/llm/types'

export const WAIT_FOR_TURN_TOOL_NAME = 'wait_for_turn'

export const waitForTurnToolDefinition: LLMTool = {
  type: 'function',
  function: {
    name: WAIT_FOR_TURN_TOOL_NAME,
    description:
      'Call this tool when the user has NOT finished their thought — for example: a sentence that ' +
      'trails off, an unfinished statement ending with "and...", "because...", "I was thinking...", ' +
      'or speech that clearly lacks a conclusion. ' +
      'Do NOT call this if the utterance is a complete sentence, question, or command. ' +
      'Do NOT call this for short but complete responses ("yes", "no", "okay", "right"). ' +
      'When called, the system waits for the user to continue speaking. ' +
      'You MAY include a very short acknowledgment in the optional `message` field (e.g. "OK", "Mhm", "Ja?", "Alright") ' +
      'to signal you are still listening — use the same language as the caller. ' +
      'Leave `message` empty for silence.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Optional very short filler to speak while waiting (e.g. "OK", "Mhm", "Ja?"). Leave empty for silence.',
        },
      },
      required: [],
    },
  },
}

export function isWaitForTurnTool(name: string): boolean {
  return name === WAIT_FOR_TURN_TOOL_NAME
}
