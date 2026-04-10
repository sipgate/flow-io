'use server'

import { debug } from '@/lib/utils/logger'
import { createLLMProvider } from '@/lib/llm/provider'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// Language-specific system prompts for CSAT evaluation
const SYSTEM_PROMPTS: Record<string, string> = {
  en: `You are a customer satisfaction evaluator. Analyze the call transcript and estimate what CSAT score (1-5) a customer would likely give based on their experience.

Score guide:
- 5: Excellent - Customer's needs were fully met, agent was helpful, professional, and efficient
- 4: Good - Customer's needs were mostly met, minor issues or delays
- 3: Neutral - Customer's needs were partially met, some friction or unresolved points
- 2: Poor - Customer experienced significant issues, frustration evident, needs not fully addressed
- 1: Very Poor - Customer had a bad experience, major issues, likely very dissatisfied

Consider: Was the agent helpful? Were questions answered? Was the tone appropriate? Was the issue resolved? How did the customer seem to feel?

Respond with valid JSON only.`,
  de: `Du bist ein Kundenzufriedenheits-Bewerter. Analysiere das Gesprächsprotokoll und schätze, welchen CSAT-Wert (1-5) ein Kunde basierend auf seiner Erfahrung wahrscheinlich geben würde.

Bewertungsskala:
- 5: Ausgezeichnet - Kundenbedürfnisse voll erfüllt, Agent war hilfsbereit, professionell und effizient
- 4: Gut - Kundenbedürfnisse größtenteils erfüllt, kleine Probleme oder Verzögerungen
- 3: Neutral - Kundenbedürfnisse teilweise erfüllt, etwas Reibung oder offene Punkte
- 2: Schlecht - Kunde hatte erhebliche Probleme, Frustration erkennbar, Bedürfnisse nicht voll adressiert
- 1: Sehr schlecht - Kunde hatte schlechte Erfahrung, große Probleme, wahrscheinlich sehr unzufrieden

Berücksichtige: War der Agent hilfsbereit? Wurden Fragen beantwortet? War der Ton angemessen? Wurde das Problem gelöst? Wie schien sich der Kunde zu fühlen?

WICHTIG: Schreibe das "reasoning"-Feld auf Deutsch! Antworte nur mit gültigem JSON.`,
}

const PROMPT_LABELS: Record<string, { transcript: string; evaluation: string; reasoning: string }> = {
  en: {
    transcript: 'Call Transcript',
    evaluation: 'Your CSAT Evaluation',
    reasoning: 'Brief explanation of the score',
  },
  de: {
    transcript: 'Gesprächsprotokoll',
    evaluation: 'Deine CSAT-Bewertung',
    reasoning: 'Kurze Erklärung der Bewertung auf Deutsch',
  },
}

interface CSATResult {
  score: number | null
  reasoning: string | null
}

interface EvaluateCSATParams {
  callSessionId: string
}

/**
 * Evaluate CSAT for a single call
 */
async function evaluateCSATFromTranscript(transcript: string, locale: string = 'en'): Promise<CSATResult> {
  const labels = PROMPT_LABELS[locale] || PROMPT_LABELS.en
  const systemPrompt = SYSTEM_PROMPTS[locale] || SYSTEM_PROMPTS.en

  try {
    const llm = createLLMProvider({
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.1,
    })

    const prompt = `## ${labels.transcript}
${transcript}

## ${labels.evaluation}
{
  "score": 1-5,
  "reasoning": "${labels.reasoning}"
}`

    const response = await llm.generate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 500,
    })

    // Parse the JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[CSAT Evaluator] No JSON found in response:', response.content)
      return { score: null, reasoning: 'Failed to parse evaluation response' }
    }

    const result = JSON.parse(jsonMatch[0])
    const score = typeof result.score === 'number' && result.score >= 1 && result.score <= 5
      ? result.score
      : null

    return {
      score,
      reasoning: result.reasoning || null,
    }
  } catch (error) {
    console.error('[CSAT Evaluator] Error evaluating CSAT:', error)
    return { score: null, reasoning: `Evaluation error: ${String(error)}` }
  }
}

/**
 * Evaluate CSAT for a call session
 * Checks if the assistant has CSAT enabled before evaluating
 */
