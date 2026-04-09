/**
 * Pending MCP State Manager
 *
 * Manages async MCP tool calls for phone conversations.
 * When an MCP tool call is initiated, we store the promise here
 * and check for completion on assistant_speech_ended events.
 *
 * In production, consider using Redis for multi-instance deployments.
 */

interface MCPResult {
  response: string
  error?: string
  callAction?: {
    type: 'hangup' | 'forward'
    farewellMessage?: string
    targetPhoneNumber?: string
    callerIdName?: string
    callerIdNumber?: string
    handoffMessage?: string
  }
  scenarioTransfer?: {
    targetNodeId: string
    handoffMessage?: string
  }
}

interface PendingMCPState {
  // The promise that will resolve with the LLM response
  promise: Promise<MCPResult>
  // When the MCP call was started
  startedAt: number
  // Number of "hold" messages sent while waiting
  holdMessageCount: number
  // The user's original message that triggered the MCP call
  userMessage: string
}

// In-memory store for pending MCP states
// Key: session_id (sipgate session ID)
const pendingMCPStates = new Map<string, PendingMCPState>()

// Hold messages to say while waiting for MCP
const HOLD_MESSAGES_DE = [
  'Moment, ich schaue nach...',
  'Ich suche noch...',
  'Einen kleinen Moment noch...',
  'Fast fertig...',
]

const HOLD_MESSAGES_EN = [
  "Just a moment, I'm looking that up...",
  "Still searching...",
  'One more moment...',
  'Almost done...',
]

// How long to wait before responding on assistant_speech_ended (in ms)
// This should be close to sipgate's timeout limit to maximize MCP processing time
const WAIT_BEFORE_RESPONSE_MS = 4000 // 4 seconds (sipgate timeout is ~5s)

/**
 * Start a pending MCP call for a session
 */
export function startPendingMCP(
  sessionId: string,
  promise: Promise<MCPResult>,
  userMessage: string
): void {
  console.log(`[PendingMCP] Starting async MCP call for session ${sessionId}`)
  pendingMCPStates.set(sessionId, {
    promise,
    startedAt: Date.now(),
    holdMessageCount: 0,
    userMessage,
  })
}

/**
 * Check if a session has a pending MCP call
 */
export function hasPendingMCP(sessionId: string): boolean {
  return pendingMCPStates.has(sessionId)
}

/**
 * Get the pending MCP state for a session
 */
export function getPendingMCPState(sessionId: string): PendingMCPState | undefined {
  return pendingMCPStates.get(sessionId)
}

/**
 * Check if the pending MCP call is complete (non-blocking)
 * Returns the result if complete, null if still pending
 */
export async function checkPendingMCPComplete(
  sessionId: string
): Promise<MCPResult | null> {
  const state = pendingMCPStates.get(sessionId)
  if (!state) return null

  // Use Promise.race with an immediate timeout to check if resolved
  const timeoutPromise = new Promise<null>((resolve) => {
    // Immediate timeout - just checks if already resolved
    setImmediate(() => resolve(null))
  })

  try {
    const result = await Promise.race([state.promise, timeoutPromise])
    if (result !== null) {
      // MCP call completed - clean up and return result
      console.log(
        `[PendingMCP] MCP call completed for session ${sessionId} after ${Date.now() - state.startedAt}ms`
      )
      pendingMCPStates.delete(sessionId)
      return result
    }
    return null // Still pending
  } catch (error) {
    // Error in MCP call - clean up and return error
    console.error(`[PendingMCP] MCP call failed for session ${sessionId}:`, error)
    pendingMCPStates.delete(sessionId)
    return { response: '', error: String(error) }
  }
}

/**
 * Wait for MCP to complete, up to the timeout limit
 * This maximizes the time MCP has to complete before we must respond
 * Returns the result if completed within timeout, null if still pending
 */
export async function waitForMCPWithTimeout(
  sessionId: string
): Promise<MCPResult | null> {
  const state = pendingMCPStates.get(sessionId)
  if (!state) return null

  console.log(`[PendingMCP] Waiting up to ${WAIT_BEFORE_RESPONSE_MS}ms for MCP to complete...`)

  // Wait for either the MCP to complete or the timeout
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), WAIT_BEFORE_RESPONSE_MS)
  })

  try {
    const result = await Promise.race([state.promise, timeoutPromise])

    if (result !== null) {
      // MCP completed within timeout
      console.log(
        `[PendingMCP] MCP completed within wait period for session ${sessionId} after ${Date.now() - state.startedAt}ms`
      )
      pendingMCPStates.delete(sessionId)
      return result
    }

    // Timeout reached, MCP still pending
    console.log(`[PendingMCP] Wait timeout reached, MCP still pending for session ${sessionId}`)
    return null
  } catch (error) {
    console.error(`[PendingMCP] MCP call failed during wait for session ${sessionId}:`, error)
    pendingMCPStates.delete(sessionId)
    return { response: '', error: String(error) }
  }
}

/**
 * Wait for the pending MCP call to complete (blocking)
 * Use this as a last resort if we've waited too long
 */
export async function waitForPendingMCP(
  sessionId: string,
  timeoutMs: number = 30000
): Promise<MCPResult | null> {
  const state = pendingMCPStates.get(sessionId)
  if (!state) return null

  const timeoutPromise = new Promise<MCPResult>((resolve) => {
    setTimeout(() => {
      resolve({ response: '', error: 'MCP call timed out' })
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([state.promise, timeoutPromise])
    console.log(
      `[PendingMCP] MCP call finished for session ${sessionId} after ${Date.now() - state.startedAt}ms`
    )
    pendingMCPStates.delete(sessionId)
    return result
  } catch (error) {
    console.error(`[PendingMCP] MCP call failed for session ${sessionId}:`, error)
    pendingMCPStates.delete(sessionId)
    return { response: '', error: String(error) }
  }
}

/**
 * Get the next hold message and increment counter
 */
export function getNextHoldMessage(sessionId: string, language: string = 'de'): string {
  const state = pendingMCPStates.get(sessionId)
  if (!state) {
    return language === 'de' ? 'Einen Moment bitte...' : 'One moment please...'
  }

  const messages = language === 'de' ? HOLD_MESSAGES_DE : HOLD_MESSAGES_EN
  const messageIndex = Math.min(state.holdMessageCount, messages.length - 1)
  state.holdMessageCount++

  return messages[messageIndex]
}

/**
 * Cancel a pending MCP call (e.g., on session end or user barge-in with new question)
 */
export function cancelPendingMCP(sessionId: string): void {
  if (pendingMCPStates.has(sessionId)) {
    console.log(`[PendingMCP] Cancelling MCP call for session ${sessionId}`)
    pendingMCPStates.delete(sessionId)
  }
}

/**
 * Get elapsed time since MCP call started
 */
export function getPendingMCPElapsedMs(sessionId: string): number {
  const state = pendingMCPStates.get(sessionId)
  if (!state) return 0
  return Date.now() - state.startedAt
}

/**
 * Clean up all pending MCP states (useful for testing or shutdown)
 */
export function clearAllPendingMCP(): void {
  console.log(`[PendingMCP] Clearing all pending MCP states (${pendingMCPStates.size} states)`)
  pendingMCPStates.clear()
}
