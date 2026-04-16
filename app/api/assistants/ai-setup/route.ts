import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLLMProvider } from '@/lib/llm/provider'
import { getToolModelConfig } from '@/lib/tool-model'

interface AISetupRequest {
  description: string
  scrapeUrl?: string
  organizationId: string
}

export interface AISetupResult {
  name: string
  description: string
  system_prompt: string
  opening_message: string
  voice_provider: string
  voice_id: string
  voice_language: string
  llm_provider: string
  llm_model: string
  llm_temperature: number
  thinking_level: string
}

async function scrapeUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Flow-IO-Bot/1.0)' },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const html = await response.text()

  // Strip HTML tags and extract meaningful text
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

  return text.substring(0, 4000)
}

const GENERATION_PROMPT = `You are an expert at writing system prompts for AI voice phone assistants. Generate a production-ready configuration following the Voice Agent Prompting template below.

LANGUAGE RULE — critical: Detect the language from the user's description text. Write the entire system_prompt and opening_message in that exact same language. The XML tag names always stay in English regardless of language.

The system_prompt must use this exact XML structure. Do not use markdown, ## headers, or bullet points anywhere in the prompt:

<identity>
  [Who the assistant is, for which company, and its tone — 2-3 short sentences. Second person: "Du bist [Name] von [Firma]." / "You are [Name] from [Company]." etc.]
  [Specify form of address: "Sie" or "Du" for German, "you" for English, etc.]
  [Tone: e.g. freundlich und professionell / friendly and professional]
</identity>

<task>
  [Goal of the conversation in 1-2 sentences. Be specific — what exactly does this assistant do?]
  [Estimated max conversation duration, e.g. "Maximale Gesprächsdauer: fünf Minuten." / "Maximum call duration: five minutes."]
</task>

<flow>
  1. [Greeting: the exact opening phrase after the opening_message]
  2. [Needs assessment: max X questions to identify the caller's need]
  3. [Action: what the assistant does — answers, books, routes, etc.]
  4. [Closing: summarize key points and end the call politely]
</flow>

[If the assistant needs domain-specific knowledge (products, services, policies, hours, prices), add a <knowledge> section here with plain prose sentences. Be concrete — no placeholders. Omit this section if not needed.]

<response_rules>
  [Write all rules as direct instructions to the AI, in the assistant's language. Always include these, adapted to the use case:]
  Keep every response to at most two sentences, around thirty words.
  Ask only one question per turn.
  Spell out all numbers as words: "forty-nine euros" not "49 €", "twenty minutes" not "20 min".
  Read digit sequences one by one: "four-six" not "forty-six", "zero-eight-zero-two" not "eight-zero-two".
  Spell out abbreviations: "for example" not "e.g.", "that is" not "i.e.".
  No markdown, emojis, or URLs in responses.
  Use closed questions to guide the caller: "DSL or cable?" not "Tell me about your connection."
  Never mention technical details, system names, or internal identifiers in responses.
  [Remove or adapt rules that don't fit the specific use case.]
</response_rules>

<names>
  [Write 1-2 direct instructions in the assistant's language. Good example:]
  Repeat back every name the caller gives for confirmation: "Did I get that right — your name is Miller?"
  If uncertain: "Could you spell that for me?"
</names>

<numbers>
  [Write 1-2 direct instructions in the assistant's language. Good example:]
  Always repeat number sequences digit by digit: "I have: four-six-two-eight. Is that correct?"
  Also write digit sequences as words in your responses: "four-six" not "46", "zero-eight-zero" not "080".
</numbers>

<interruption_handling>
  [Write the interruption rule in the assistant's language. Good example:]
  If your response was interrupted, react to what the caller said. Do NOT say "I wasn't finished." Weave in any lost information naturally: "Of course. And just to add: [...]"
</interruption_handling>

<escalation>
  [Write escalation triggers and script in the assistant's language. Good example:]
  Escalate when: the caller asks for a human twice, the issue is unresolved after three attempts, or the caller is upset.
  Then say: "I understand this is frustrating. Let me connect you with a colleague now — I'll pass on everything we've discussed."
</escalation>

<edge_cases>
  [Write edge case responses in the assistant's language. Good examples:]
  Silence over five seconds: "Are you still there?"
  Twice unintelligible: "I'm sorry, I didn't catch that. Could you say it again?"
  Off-topic: Decline politely and redirect to the task.
</edge_cases>

RULES for generating the output:
- Replace every [bracketed placeholder] with concrete content derived from the description and website. No placeholders in the final output.
- Second person throughout: address the AI directly. Never use third person.
- Plain prose inside XML sections. Inside <flow> and <edge_cases>, short numbered/dashed lines for readability are acceptable.
- Be specific: derive the actual company name, assistant name, services, and scope from the description. Invent a short plausible name for the assistant if none is given.

OPENING MESSAGE rules:
- Start with the company or service name — the caller must immediately know where they reached.
- Maximum 2 short sentences. Concrete and specific to this service.
- Natural, like a real person picking up: "Heide GmbH, guten Tag. Womit kann ich helfen?" or "Muster Support, how can I help you today?"
- No generic phrases. No filler. Do not announce you are an AI.
- Write in the same language as the system_prompt.

Available ElevenLabs voices (all multilingual — pick based on tone and character fit):
- pJsNpJRIjvv0gEQf9pTf: Phil (M) — optimized for phone conversations
- 21m00Tcm4TlvDq8ikWAM: Rachel (F) — matter-of-fact, personable, great for conversational use
- EXAVITQu4vr4xnSDxMaL: Sarah (F) — confident, warm, mature
- cjVigY5qzO86Huf0OWal: Eric (M) — smooth, perfect for agentic use
- iP95p4xoKVk53GoZ742B: Chris (M) — natural, down-to-earth, great across many use cases
- XrExE9yKIg1WjnnlVkGX: Matilda (F) — professional, pleasing alto pitch
- onwK4e9ZLuTAKqWW03F9: Daniel (M) — strong, perfect for professional or broadcast
- CwhRBWXzGAHq8TQ4Fs17: Roger (M) — easy going, perfect for casual conversations

Config rules:
- Set voice_language based on the detected language (e.g. "de-DE", "en-US"). Default to "de-DE" if unclear.
- voice_provider: always "elevenlabs"
- Choose voice_id from the list above based on the assistant's character and tone. Default to Phil (pJsNpJRIjvv0gEQf9pTf) if unsure.

Return ONLY a JSON object with these fields, no markdown, no explanation:
{
  "name": "...",
  "description": "...",
  "system_prompt": "...",
  "opening_message": "...",
  "voice_provider": "elevenlabs",
  "voice_id": "...",
  "voice_language": "..."
}`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: AISetupRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { description, scrapeUrl: urlToScrape, organizationId } = body

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }

  let websiteContent = ''
  if (urlToScrape) {
    try {
      websiteContent = await scrapeUrl(urlToScrape)
    } catch (err) {
      console.warn('[AI Setup] Could not scrape URL:', urlToScrape, err)
      // Continue without scraped content
    }
  }

  const userMessage = websiteContent
    ? `Description: ${description}\n\nWebsite content from ${urlToScrape}:\n${websiteContent}`
    : `Description: ${description}`

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
      temperature: 0.3,
    })

    const response = await llm.generate({
      messages: [
        { role: 'system', content: GENERATION_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
    })

    let jsonText = response.content.trim()
    // Strip markdown code fences if present (e.g. ```json ... ```)
    const fenceMatch = jsonText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
    if (fenceMatch) jsonText = fenceMatch[1]
    const result: AISetupResult = JSON.parse(jsonText)

    // Override all non-LLM-generated fields with fixed production defaults
    result.llm_provider = 'google'
    result.llm_model = 'gemini-2.5-flash'
    result.llm_temperature = 0.0
    result.thinking_level = 'minimal'
    // Validate required fields
    const required: (keyof AISetupResult)[] = ['name', 'system_prompt', 'opening_message', 'voice_id', 'voice_language']
    for (const field of required) {
      if (!result[field]) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[AI Setup] Generation failed:', err)
    return NextResponse.json(
      { error: 'Failed to generate assistant configuration' },
      { status: 500 }
    )
  }
}
