/**
 * Real-Time Variable Extractor
 *
 * Quick LLM call to detect if user provided a value for any tracked variable
 * during a phone conversation. Uses a fast/cheap model for low latency.
 */

import { createLLMProvider } from '@/lib/llm/provider'
import type { VariableDefinition } from '@/types/variables'

interface ExtractionResult {
  name: string
  value: string
}

interface ConfirmationResult {
  name: string
  confirmed: boolean
}

/**
 * Extract variable values from a user utterance using a fast LLM call.
 * Only includes last 3 conversation turns for context (not full history).
 */
export async function extractVariablesFromUtterance(
  userText: string,
  conversationHistory: { role: string; content: string }[],
  definitions: VariableDefinition[],
  llmProvider: string,
  llmModel: string
): Promise<ExtractionResult[]> {
  try {
    // Build definitions list for prompt
    const definitionsList = definitions
      .map(
        (d) =>
          `- ${d.name} (${d.type}): ${d.description}${d.validation_error_hint ? ` [Hint: ${d.validation_error_hint}]` : ''}`
      )
      .join('\n')

    // Only last 3 turns for context
    const recentContext = conversationHistory
      .slice(-3)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')

    const prompt = `Given this user utterance in a phone conversation:
"${userText}"

And recent conversation context (last 3 turns):
${recentContext}

Check if the user provided a value for any of these fields:
${definitionsList}

Return ONLY fields where a value was clearly provided. Return empty array if none.
JSON format: {"extracted": [{"name": "field_name", "value": "extracted_value"}]}`

    // Use a fast/cheap model for extraction — always OpenAI gpt-4o-mini
    const provider = createLLMProvider({
      provider: 'openai',
      model: 'gpt-4o-mini',
    })

    const response = await provider.generate({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      maxTokens: 500,
    })

    // Parse JSON response
    const jsonContent = response.content.trim()
    let jsonStr = jsonContent

    // Handle markdown code blocks
    if (jsonContent.includes('```json')) {
      const match = jsonContent.match(/```json\s*([\s\S]*?)\s*```/)
      if (match) jsonStr = match[1]
    } else if (jsonContent.includes('```')) {
      const match = jsonContent.match(/```\s*([\s\S]*?)\s*```/)
      if (match) jsonStr = match[1]
    }

    const result = JSON.parse(jsonStr)

    if (!result.extracted || !Array.isArray(result.extracted)) {
      return []
    }

    // Filter to only known definition names
    const knownNames = new Set(definitions.map((d) => d.name))
    return result.extracted.filter(
      (e: ExtractionResult) => knownNames.has(e.name) && e.value
    )
  } catch (error) {
    console.warn('[RealtimeExtractor] Extraction failed:', error)
    return []
  }
}

/**
 * Check if user confirmed or denied a pending variable value.
 * Called when there are variables awaiting confirmation.
 */
export async function checkConfirmationFromUtterance(
  userText: string,
  pendingConfirmations: Array<{ name: string; value: string }>
): Promise<ConfirmationResult[]> {
  if (pendingConfirmations.length === 0) return []

  try {
    const pendingList = pendingConfirmations
      .map((p) => `- ${p.name}: "${p.value}"`)
      .join('\n')

    const prompt = `The phone agent just read back these values to the caller for confirmation:
${pendingList}

The caller responded:
"${userText}"

For each value, did the caller confirm it's correct or deny it? Only include values the caller clearly responded about.
JSON format: {"confirmations": [{"name": "field_name", "confirmed": true}]}`

    const provider = createLLMProvider({
      provider: 'openai',
      model: 'gpt-4o-mini',
    })

    const response = await provider.generate({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      maxTokens: 300,
    })

    const jsonContent = response.content.trim()
    let jsonStr = jsonContent

    if (jsonContent.includes('```json')) {
      const match = jsonContent.match(/```json\s*([\s\S]*?)\s*```/)
      if (match) jsonStr = match[1]
    } else if (jsonContent.includes('```')) {
      const match = jsonContent.match(/```\s*([\s\S]*?)\s*```/)
      if (match) jsonStr = match[1]
    }

    const result = JSON.parse(jsonStr)

    if (!result.confirmations || !Array.isArray(result.confirmations)) {
      return []
    }

    return result.confirmations.filter(
      (c: ConfirmationResult) =>
        typeof c.confirmed === 'boolean' &&
        pendingConfirmations.some((p) => p.name === c.name)
    )
  } catch (error) {
    console.warn('[RealtimeExtractor] Confirmation check failed:', error)
    return []
  }
}
