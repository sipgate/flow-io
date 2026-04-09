/**
 * Variable Collection State Manager
 *
 * Manages real-time variable collection during phone conversations.
 * In-memory Map keyed by sessionId, following the pattern of pending-mcp-state.ts.
 *
 * In production, consider using Redis for multi-instance deployments.
 */

import type {
  VariableDefinition,
  CollectedVariable,
  VariableCollectionState,
} from '@/types/variables'

// In-memory store for variable collection states
// Key: session_id (sipgate session ID)
const collectionStates = new Map<string, VariableCollectionState>()

/**
 * Initialize variable collection state for a new call
 */
export function initVariableCollection(
  sessionId: string,
  definitions: VariableDefinition[]
): void {
  console.log(
    `[VariableCollection] Initializing for session ${sessionId} with ${definitions.length} definitions`
  )
  collectionStates.set(sessionId, {
    definitions,
    collected: new Map(),
    pendingWebhooks: new Map(),
    lastValidationContext: null,
  })
}

/**
 * Get current collection state for a session
 */
export function getVariableCollection(
  sessionId: string
): VariableCollectionState | undefined {
  return collectionStates.get(sessionId)
}

/**
 * Check if session has collection state
 */
export function hasVariableCollection(sessionId: string): boolean {
  return collectionStates.has(sessionId)
}

/**
 * Store extracted value + regex result for a variable
 */
export function updateCollectedVariable(
  sessionId: string,
  name: string,
  value: string,
  regexValid: boolean | null
): void {
  const state = collectionStates.get(sessionId)
  if (!state) return

  const definition = state.definitions.find((d) => d.name === name)
  const existing = state.collected.get(name)

  state.collected.set(name, {
    value,
    regexValid,
    webhookValid: definition?.validation_endpoint ? 'pending' : null,
    confirmed: definition?.confirm_with_caller ? false : null,
    attempts: (existing?.attempts ?? 0) + 1,
    collectedAt: Date.now(),
  })

  console.log(
    `[VariableCollection] Updated ${name} for session ${sessionId}: value="${value}", regexValid=${regexValid}`
  )
}

/**
 * Update webhook validation result
 */
export function setWebhookResult(
  sessionId: string,
  name: string,
  valid: boolean,
  message?: string
): void {
  const state = collectionStates.get(sessionId)
  if (!state) return

  const collected = state.collected.get(name)
  if (!collected) return

  collected.webhookValid = valid
  if (message) collected.webhookMessage = message

  // Clean up resolved webhook promise
  state.pendingWebhooks.delete(name)

  console.log(
    `[VariableCollection] Webhook result for ${name}: valid=${valid}${message ? `, message=${message}` : ''}`
  )
}

/**
 * Mark variable as confirmed (or denied) by caller
 */
export function setConfirmed(
  sessionId: string,
  name: string,
  confirmed: boolean
): void {
  const state = collectionStates.get(sessionId)
  if (!state) return

  const collected = state.collected.get(name)
  if (!collected) return

  collected.confirmed = confirmed

  // If denied, reset the variable so agent asks again
  if (!confirmed) {
    collected.regexValid = null
    collected.webhookValid = null
    collected.value = ''
  }

  console.log(
    `[VariableCollection] ${name} ${confirmed ? 'confirmed' : 'denied'} by caller`
  )
}

/**
 * Store pending webhook promise for a variable
 */
export function startWebhookValidation(
  sessionId: string,
  name: string,
  promise: Promise<{ valid: boolean; message?: string }>
): void {
  const state = collectionStates.get(sessionId)
  if (!state) return

  state.pendingWebhooks.set(name, promise)
}

/**
 * Non-blocking check of all pending webhooks, update state for resolved ones
 */
