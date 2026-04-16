import type { LLMTool } from '@/lib/llm/types'

export const WAIT_FOR_TURN_TOOL_NAME = 'wait_for_turn'

export const waitForTurnToolDefinition: LLMTool = {
  type: 'function',
  function: {
    name: WAIT_FOR_TURN_TOOL_NAME,
    description:
      'Call this tool when the utterance is NOT yet a complete turn — meaning it is missing one or more ' +
      'of these three signals that mark a real turn end:\n' +
      '1. SYNTACTIC COMPLETION: the utterance ends mid-phrase or with an open dependency ' +
      '(e.g. "Ich mache gerade den…", "weil…", "aber da…", "I was thinking…"). ' +
      'A complete clause, question, or command does NOT need this tool.\n' +
      '2. SEQUENTIAL COMPLETION: the action type is clear and expects a response ' +
      '(a question expects an answer, a greeting expects a greeting back, a complaint expects acknowledgement). ' +
      'If the sequential action is recognisable, the turn is over — respond.\n' +
      '3. LEXICAL PROJECTABILITY: if the next words are strongly predictable ' +
      '("Ich muss mir die Zähne…" → obvious end coming) do NOT call this tool — the turn is ending.\n' +
      'DECISION RULE: respond immediately whenever you can project what the user means, ' +
      'even if their words are not 100% complete. ' +
      'Only call this tool when the utterance has no syntactic, sequential, or lexical closure yet.\n' +
      'Do NOT call this for short complete responses ("yes", "no", "okay", "sure").\n' +
      'When called, optionally set `message` to a single back-channel word that fits the moment:\n' +
      '- Unfinished rambling → neutral: "Mhm" / "Mmh" / "Uh-huh"\n' +
      '- User describes a problem → empathetic: "Verstehe" / "Achso" / "I see"\n' +
      '- User is mid-explanation → encouraging: "Genau" / "Klar" / "Right"\n' +
      'Never use agreement words ("Ja", "Yes") — they sound like a response. ' +
      'Never repeat the same filler as the previous turn. Leave `message` empty for silence.',
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
