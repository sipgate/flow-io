import type { ScenarioTransferNode } from '@/lib/llm/tools/scenario-transfer-tool'
import type { CallToolConfig } from '@/types/call-tools'

/**
 * Assembles the system prompt from multiple optional parts.
 *
 * Usage:
 *   const prompt = new PromptBuilder(basePrompt)
 *     .withVariableCollection(collectionPrompt)
 *     .withValidationContext(validationContext)
 *     .withFlowTransferRules(flowNodes)
 *     .withSeamlessTransfer(true)
 *     .withSpellingInstruction()
 *     .build()
 *
 * Order of operations:
 * - seamlessTransfer rule is prepended (highest priority, must come first)
 * - base prompt follows
 * - all other parts are appended in call order
 */
export class PromptBuilder {
  private prefix: string = ''
  private parts: string[]

  constructor(base: string) {
    this.parts = [base]
  }

  /** Append persistent variable collection instructions to the system prompt */
  withVariableCollection(prompt?: string): this {
    if (prompt) {
      this.parts.push(prompt)
    }
    return this
  }

  /** Append dynamic per-turn validation status context */
  withValidationContext(context?: string): this {
    if (context) {
      this.parts.push(context)
    }
    return this
  }

  /** Append transfer tool usage rules when scenario nodes are reachable */
  withFlowTransferRules(nodes?: ScenarioTransferNode[]): this {
    if (nodes && nodes.length > 0) {
      this.parts.push(
        'WICHTIG — Weiterleitung:\n' +
        'Wenn der Anrufer weitergeleitet werden soll, MUSST du IMMER das `transfer_to_agent` Tool aufrufen.\n' +
        'NIEMALS nur verbal ankündigen, dass du weiterleitest, ohne das Tool aufzurufen.\n' +
        'Falsch: "Einen Moment, ich verbinde Sie..." (ohne Tool-Aufruf)\n' +
        'Richtig: Tool aufrufen mit passendem `handoff_message`, z.B. "Einen Moment, ich verbinde Sie..."\n' +
        'AUSNAHME zur hesitate-Regel: Rufe NICHT `hesitate` vor `transfer_to_agent` auf — der `handoff_message`-Parameter ist bereits die Ankündigung an den Anrufer.'
      )
    }
    return this
  }

  /**
   * Prepend the seamless transfer rule so it takes highest priority.
   * The rule forbids greetings and self-introductions when the caller
   * is unaware they were transferred to a new agent.
   */
  withSeamlessTransfer(enabled?: boolean): this {
    if (enabled) {
      this.prefix =
        'ABSOLUT VERBINDLICH — OBERSTE PRIORITÄT (überschreibt alle anderen Anweisungen):\n' +
        'Dies ist eine nahtlose interne Übergabe. Der Anrufer weiß nicht, dass ein Agentenwechsel stattgefunden hat.\n' +
        'VERBOTEN — unter keinen Umständen:\n' +
        '- Begrüßungen wie "Hallo", "Guten Tag", "Hi" oder ähnliche Eröffnungsphrasen\n' +
        '- Dich vorstellen oder deinen Namen nennen\n' +
        '- Erwähnen, dass eine Weiterleitung, Übergabe oder ein Agentenwechsel stattgefunden hat\n' +
        '- Namen anderer Agenten oder Kollegen nennen\n' +
        'GEBOT: Antworte SOFORT und DIREKT auf die letzte Aussage des Anrufers, als wärst du von Anfang an im Gespräch.\n'
    }
    return this
  }

  /**
   * Append hesitation instruction when the hesitate tool is available.
   * Gemini (and other models) do not reliably follow meta-instructions
   * embedded in tool descriptions alone — an explicit system-prompt rule
   * is required to make the model call `hesitate` before real tools.
   */
  withHesitation(enabled?: boolean): this {
    if (enabled) {
      this.parts.push(
        'IMPORTANT — Before using any tool (except `wait_for_turn`), you MUST invoke the `hesitate` function first.\n' +
        'Do NOT output text to describe what you are about to do.\n' +
        'Instead: call the `hesitate` function and pass a brief sentence (in the caller\'s language) as the message.\n' +
        'Only after `hesitate` returns may you call the actual tool.\n' +
        'EXCEPTION: Do NOT call `hesitate` before `wait_for_turn` — that tool executes silently and requires no announcement.'
      )
    }
    return this
  }

