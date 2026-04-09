'use server'

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createLLMProvider } from '@/lib/llm/provider'
import { getToolModelConfig } from '@/lib/tool-model'

export async function generateTransferInstruction(
  assistantId: string
): Promise<{ instruction: string | null; error: string | null }> {
  const supabase = createServiceRoleClient()

  const { data: assistant, error } = await supabase
    .from('assistants')
    .select('name, description, system_prompt, organization_id')
    .eq('id', assistantId)
    .single()

  if (error || !assistant) {
    return { instruction: null, error: 'Assistant not found' }
  }

  const context = [
    assistant.name ? `Name: ${assistant.name}` : null,
    assistant.description ? `Description: ${assistant.description}` : null,
    assistant.system_prompt
      ? `System Prompt (excerpt): ${assistant.system_prompt.slice(0, 500)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  if (!context) {
    return { instruction: null, error: 'No assistant info available to generate from' }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', assistant.organization_id)
    .single()

  const { tool_provider, tool_model } = getToolModelConfig(
    (org?.settings as Record<string, unknown>) ?? {}
  )

  try {
    const llm = createLLMProvider({ provider: tool_provider, model: tool_model, temperature: 0.4 })

    const response = await llm.generate({
      messages: [
        {
          role: 'system',
          content:
            'You write concise transfer instructions for AI voice agents. ' +
            'A transfer instruction tells the entry agent WHEN to hand off the caller to a specialist agent. ' +
            'Write 1–2 sentences, starting with "Transfer here when..." or "Übergib hierhin wenn...". ' +
            'Match the language of the assistant\'s system prompt. Be specific about the use case.',
        },
        {
          role: 'user',
          content: `Generate a transfer instruction for this agent:\n\n${context}`,
        },
      ],
      temperature: 0.4,
      maxTokens: 100,
    })

    const instruction = response.content.trim() || null
    if (instruction) {
      // Persist on the assistant for reuse across flows
      await supabase
        .from('assistants')
        .update({ transfer_instruction: instruction })
        .eq('id', assistantId)
    }
    return { instruction, error: null }
  } catch (err) {
    console.error('[generateTransferInstruction] Error:', err)
    return { instruction: null, error: 'Failed to generate instruction' }
  }
}
