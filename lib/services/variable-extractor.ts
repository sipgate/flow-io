import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { debug } from '@/lib/utils/logger'
import { createLLMProvider } from '@/lib/llm/provider'
import { getAssistantVariableDefinitionsForExtraction } from '@/lib/repositories/variables.repository'
import { storeExtractedVariables, hasAssistantVariables } from '@/lib/actions/variables'
import { sendVariableWebhook } from '@/lib/actions/variable-webhooks'
import type { VariableDefinition, LLMExtractionResult, CollectedVariable } from '@/types/variables'

/**
 * Extract variables from a completed call and deliver to webhooks
 * This is called asynchronously after session_end
 */
export async function extractAndDeliverVariables(
  callSessionId: string,
  assistantId: string,
  organizationId: string,
  options?: { preCollected?: Map<string, CollectedVariable> }
): Promise<void> {
  debug('[VariableExtractor] Starting extraction for call:', callSessionId)
  if (options?.preCollected) {
    debug('[VariableExtractor] Using pre-collected data for', options.preCollected.size, 'variables')
  }

  try {
    // Check if assistant has variable definitions
    const { hasVariables } = await hasAssistantVariables(assistantId)
    if (!hasVariables) {
      debug('[VariableExtractor] No variable definitions for assistant:', assistantId)
      return
    }

    // Get variable definitions (using service role for webhook context)
    const { definitions, error: defError } = await getAssistantVariableDefinitionsForExtraction(assistantId)
    if (defError || definitions.length === 0) {
      debug('[VariableExtractor] No definitions found or error:', defError)
      return
    }

    // Get call transcript
    const supabase = createServiceRoleClient()
    const { data: transcripts, error: transcriptError } = await supabase
      .from('call_transcripts')
      .select('speaker, text')
      .eq('call_session_id', callSessionId)
      .order('timestamp', { ascending: true })

    if (transcriptError || !transcripts || transcripts.length === 0) {
      debug('[VariableExtractor] No transcripts found:', transcriptError)
      return
    }

    // Get assistant config for LLM settings
    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('llm_provider, llm_model')
      .eq('id', assistantId)
      .single()

    if (assistantError || !assistant) {
      debug('[VariableExtractor] Assistant not found:', assistantError)
      return
    }

    // Build conversation transcript string
    const transcriptText = transcripts
      .map((t) => `${t.speaker === 'user' ? 'User' : 'Assistant'}: ${t.text}`)
      .join('\n')

    // Always run full LLM extraction on the complete transcript.
    // The full conversation (including corrections and confirmations) gives much
    // better results than the real-time extractor which only sees individual utterances.
    // Pre-collected data is only used as fallback when LLM extraction returns null.
    const preCollected = options?.preCollected

    const llmExtractedVars = await extractVariablesWithLLM(
      transcriptText,
      definitions,
      assistant.llm_provider || 'openai',
      assistant.llm_model || 'gpt-5-mini-2025-08-07'
    )

    // Use pre-collected values as fallback for any variables the LLM didn't find
    const extractedVars = llmExtractedVars.map((ev) => {
      if ((ev.value === null || ev.value === '') && preCollected) {
        const collected = preCollected.get(ev.name)
        if (
          collected &&
          collected.value &&
          collected.regexValid !== false &&
          collected.webhookValid !== false &&
          collected.confirmed !== false
        ) {
          debug(`[VariableExtractor] Using pre-collected fallback for ${ev.name}: "${collected.value}"`)

          return { ...ev, value: collected.value, confidence: 0.9 }
        }
      }
      return ev
    })

    if (!extractedVars || extractedVars.length === 0) {
      debug('[VariableExtractor] No variables extracted')
      return
    }

    // Map extracted variables with definition metadata, filtering out null values
    const variablesToStore = extractedVars
      .filter((ev) => ev.value !== null) // Only store variables with actual values
      .map((ev) => {
        const definition = definitions.find((d) => d.name === ev.name)
        return {
          variable_definition_id: definition?.id || null,
          name: ev.name,
          label: definition?.label || ev.name,
          type: definition?.type || 'string',
          value: ev.value,
          confidence: ev.confidence,
        }
      })

    if (variablesToStore.length === 0) {
      debug('[VariableExtractor] No variables with values to store')

      // Check if there were required variables that are now missing
      const requiredDefinitions = definitions.filter((d) => d.required)
      if (requiredDefinitions.length > 0) {
        const { data: currentSession } = await supabase
          .from('call_sessions')
          .select('metadata')
          .eq('id', callSessionId)
          .single()
        await supabase
          .from('call_sessions')
          .update({
            metadata: {
              ...(currentSession?.metadata as Record<string, unknown> ?? {}),
              extraction_status: 'incomplete',
              missing_required_variables: requiredDefinitions.map((d) => d.name),
            },
          })
          .eq('id', callSessionId)
        debug('[VariableExtractor] Marked as incomplete - missing all required variables')
      }
      return
    }

    // Store extracted variables
    const { variables: stored, error: storeError } = await storeExtractedVariables(
      callSessionId,
      organizationId,
      variablesToStore
    )

    if (storeError) {
      console.error('[VariableExtractor] Failed to store variables:', storeError)
      return
    }

    debug('[VariableExtractor] Stored', stored.length, 'variables')

    // Check if all required variables were extracted
    const requiredDefinitions = definitions.filter((d) => d.required)
    const extractedNames = new Set(variablesToStore.map((v) => v.name))
    const missingRequired = requiredDefinitions.filter((d) => !extractedNames.has(d.name))

    // Update call session metadata with extraction status (merge, don't overwrite)
    const extractionStatus = missingRequired.length === 0 ? 'complete' : 'incomplete'
    const { data: currentSession } = await supabase
      .from('call_sessions')
      .select('metadata')
      .eq('id', callSessionId)
      .single()
    await supabase
      .from('call_sessions')
      .update({
        metadata: {
          ...(currentSession?.metadata as Record<string, unknown> ?? {}),
          extraction_status: extractionStatus,
          missing_required_variables: missingRequired.map((d) => d.name),
        },
      })
      .eq('id', callSessionId)

    if (missingRequired.length > 0) {
      debug('[VariableExtractor] Missing required variables:', missingRequired.map((d) => d.name))
    }

    // Send webhook if configured
    await sendVariableWebhook(assistantId, callSessionId, stored, definitions)

  } catch (error) {
    console.error('[VariableExtractor] Error during extraction:', error)
  }
}