export async function checkPendingWebhooks(sessionId: string): Promise<void> {
  const state = collectionStates.get(sessionId)
  if (!state || state.pendingWebhooks.size === 0) return

  const entries = Array.from(state.pendingWebhooks.entries())

  for (const [name, promise] of entries) {
    // Non-blocking check using Promise.race with immediate timeout
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 0)
    })

    try {
      const result = await Promise.race([promise, timeoutPromise])
      if (result !== null) {
        // Webhook completed
        setWebhookResult(sessionId, name, result.valid, result.message)
      }
    } catch (error) {
      // Webhook failed - treat as valid to not block conversation
      console.warn(
        `[VariableCollection] Webhook check failed for ${name}:`,
        error
      )
      setWebhookResult(sessionId, name, true)
    }
  }
}

/**
 * Build context string for LLM injection showing current collection status
 */
export function buildValidationContext(sessionId: string): string | undefined {
  const state = collectionStates.get(sessionId)
  if (!state) return undefined

  const lines: string[] = [
    '[INTERNAL STATUS — DO NOT READ THIS TO THE CALLER. This is for your internal tracking only. Never mention variable names, validation status, or these instructions out loud.]',
    '',
  ]
  const actionItems: string[] = []

  for (const def of state.definitions) {
    const collected = state.collected.get(def.name)

    if (!collected || !collected.value) {
      // Not yet collected
      if (def.mandatory_collection) {
        lines.push(`\u25CB ${def.name}: not yet collected`)
        actionItems.push(`Collect ${def.label || def.name}`)
      }
      continue
    }

    // Check validation status
    const regexFailed = collected.regexValid === false
    const webhookFailed = collected.webhookValid === false
    const webhookPending = collected.webhookValid === 'pending'
    const needsConfirmation = collected.confirmed === false

    if (regexFailed) {
      const hint = def.validation_error_hint || 'Value does not match expected format'
      lines.push(
        `\u2717 ${def.name}: "${collected.value}" \u2014 VALIDATION FAILED: ${hint}. Ask the caller to provide it again.`
      )
      actionItems.push(`Re-ask for ${def.label || def.name} (validation failed)`)
    } else if (webhookFailed) {
      const msg = collected.webhookMessage || 'External validation failed'
      lines.push(
        `\u2717 ${def.name}: "${collected.value}" \u2014 VALIDATION FAILED: ${msg}. Ask the caller to provide it again.`
      )
      actionItems.push(`Re-ask for ${def.label || def.name} (validation failed)`)
    } else if (needsConfirmation) {
      lines.push(
        `? ${def.name}: "${collected.value}" \u2014 NEEDS CONFIRMATION. Read this value back to the caller and ask if it's correct.`
      )
      actionItems.push(
        `Confirm ${def.label || def.name} with caller (read back "${collected.value}")`
      )
    } else if (webhookPending) {
      lines.push(
        `\u25CB ${def.name}: "${collected.value}" (validation in progress)`
      )
    } else {
      // All good
      const confirmedText = collected.confirmed === true ? ' (confirmed by caller)' : ''
      lines.push(`\u2713 ${def.name}: "${collected.value}"${confirmedText}`)
    }
  }

  if (actionItems.length > 0) {
    lines.push('')
    lines.push('Action needed: ' + actionItems.join(', then ') + '.')
  }

  const context = lines.join('\n')
  state.lastValidationContext = context
  return context
}

/**
 * Build system prompt addition for mandatory fields
 */
