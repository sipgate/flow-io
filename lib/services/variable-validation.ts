/**
 * Variable Validation Helpers
 *
 * Provides immediate regex validation and background webhook validation
 * for real-time variable collection during calls.
 */

/**
 * Immediate regex validation
 * Returns true if the value matches the pattern, false otherwise.
 */
export function validateWithRegex(value: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern)
    return regex.test(value)
  } catch (error) {
    console.warn('[VariableValidation] Invalid regex pattern:', pattern, error)
    // Invalid regex pattern — treat as valid to not block conversation
    return true
  }
}

/**
 * Fire-and-forget webhook validation
 * POSTs to the validation endpoint and returns the result.
 * On timeout (10s) or error, treats as valid to not block conversation.
 */
export async function validateWithWebhook(
  endpointUrl: string,
  field: string,
  value: string,
  sessionId: string
): Promise<{ valid: boolean; message?: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field,
        value,
        session_id: sessionId,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(
        `[VariableValidation] Webhook returned ${response.status} for ${field}`
      )
      return { valid: true }
    }

    const result = await response.json()

    if (typeof result.valid !== 'boolean') {
      console.warn(
        `[VariableValidation] Webhook returned invalid format for ${field}:`,
        result
      )
      return { valid: true }
    }

    return {
      valid: result.valid,
      message: result.message || undefined,
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if ((error as Error).name === 'AbortError') {
      console.warn(
        `[VariableValidation] Webhook timed out for ${field} at ${endpointUrl}`
      )
    } else {
      console.warn(
        `[VariableValidation] Webhook error for ${field}:`,
        error
      )
    }

    // On error, treat as valid to not block conversation
    return { valid: true }
  }
}