/**
 * Use LLM to extract variables from conversation transcript
 */
async function extractVariablesWithLLM(
  transcript: string,
  definitions: VariableDefinition[],
  llmProvider: string,
  llmModel: string
): Promise<Array<{ name: string; value: string | null; confidence: number }>> {
  try {
    // Build extraction prompt
    const variableList = definitions
      .map((d) => `- ${d.name} (${d.type}${d.required ? ', required' : ''}): ${d.description}`)
      .join('\n')

    const prompt = `You are analyzing a phone conversation transcript to extract specific information.

CONVERSATION TRANSCRIPT:
${transcript}

VARIABLES TO EXTRACT:
${variableList}

INSTRUCTIONS:
1. Carefully read the conversation and identify the values for each variable listed above.
2. For each variable, extract the exact value mentioned in the conversation.
3. If a variable is not mentioned or cannot be determined, set its value to null.
4. Provide a confidence score (0.0 to 1.0) indicating how certain you are about each extraction.
5. Return ONLY valid JSON in the exact format below, with no additional text.

Return your response as JSON in this exact format:
{
  "variables": [
    {"name": "variable_name", "value": "extracted_value_or_null", "confidence": 0.95}
  ]
}

Important:
- Include ALL variables from the list above, even if their value is null
- Use the exact variable names as provided
- Values should be strings (convert numbers/dates to strings)
- Confidence should be between 0.0 and 1.0`

    // Get API key based on provider
    const apiKey = llmProvider === 'google' || llmProvider === 'gemini'
      ? process.env.GOOGLE_AI_API_KEY
      : process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.error('[VariableExtractor] No API key for provider:', llmProvider)
      return []
    }

    // Create LLM provider (apiKey is retrieved internally from env vars)
    const provider = createLLMProvider({
      provider: llmProvider as 'openai' | 'google',
      model: llmModel,
    })

    // Generate response — high maxTokens to accommodate Gemini 3's thinking tokens + actual output
    const response = await provider.generate({
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      maxTokens: 16384,
    })

    // Parse JSON response
    const jsonContent = response.content.trim()

    if (!jsonContent) {
      console.error('[VariableExtractor] Empty LLM response, finish_reason:', response.finish_reason)
      return []
    }

    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = jsonContent
    if (jsonContent.includes('```json')) {
      const match = jsonContent.match(/```json\s*([\s\S]*?)\s*```/)
      if (match) {
        jsonStr = match[1]
      }
    } else if (jsonContent.includes('```')) {
      const match = jsonContent.match(/```\s*([\s\S]*?)\s*```/)
      if (match) {
        jsonStr = match[1]
      }
    }

    let result: LLMExtractionResult
    try {
      result = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('[VariableExtractor] JSON parse failed. Raw content:', jsonContent.substring(0, 500))
      return []
    }

    if (!result.variables || !Array.isArray(result.variables)) {
      console.error('[VariableExtractor] Invalid response format:', result)
      return []
    }

    // Normalize values: convert string "null" to actual null, trim strings
    const normalizedVariables = result.variables.map((v) => ({
      ...v,
      value: v.value === null || v.value === 'null' || v.value === ''
        ? null
        : typeof v.value === 'string' ? v.value.trim() : v.value,
    }))

    debug('[VariableExtractor] Extracted', normalizedVariables.length, 'variables')
    return normalizedVariables

  } catch (error) {
    console.error('[VariableExtractor] LLM extraction failed:', error)
    return []
  }
}

/**
 * Re-extract variables for a call (manual re-run)
 */
export async function reextractVariables(
  callSessionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient()

  // Get call session
  const { data: session, error: sessionError } = await supabase
    .from('call_sessions')
    .select('id, assistant_id, organization_id')
    .eq('id', callSessionId)
    .single()

  if (sessionError || !session) {
    return { success: false, error: 'Call session not found' }
  }

  // Delete existing extracted variables
  await supabase
    .from('extracted_variables')
    .delete()
    .eq('call_session_id', callSessionId)

  // Re-run extraction
  await extractAndDeliverVariables(
    callSessionId,
    session.assistant_id,
    session.organization_id
  )

  return { success: true }
}