  /**
   * Append call control tool usage rules when any call control tools are enabled.
   * Prevents Gemini (and other models) from outputting Python-style code text
   * (e.g. `print(default_api.hangup_call(...))`) instead of using structured tool calls.
   */
  withCallControlRules(config?: CallToolConfig | null): this {
    if (!config) return this

    const enabledTools: string[] = []
    if (config.hangup_enabled) enabledTools.push('`hangup_call`')
    if (config.forward_enabled && config.forward_phone_number) enabledTools.push('`forward_call`')
    if (config.note_enabled) enabledTools.push('`take_note`')

    if (enabledTools.length === 0) return this

    let instruction =
      'IMPORTANT — Call control:\n' +
      `You have the following call tools available: ${enabledTools.join(', ')}.\n` +
      'REQUIRED: Always invoke these tools as structured tool calls — NEVER output them as text, code, or pseudocode.\n' +
      'Wrong: writing "print(default_api.hangup_call(...))" or "hangup_call(...)" in your text response\n' +
      'Correct: invoke the tool call directly without mentioning it in your text response\n'

    if (config.hangup_enabled) {
      instruction +=
        'Use `hangup_call` when the conversation should be ended. ' +
        'Pass your final sentence in the `farewell_message` field — ' +
        'it will be spoken automatically before hanging up.'
    }

    this.parts.push(instruction)
    return this
  }

  /**
   * Append semantic end-of-turn instruction when the wait_for_turn tool is available.
   * Instructs the model to call wait_for_turn instead of responding when the user's
   * utterance is clearly incomplete (mid-sentence, trailing off, etc.).
   */
  withSemanticEndOfTurn(enabled?: boolean): this {
    if (enabled) {
      this.parts.push(
        'IMPORTANT — End of Turn Detection:\n' +
        'Before generating any response, assess whether the user\'s last utterance is a COMPLETE thought.\n' +
        'Signs of an INCOMPLETE turn: trailing off mid-sentence, ending with "and...", "because...", ' +
        '"I was thinking...", "so...", or any statement that clearly has no conclusion yet.\n' +
        'If the utterance is INCOMPLETE: call the `wait_for_turn` tool immediately — do NOT generate any text.\n' +
        'If the utterance is COMPLETE (a full sentence, question, or command): respond normally.'
      )
    }
    return this
  }

  /**
   * Append TTS spelling instruction.
   * Tells the LLM to use [spell]...[/spell] markers so the TTS engine
   * reads out codes, email addresses, etc. character by character.
   */
  withSpellingInstruction(): this {
    this.parts.push(
      'WICHTIG — Buchstabieren / Spelling:\n' +
      'Deine Ausgabe wird von einer TTS-Engine vorgelesen. Wenn du etwas buchstabieren musst ' +
      '(Codes, Bestätigungsnummern, E-Mail-Adressen, Kennzeichen etc.), verwende IMMER [spell]...[/spell] Marker.\n' +
      'Regeln:\n' +
      '- Schreibe den Originalwert in die Marker, OHNE Punkte/Leerzeichen zwischen den Buchstaben: [spell]AB1234[/spell]\n' +
      '- NIEMALS manuell buchstabieren (z.B. "A. B. C." oder "A, B, C") — das klingt falsch in der TTS-Ausgabe.\n' +
      '- Sonderzeichen wie @, -, _ werden automatisch als Wort gesprochen. Schreibe sie einfach mit rein: [spell]stefan@yuzuhub.com[/spell]\n' +
      '- Bei zusammengesetzten Werten mit Bindestrich buchstabiere die Teile getrennt: [spell]LANGE[/spell]-[spell]HEGERMANN[/spell]\n' +
      'Beispiele:\n' +
      '- "Ihre Buchungsnummer ist [spell]XK7291[/spell]."\n' +
      '- "Also [spell]stefan@yuzuhub.com[/spell], stimmt das?"\n' +
      '- "Ihr Name ist [spell]LANGE[/spell]-[spell]HEGERMANN[/spell], korrekt?"'
    )
    return this
  }

  /** Build the final system prompt string */
  build(): string {
    const body = this.parts.join('\n\n')
    return this.prefix ? this.prefix + '\n' + body : body
  }
}