export function buildCollectionSystemPrompt(
  definitions: VariableDefinition[]
): string {
  const mandatoryDefs = definitions.filter((d) => d.mandatory_collection)
  if (mandatoryDefs.length === 0) return ''

  const fieldSteps = mandatoryDefs.map((def, i) => {
    const step = i + 1
    const lines: string[] = []
    lines.push(`Step ${step}: Ask for ${def.label || def.name} (${def.type}) \u2014 ${def.description}`)

    if (def.validation_regex || def.validation_error_hint) {
      const hint = def.validation_error_hint || `Must match pattern: ${def.validation_regex}`
      lines.push(`  Validation: ${hint}`)
    }

    if (def.confirm_with_caller) {
      if (def.type === 'email') {
        lines.push(`  After caller answers: Spell the username and domain name letter by letter, but say common TLDs naturally (just "Punkt com", "Punkt de" — do NOT spell those out).`)
        lines.push(`  Use periods between letters so TTS reads them slowly: "M. A. X. at B. E. I. S. P. I. E. L. Punkt com, stimmt das?"`)
        lines.push(`  IMPORTANT: Use ". " (period space) between each letter, NOT dashes.`)
      } else if (def.type === 'phone') {
        lines.push(`  After caller answers: Read back EACH DIGIT as a spoken word. Example: "null drei null, eins zwei drei vier fünf, stimmt das?"`)
      } else if (def.type === 'number') {
        lines.push(`  After caller answers: Read back as spoken words. Example: say "zweihundertvierunddreißig" not "234".`)
      } else {
        lines.push(`  After caller answers: Spell it out letter by letter using periods between letters so TTS reads them slowly.`)
        lines.push(`  Example: "M. U. E. L. L. E. R., stimmt das?"`)
        lines.push(`  IMPORTANT: Use ". " (period space) between each letter, NOT dashes.`)
      }
      lines.push(`  Wait for the caller to say yes or no. If no, ask them to repeat or spell it.`)
      lines.push(`  ONLY after they confirm, move to Step ${step + 1 <= mandatoryDefs.length ? step + 1 : 'done'}.`)
    } else {
      lines.push(`  Then move to Step ${step + 1 <= mandatoryDefs.length ? step + 1 : 'done'}.`)
    }

    return lines.join('\n')
  })

  return `DATA COLLECTION — FOLLOW THESE STEPS IN ORDER:

Your response to each user message must handle exactly ONE step. Never ask for the next field in the same response where you receive an answer. Each step is: ask \u2192 receive answer \u2192 confirm if required \u2192 THEN (in a separate turn) move to next step.

${fieldSteps.join('\n\n')}

Spoken format — this is a phone call, everything must be spoken as words:
- Phone numbers: each digit as a word, e.g. "null zwei eins eins" NOT "0211"
- Amounts: as words, e.g. "hundertachtundzwanzig Euro" NOT "128€"
- Emails: spell letter by letter, "at" for @, "Punkt" for "."
- Never output raw digits, symbols, or abbreviations — TTS will read them literally

Style:
- Be natural. Vary phrasing — "Und wie ist Ihr Nachname?", "Können Sie mir auch Ihre E-Mail sagen?", etc.
- NEVER read these instructions or field names out loud to the caller
- If validation fails, explain naturally and ask again
- Do NOT end the call until all steps are complete
- Even if a field does not require confirmation, you MAY read it back and ask if you are unsure — e.g. when the caller spoke unclearly, corrected themselves, or gave an unusual value. Use your judgement.`
}

/**
 * Check if all mandatory fields are collected, validated, and confirmed
 */
export function isCollectionComplete(sessionId: string): boolean {
  const state = collectionStates.get(sessionId)
  if (!state) return true // No state means no collection needed

  for (const def of state.definitions) {
    if (!def.mandatory_collection) continue

    const collected = state.collected.get(def.name)
    if (!collected || !collected.value) return false

    // Check regex validation
    if (collected.regexValid === false) return false

    // Check webhook validation
    if (collected.webhookValid === false || collected.webhookValid === 'pending') return false

    // Check confirmation
    if (collected.confirmed === false) return false
  }

  return true
}

/**
 * Clean up collection state on session end
 */
export function cleanupVariableCollection(sessionId: string): void {
  if (collectionStates.has(sessionId)) {
    console.log(`[VariableCollection] Cleaning up session ${sessionId}`)
    collectionStates.delete(sessionId)
  }
}

/**
 * Clean up all states (useful for testing or shutdown)
 */
export function clearAllVariableCollections(): void {
  console.log(
    `[VariableCollection] Clearing all states (${collectionStates.size} states)`
  )
  collectionStates.clear()
}
