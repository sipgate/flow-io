import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLLMProvider } from '@/lib/llm/provider'
import { getToolModelConfig } from '@/lib/tool-model'

interface ImprovePromptRequest {
  prompt: string
  organizationId: string
  userInstruction?: string
}

const IMPROVE_PROMPT = `You are an expert at improving system prompts for AI voice phone assistants. Your job is to rewrite the given prompt so it follows the Voice Agent Prompting best practices below — while preserving every piece of domain-specific content (company name, assistant name, services, products, policies, hours, tone).

TARGET STRUCTURE — the output must use these XML sections in this order:

<identity>
  [Who the assistant is and for which company — 2-3 short sentences. Second person: "Du bist [Name] von [Firma]." / "You are [Name] from [Company]." etc. Tone and form of address.]
</identity>

<task>
  [Goal of the conversation in 1-2 sentences. Max conversation duration.]
</task>

<flow>
  1. [Greeting]
  2. [Needs assessment: max X questions]
  3. [Action]
  4. [Closing]
</flow>

[<knowledge> section with domain-specific facts if present in the input — plain prose, no lists. Omit if the input has no such content.]

<response_rules>
  [Write all rules as direct instructions to the AI, in the prompt's language. Must include:]
  Keep every response to at most two sentences, around thirty words.
  Ask only one question per turn.
  Spell out all numbers as words: "forty-nine euros" not "49 €", "twenty minutes" not "20 min".
  Read digit sequences one by one: "four-six" not "forty-six", "zero-eight-zero-two" not "eight-zero-two".
  Spell out abbreviations: "for example" not "e.g.", "that is" not "i.e.".
  No markdown, emojis, or URLs in responses.
  Use closed questions: "DSL or cable?" not "Tell me about your connection."
  Never mention technical details, system names, or internal identifiers in responses.
</response_rules>

<names>
  [Write as direct instructions in the prompt's language. Good example:]
  Repeat back every name the caller gives for confirmation: "Did I get that right — your name is Miller?"
  If uncertain: "Could you spell that for me?"
</names>

<numbers>
  [Write as direct instructions in the prompt's language. Good example:]
  Always repeat number sequences digit by digit: "I have: four-six-two-eight. Is that correct?"
  Also write digit sequences as words in your responses: "four-six" not "46", "zero-eight-zero" not "080".
</numbers>

<interruption_handling>
  [Write in the prompt's language. Good example:]
  If your response was interrupted, react to what the caller said. Do NOT say "I wasn't finished." Weave in any lost information naturally: "Of course. And just to add: [...]"
</interruption_handling>

<escalation>
  [Write escalation triggers and script in the prompt's language. Good example:]
  Escalate when: the caller asks for a human twice, the issue is unresolved after three attempts, or the caller is upset.
  Then say: "I understand this is frustrating. Let me connect you with a colleague now — I'll pass on everything we've discussed."
</escalation>

<edge_cases>
  [Write in the prompt's language. Good examples:]
  Silence over five seconds: "Are you still there?"
  Twice unintelligible: "I'm sorry, I didn't catch that. Could you say it again?"
  Off-topic: Decline politely and redirect to the task.
</edge_cases>

RULES:
- Preserve the language of the input prompt exactly. Do not translate.
- Preserve all domain knowledge: company name, assistant name, products, services, hours, policies, tone, form of address. Do not invent or remove facts.
- If the input already uses the XML structure, improve the content quality within each section rather than wholesale replacing it.
- If the input uses markdown headers (##), bullet points, or prose paragraphs, restructure it into the XML sections above.
- Remove any markdown formatting characters (**, *, ##, ---) from the content — this is voice output.
- Second person throughout. Never third person.
- Add any missing sections (<names>, <numbers>, <interruption_handling>, <escalation>, <edge_cases>) with sensible defaults for the use case.
- Output ONLY the improved prompt text. No explanation, no preamble, no code fences.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ImprovePromptRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { prompt, organizationId, userInstruction } = body

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', organizationId)
    .single()

  const { tool_provider, tool_model } = getToolModelConfig(
    (org?.settings as Record<string, unknown>) ?? {}
  )

  try {
    const llm = createLLMProvider({
      provider: tool_provider,
      model: tool_model,
      temperature: 0.2,
    })

    const userMessage = userInstruction?.trim()
      ? `Specific improvement requested: ${userInstruction.trim()}\n\n---\n\n${prompt}`
      : prompt

    const response = await llm.generate({
      messages: [
        { role: 'system', content: IMPROVE_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
    })

    const improved = response.content.trim()

    return NextResponse.json({ improved_prompt: improved })
  } catch (err) {
    console.error('[Improve Prompt] Generation failed:', err)
    return NextResponse.json(
      { error: 'Failed to improve prompt' },
      { status: 500 }
    )
  }
}