export async function evaluateCallCSAT(params: EvaluateCSATParams): Promise<{
  success: boolean
  score: number | null
  error: string | null
}> {
  const { callSessionId } = params
  const supabase = createServiceRoleClient()

  debug(`[CSAT Evaluator] Starting evaluation for call ${callSessionId}`)

  try {
    // Get call session with scenario and assistant info
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .select(`
        id,
        assistant_id,
        scenario_id,
        csat_score,
        call_scenarios:scenario_id (
          id,
          enable_csat
        ),
        assistants:assistant_id (
          id,
          voice_language
        )
      `)
      .eq('id', callSessionId)
      .single()

    if (sessionError || !session) {
      console.error('[CSAT Evaluator] Failed to fetch session:', sessionError)
      return { success: false, score: null, error: 'Call session not found' }
    }

    // Type assertion for the joined data
    const scenario = (session as unknown as { call_scenarios: { id: string; enable_csat: boolean } | null }).call_scenarios
    const assistant = (session as unknown as { assistants: { id: string; voice_language: string | null } | null }).assistants

    // Check if CSAT is enabled on the scenario
    if (!scenario?.enable_csat) {
      debug(`[CSAT Evaluator] CSAT not enabled for scenario ${session.scenario_id}`)
      return { success: true, score: null, error: null }
    }

    // Skip if already evaluated
    if (session.csat_score !== null) {
      debug(`[CSAT Evaluator] Call ${callSessionId} already has CSAT score: ${session.csat_score}`)
      return { success: true, score: session.csat_score, error: null }
    }

    // Get transcript
    const { data: messages, error: messagesError } = await supabase
      .from('call_transcripts')
      .select('speaker, text, timestamp')
      .eq('call_session_id', callSessionId)
      .order('timestamp', { ascending: true })

    if (messagesError) {
      console.error('[CSAT Evaluator] Failed to fetch messages:', messagesError)
      return { success: false, score: null, error: 'Failed to fetch transcript' }
    }

    if (!messages || messages.length === 0) {
      debug(`[CSAT Evaluator] No transcript found for call ${callSessionId}`)
      return { success: true, score: null, error: null }
    }

    // Build transcript string
    const transcript = messages
      .map((m) => `${m.speaker === 'assistant' ? 'Agent' : 'Customer'}: ${m.text}`)
      .join('\n')

    // Determine locale from assistant's voice language
    const locale = assistant?.voice_language?.startsWith('de') ? 'de' : 'en'

    // Evaluate CSAT
    const result = await evaluateCSATFromTranscript(transcript, locale)

    // Store result
    const { error: updateError } = await supabase
      .from('call_sessions')
      .update({
        csat_score: result.score,
        csat_reasoning: result.reasoning,
        csat_evaluated_at: new Date().toISOString(),
      })
      .eq('id', callSessionId)

    if (updateError) {
      console.error('[CSAT Evaluator] Failed to store CSAT result:', updateError)
      return { success: false, score: result.score, error: 'Failed to store result' }
    }

    debug(`[CSAT Evaluator] Call ${callSessionId} evaluated: CSAT ${result.score}`)
    return { success: true, score: result.score, error: null }
  } catch (error) {
    console.error('[CSAT Evaluator] Unexpected error:', error)
    return { success: false, score: null, error: String(error) }
  }
}

/**
 * Trigger CSAT re-evaluation for a call (clears existing score first)
 */
export async function reEvaluateCallCSAT(callSessionId: string): Promise<{
  success: boolean
  score: number | null
  error: string | null
}> {
  const supabase = createServiceRoleClient()

  // Clear existing CSAT score
  await supabase
    .from('call_sessions')
    .update({
      csat_score: null,
      csat_reasoning: null,
      csat_evaluated_at: null,
    })
    .eq('id', callSessionId)

  // Re-evaluate
  return evaluateCallCSAT({ callSessionId })
}

/**
 * Force CSAT evaluation for a call, regardless of assistant settings
 * Use this for manual evaluation of historical calls
 */
export async function forceEvaluateCallCSAT(callSessionId: string): Promise<{
  success: boolean
  score: number | null
  error: string | null
}> {
  const supabase = createServiceRoleClient()

  debug(`[CSAT Evaluator] Force evaluation for call ${callSessionId}`)

  try {
    // Get call session with assistant info (for locale detection only)
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .select(`
        id,
        assistant_id,
        assistants:assistant_id (
          voice_language
        )
      `)
      .eq('id', callSessionId)
      .single()

    if (sessionError || !session) {
      console.error('[CSAT Evaluator] Failed to fetch session:', sessionError)
      return { success: false, score: null, error: 'Call session not found' }
    }

    // Get transcript
    const { data: messages, error: messagesError } = await supabase
      .from('call_transcripts')
      .select('speaker, text, timestamp')
      .eq('call_session_id', callSessionId)
      .order('timestamp', { ascending: true })

    if (messagesError) {
      console.error('[CSAT Evaluator] Failed to fetch messages:', messagesError)
      return { success: false, score: null, error: 'Failed to fetch transcript' }
    }

    if (!messages || messages.length === 0) {
      debug(`[CSAT Evaluator] No transcript found for call ${callSessionId}`)
      return { success: false, score: null, error: 'No transcript available' }
    }

    // Build transcript string
    const transcript = messages
      .map((m) => `${m.speaker === 'assistant' ? 'Agent' : 'Customer'}: ${m.text}`)
      .join('\n')

    // Determine locale from assistant's voice language
    const assistant = (session as unknown as { assistants: { voice_language: string | null } | null }).assistants
    const locale = assistant?.voice_language?.startsWith('de') ? 'de' : 'en'

    // Evaluate CSAT
    const result = await evaluateCSATFromTranscript(transcript, locale)

    // Store result
    const { error: updateError } = await supabase
      .from('call_sessions')
      .update({
        csat_score: result.score,
        csat_reasoning: result.reasoning,
        csat_evaluated_at: new Date().toISOString(),
      })
      .eq('id', callSessionId)

    if (updateError) {
      console.error('[CSAT Evaluator] Failed to store CSAT result:', updateError)
      return { success: false, score: result.score, error: 'Failed to store result' }
    }

    debug(`[CSAT Evaluator] Call ${callSessionId} force evaluated: CSAT ${result.score}`)
    return { success: true, score: result.score, error: null }
  } catch (error) {
    console.error('[CSAT Evaluator] Unexpected error:', error)
    return { success: false, score: null, error: String(error) }
  }
}
