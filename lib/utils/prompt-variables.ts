/**
 * Prompt Variable Substitution
 *
 * Replaces {{variable}} placeholders in system prompts with actual runtime values.
 */

export interface PromptVariableContext {
  // Call context
  callerNumber?: string | null
  callDirection?: 'inbound' | 'outbound'

  // Assistant context
  assistantName?: string | null

  // Custom variables (extensible)
  custom?: Record<string, string>

  // DTMF-captured variables — from dtmf_collect nodes in the active scenario
  dtmfVariables?: Record<string, string>
}

/**
 * Available variables with their descriptions
 * This is used both for documentation and the UI
 */
export const PROMPT_VARIABLES = {
  'caller_number': {
    placeholder: '{{caller_number}}',
    description: 'The phone number of the caller',
    category: 'call',
  },
  'call_direction': {
    placeholder: '{{call_direction}}',
    description: 'Whether the call is inbound or outbound',
    category: 'call',
  },
  'current_date': {
    placeholder: '{{current_date}}',
    description: 'Current date (e.g., December 17, 2025)',
    category: 'time',
  },
  'current_time': {
    placeholder: '{{current_time}}',
    description: 'Current time (e.g., 2:30 PM)',
    category: 'time',
  },
  'current_datetime': {
    placeholder: '{{current_datetime}}',
    description: 'Full date and time',
    category: 'time',
  },
  'day_of_week': {
    placeholder: '{{day_of_week}}',
    description: 'Current day (e.g., Monday)',
    category: 'time',
  },
  'assistant_name': {
    placeholder: '{{assistant_name}}',
    description: 'The name of this assistant',
    category: 'assistant',
  },
} as const

export type PromptVariableName = keyof typeof PROMPT_VARIABLES

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Substitute {{variable}} placeholders in a prompt
 *
 * @param prompt - The prompt template with variable placeholders
 * @param context - The context containing variable values
 * @returns The prompt with variables substituted
 */
export function substitutePromptVariables(
  prompt: string,
  context: PromptVariableContext
): string {
  if (!prompt) return prompt

  let result = prompt

  // Get current date/time in user-friendly format
  const now = new Date()
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }

  // Build variable values
  const variableValues: Record<string, string> = {
    // Call context
    caller_number: context.callerNumber || 'Unknown',
    call_direction: context.callDirection || 'inbound',

    // Time variables
    current_date: now.toLocaleDateString('en-US', dateOptions),
    current_time: now.toLocaleTimeString('en-US', timeOptions),
    current_datetime: now.toLocaleDateString('en-US', dateOptions) + ' at ' +
                      now.toLocaleTimeString('en-US', timeOptions),
    day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),

    // Assistant context
    assistant_name: context.assistantName || 'Assistant',

    // Add custom variables
    ...context.custom,
  }

  // Replace {{variable}} syntax (case-insensitive, allows whitespace)
  for (const [key, value] of Object.entries(variableValues)) {
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'gi')
    result = result.replace(pattern, value)
  }

  // Replace DTMF-captured variables (e.g. {{callerInput}}, {{pinCode}})
  for (const [key, value] of Object.entries(context.dtmfVariables ?? {})) {
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'gi')
    result = result.replace(pattern, value)
  }

  return result
}

/**
 * Extract all variables used in a prompt
 * Useful for validation or showing which variables are used
 */
export function extractPromptVariables(prompt: string): string[] {
  if (!prompt) return []

  const variables: string[] = []

  // Find {{variable}} patterns
  const mustachePattern = /\{\{\s*([a-z_]+)\s*\}\}/gi
  let match
  while ((match = mustachePattern.exec(prompt)) !== null) {
    const varName = match[1].toLowerCase()
    if (!variables.includes(varName)) {
      variables.push(varName)
    }
  }

  return variables
}

/**
 * Validate that all variables in a prompt are supported
 * Returns list of unknown variables
 */
export function validatePromptVariables(prompt: string): string[] {
  const usedVariables = extractPromptVariables(prompt)
  const supportedVariables = Object.keys(PROMPT_VARIABLES)

  return usedVariables.filter(v => !supportedVariables.includes(v))
}
