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
      'Optionally set `message` to a single short filler word that fits the conversational moment — ' +
      'pick the word that feels most natural given what the user just said. ' +
      'Use neutral back-channel sounds for unfinished rambling (e.g. "Mhm", "Uh-huh", "Mmh"). ' +
      'Use empathetic words when the user is describing a problem or situation (e.g. "Verstehe", "I see", "Achso"). ' +
      'Use encouraging words when the user is mid-explanation (e.g. "Genau", "Right", "Klar"). ' +
      'Do NOT use agreement words like "Ja" or "Yes" — they sound like a response, not a back-channel. ' +
      'Do NOT repeat the same filler used in the previous turn. ' +
      'Leave `message` empty for silence.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description:
            'A single short filler word matching the conversational tone. ' +
            'DE neutral: "Mhm" / "Mmh" / "Aha" — empathetic: "Verstehe" / "Achso" — encouraging: "Genau" / "Klar". ' +
            'EN neutral: "Mhm" / "Uh-huh" — empathetic: "I see" / "Right" — encouraging: "Go on" / "Sure". ' +
            'Never "Ja", "Yes", or any word that sounds like agreement. Leave empty for silence.',
        },
      },
      required: [],
    },
  },
}

export function isWaitForTurnTool(name: string): boolean {
  return name === WAIT_FOR_TURN_TOOL_NAME
}
