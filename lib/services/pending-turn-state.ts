/**
 * In-memory state for semantic end-of-turn detection.
 *
 * When the LLM determines that the user has not finished speaking, the partial
 * utterance is stored here. On the next user_speak event the accumulated text is
 * prepended to the new input before it is passed to the LLM, producing a single
 * coherent user message.
 *
 * Production note: lives in Node.js module scope — lost on process restart or
 * across serverless instances. For multi-instance deployments, migrate to Redis.
 */

/**
 * Maximum number of consecutive wait_for_turn fillers before the LLM is forced
 * to respond regardless of whether it would call wait_for_turn again.
 */
export const MAX_WAIT_FOR_TURN_FILLERS = 3

interface PendingTurnState {
  /** Accumulated user text (may span multiple incomplete utterances) */
  effectiveText: string
  /** Unix timestamp when the partial was stored (ms) */
  savedAt: number
  /** Number of wait_for_turn fillers played consecutively in this turn */
  fillerCount: number
}

const pendingTurns = new Map<string, PendingTurnState>()

/** Store a partial user utterance for a session and increment the filler counter. */
export function setPendingTurn(sessionId: string, effectiveText: string): void {
  const existing = pendingTurns.get(sessionId)
  pendingTurns.set(sessionId, {
    effectiveText,
    savedAt: Date.now(),
    fillerCount: (existing?.fillerCount ?? 0) + 1,
  })
}

/** Get the accumulated partial text for a session, or null if none pending. */
export function getPendingTurn(sessionId: string): string | null {
  return pendingTurns.get(sessionId)?.effectiveText ?? null
}

/**
 * Returns true when the filler limit has been reached for this session.
 * The LLM should not be offered wait_for_turn in this case.
 */
export function isFillerLimitReached(sessionId: string): boolean {
  return (pendingTurns.get(sessionId)?.fillerCount ?? 0) >= MAX_WAIT_FOR_TURN_FILLERS
}

/** Clear pending turn state for a session. */
export function clearPendingTurn(sessionId: string): void {
  pendingTurns.delete(sessionId)
}
