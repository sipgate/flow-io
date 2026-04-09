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

// Fixed text always appended to the generated system_prompt.
// Language-neutral rules that must be present regardless of what the generator produces.
const SYSTEM_PROMPT_SUFFIX = `

Voice output rules — always follow these, no exceptions:

Never use markdown, bullet points, numbered lists, headers, bold, italics, asterisks, or dashes as list markers. This text is spoken aloud — any formatting character will be read literally and sound absurd.

Never read out URLs, email addresses, or web links. If you need to refer to a website, say the domain name naturally ("sipgate dot de") or offer to send the link via another channel.

Always speak numbers, prices, percentages, and symbols as words. Never use digits or symbols in your responses. Examples: "nine euros ninety-nine" not "9.99 €", "four point six cents" not "4.6 cents", "twenty thousand" not "20,000", "fifteen percent" not "15%". If you do not know a price or number, do not invent one — say so directly.

Never recite long lists. If you need to mention multiple items, weave them into natural sentences. At most name two or three things per turn, then ask if the caller wants to hear more.

Keep every response short. One to two sentences per turn. Never explain more than the caller asked for.

Ask only one question per turn. Never stack multiple questions in a single response.`

const GENERATION_PROMPT = `You are an expert at writing system prompts for AI voice phone assistants. Generate a production-ready configuration. The system_prompt is the most important field — it must be thorough, specific, and immediately usable.

SYSTEM PROMPT — what it must contain (write 250-400 words of plain prose):

1. Identity and role: Who is this assistant, for which company or service, what does it do specifically. Not generic — derive concrete details from the description and website content.

2. Tone and style: How the assistant speaks. Friendly but efficient, no filler words, short and direct sentences. Sounds like a competent human employee, not a robot reading a script. Responds in 1-2 sentences per turn. Asks one question at a time.

3. Core knowledge and tasks: What topics the assistant handles. Be specific — list the actual areas based on the description. For example: product questions, appointment scheduling, order status, returns, technical troubleshooting, pricing, etc. Whatever is relevant to this specific assistant.

4. Handling uncertainty: If the assistant doesn't understand or isn't sure, it asks one short clarifying question. Never guesses. Never makes up information. If the caller's request is outside scope, it says so briefly and offers escalation.

5. Human escalation: When and how to offer to connect to a human. Use a natural trigger phrase the caller can say.

6. Boundaries: What the assistant does NOT do. No medical advice, no legal advice, no promises it can't keep — or whatever makes sense for the specific use case.

SYSTEM PROMPT FORMAT RULES (critical, never violate):
- Plain prose only. No bullet points, no numbered lists, no headers, no markdown, no emojis, no asterisks, no dashes as list markers.
- Write in the same language as the assistant will speak.
- CRITICAL: Write in the SECOND PERSON, addressing the AI directly. Start with "Du bist [Name]..." NOT "Der Assistent ist..." or "[Name] ist...". Every sentence must be a direct instruction or statement to the AI, not a description of it. WRONG: "Johannes hilft Anrufern dabei, Produkte zu verstehen." RIGHT: "Du hilfst Anrufern dabei, Produkte zu verstehen." WRONG: "Er stellt immer nur eine Frage." RIGHT: "Du stellst immer nur eine Frage."

OPENING MESSAGE rules:
- Start with the company or service name — the caller must immediately know where they reached.
- Maximum 2 short sentences. Concrete and specific to this service.
- Natural, like a real person picking up: "Heide.se, guten Tag. Womit kann ich helfen?" or "Kundenservice Muster GmbH, was kann ich für Sie tun?"
- No "Wie kann ich Ihnen heute behilflich sein?" — too generic and robotic.
- No filler. No announcing you are an AI.

Available ElevenLabs voices (all are multilingual — pick based on tone and character fit):
- pJsNpJRIjvv0gEQf9pTf: Phil (M) — optimized for phone conversations
- 21m00Tcm4TlvDq8ikWAM: Rachel (F) — matter-of-fact, personable, great for conversational use
- EXAVITQu4vr4xnSDxMaL: Sarah (F) — confident, warm, mature
- cjVigY5qzO86Huf0OWal: Eric (M) — smooth, perfect for agentic use
- iP95p4xoKVk53GoZ742B: Chris (M) — natural, down-to-earth, great across many use cases
- XrExE9yKIg1WjnnlVkGX: Matilda (F) — professional, pleasing alto pitch
- onwK4e9ZLuTAKqWW03F9: Daniel (M) — strong, perfect for professional or broadcast
- CwhRBWXzGAHq8TQ4Fs17: Roger (M) — easy going, perfect for casual conversations

Config rules:
- Detect language from description/website. Set voice_language accordingly (e.g. "de-DE", "en-US"). Default to "de-DE" if unclear.
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

    // Append fixed instructions that must always be present
    result.system_prompt = result.system_prompt.trimEnd() + SYSTEM_PROMPT_SUFFIX

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
