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
 * After this many milliseconds of silence (no new user_speak following a partial turn),
 * the accumulated text is treated as a complete turn and wait_for_turn is suppressed.
 */
const PENDING_TURN_TIMEOUT_MS = 10_000

interface PendingTurnState {
  /** Accumulated user text (may span multiple incomplete utterances) */
  effectiveText: string
  /** Unix timestamp when the partial was last stored (ms) */
  savedAt: number
}

const pendingTurns = new Map<string, PendingTurnState>()

/** Store a partial user utterance for a session. */
export function setPendingTurn(sessionId: string, effectiveText: string): void {
  pendingTurns.set(sessionId, { effectiveText, savedAt: Date.now() })
}

/** Get the accumulated partial text for a session, or null if none pending. */
export function getPendingTurn(sessionId: string): string | null {
  return pendingTurns.get(sessionId)?.effectiveText ?? null
}

/**
 * Returns true when the user has been silent for longer than PENDING_TURN_TIMEOUT_MS
 * since the last partial turn was stored. In this case the LLM should not be offered
 * wait_for_turn — the accumulated text is treated as the complete turn.
 */
export function isPendingTurnTimedOut(sessionId: string): boolean {
  const state = pendingTurns.get(sessionId)
  if (!state) return false
  return Date.now() - state.savedAt >= PENDING_TURN_TIMEOUT_MS
}

/** Clear pending turn state for a session. */
export function clearPendingTurn(sessionId: string): void {
  pendingTurns.delete(sessionId)
}
