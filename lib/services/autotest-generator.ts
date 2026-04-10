'use server'

import { debug } from '@/lib/utils/logger'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createLLMProvider } from '@/lib/llm/provider'
import type { GeneratedTestSuggestion, ConversationTurn } from '@/types/autotest'

const GENERATOR_SYSTEM_PROMPT = `You are a test case generator for AI voice assistants. Your job is to create realistic, comprehensive test scenarios based on an assistant's configuration.

Given an assistant's system prompt and knowledge base content, generate diverse test cases that cover:
1. Happy path scenarios (normal successful interactions)
2. Edge cases (unusual but valid requests)
3. Error handling (how the assistant handles things it can't do)
4. Multi-turn conversations (complex interactions requiring context)

CRITICAL - Turn Evaluation Rules:
- Each assistant turn is evaluated INDEPENDENTLY and produces only ONE response
- The "expected" field for each turn should describe ONE focused behavior for that SINGLE response
- Do NOT expect multiple questions or actions in one turn (e.g., "ask name AND phone number" is wrong)
- If multiple behaviors are needed, split them across multiple turns
- Keep per-turn expectations simple and atomic

GOOD example for expected:
  Turn 1: "Should greet and ask for the caller's name"
  Turn 2: "Should ask for the reason for calling"

BAD example (too much for one turn):
  "Should greet, ask for name, verify identity, and schedule appointment"

For complex multi-part expectations, put them in the "evaluation_criteria" field which evaluates the ENTIRE conversation:
- Use evaluation_criteria for overall goals, conversation flow quality, and cumulative behaviors
- Example: "The assistant should gather name, reason for call, and contact info across the conversation while maintaining a professional tone"

IMPORTANT: Respond with valid JSON only. The response must be a JSON array of test cases.`

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: 'Generate all test content (names, descriptions, user messages, expected behaviors, evaluation criteria) in English.',
  de: 'Generiere alle Testinhalte (Namen, Beschreibungen, Benutzernachrichten, erwartetes Verhalten, Bewertungskriterien) auf Deutsch.',
  es: 'Genera todo el contenido de las pruebas (nombres, descripciones, mensajes de usuario, comportamientos esperados, criterios de evaluación) en español.',
}

interface GenerateTestsParams {
  assistantId: string
  organizationId: string
  count?: number
  locale?: string
}

interface GenerateTestsResult {
  suggestions: GeneratedTestSuggestion[]
  error?: string
}

/**
 * Generate test case suggestions based on assistant configuration
 */
export async function generateTestSuggestions(
  params: GenerateTestsParams
): Promise<GenerateTestsResult> {
  const { assistantId, organizationId, count = 5, locale = 'en' } = params
  const supabase = createServiceRoleClient()
  const languageInstruction = LANGUAGE_INSTRUCTIONS[locale] || LANGUAGE_INSTRUCTIONS.en

  try {
    // Fetch assistant configuration
    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select(`
        id,
        name,
        description,
        system_prompt,
        opening_message
      `)
      .eq('id', assistantId)
      .single()

    if (assistantError || !assistant) {
      return { suggestions: [], error: 'Assistant not found' }
    }

    // Fetch knowledge base content (sample)
    const { data: kbLinks } = await supabase
      .from('assistant_knowledge_bases')
      .select('knowledge_base_id')
      .eq('assistant_id', assistantId)
      .limit(5)

    let kbContent = ''
    if (kbLinks && kbLinks.length > 0) {
      const kbIds = kbLinks.map((link) => link.knowledge_base_id)

      // Get document chunks for context
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('content')
        .in('document_id', (
          await supabase
            .from('documents')
            .select('id')
            .in('knowledge_base_id', kbIds)
            .limit(10)
        ).data?.map((d) => d.id) || [])
        .limit(20)

      if (chunks && chunks.length > 0) {
        kbContent = chunks.map((c) => c.content).join('\n\n---\n\n')
        // Truncate if too long
        if (kbContent.length > 5000) {
          kbContent = kbContent.substring(0, 5000) + '\n\n[Content truncated...]'
        }
      }
    }

    // Build the prompt for the LLM
    const llm = createLLMProvider({
      provider: 'openai',
      model: 'gpt-5.2-2025-12-11',
      temperature: 0.7,
    })

    const prompt = `Generate ${count} diverse test cases for the following AI assistant:

## Assistant Name
${assistant.name}

## Assistant Description
${assistant.description || 'No description provided'}

## System Prompt
${assistant.system_prompt || 'No system prompt configured'}

## Opening Message
${assistant.opening_message || 'No opening message configured'}

${kbContent ? `## Knowledge Base Content (Sample)\n${kbContent}` : '## Knowledge Base\nNo knowledge base configured'}

---

Generate exactly ${count} test cases as a JSON array with this structure:
[
  {
    "name": "Test case name",
    "description": "Brief description of what this tests",
    "conversation_flow": [
      { "role": "user", "content": "User's message" },
      { "role": "assistant", "expected": "What the assistant should do (not exact words)" },
      { "role": "user", "content": "Follow-up message" },
      { "role": "assistant", "expected": "Expected behavior" }
    ],
    "evaluation_criteria": "Overall criteria for determining if the conversation was successful"
  }
]

Each test case should have 2-6 turns and test different aspects of the assistant's capabilities.

IMPORTANT: ${languageInstruction}`

    const response = await llm.generate({
      messages: [
        { role: 'system', content: GENERATOR_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 4000,
    })

    // Parse the JSON response
    const jsonMatch = response.content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[Autotest Generator] No JSON array found in response:', response.content)
      return { suggestions: [], error: 'Failed to parse generated tests' }
    }

    const rawSuggestions = JSON.parse(jsonMatch[0])

    // Validate and transform the suggestions
    const suggestions: GeneratedTestSuggestion[] = rawSuggestions
      .filter((s: Record<string, unknown>) => s.name && s.conversation_flow && Array.isArray(s.conversation_flow))
      .map((s: Record<string, unknown>) => ({
        name: String(s.name),
        description: String(s.description || ''),
        conversation_flow: (s.conversation_flow as Array<Record<string, unknown>>).map((turn) => ({
          role: turn.role as 'user' | 'assistant',
          content: turn.role === 'user' ? String(turn.content || '') : undefined,
          expected: turn.role === 'assistant' ? String(turn.expected || '') : undefined,
        })) as ConversationTurn[],
        evaluation_criteria: String(s.evaluation_criteria || ''),
      }))

    debug('[Autotest Generator] Generated tests:', {
      assistantId,
      requested: count,
      generated: suggestions.length,
    })

    return { suggestions }
  } catch (error) {
    console.error('[Autotest Generator] Error generating tests:', error)
    return { suggestions: [], error: String(error) }
  }
}
