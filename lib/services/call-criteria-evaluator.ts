'use server'

import { debug } from '@/lib/utils/logger'
import { createLLMProvider } from '@/lib/llm/provider'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { CallCriterion, CriterionEvaluationResult } from '@/types/call-criteria'

// Language-specific system prompts
const SYSTEM_PROMPTS: Record<string, string> = {
  en: `You are a call quality evaluator. Evaluate if the call transcript meets the given criterion.
Analyze the conversation objectively and determine the result:
- "passed": true - the criterion was clearly met
- "passed": false - the criterion was clearly NOT met
- "passed": null - INCONCLUSIVE - you cannot determine if the criterion was met (e.g., caller hung up before the agent could complete the action, or the situation to evaluate never occurred)
Be fair but strict. Only use null/inconclusive when there's truly insufficient information. Respond with valid JSON only.`,
  de: `Du bist ein Anrufqualitäts-Bewerter. Bewerte, ob das Gesprächsprotokoll das gegebene Kriterium erfüllt.
Analysiere das Gespräch objektiv und bestimme das Ergebnis:
- "passed": true - das Kriterium wurde klar erfüllt
- "passed": false - das Kriterium wurde klar NICHT erfüllt
- "passed": null - NICHT BEWERTBAR - du kannst nicht feststellen, ob das Kriterium erfüllt wurde (z.B. Anrufer hat aufgelegt bevor der Agent die Aktion ausführen konnte, oder die zu bewertende Situation trat nie ein)
Sei fair aber streng. Verwende null/nicht bewertbar nur, wenn wirklich nicht genug Information vorhanden ist. WICHTIG: Schreibe das "reasoning"-Feld auf Deutsch! Antworte nur mit gültigem JSON.`,
  es: `Eres un evaluador de calidad de llamadas. Evalúa si la transcripción de la llamada cumple con el criterio dado.
Analiza la conversación objetivamente y determina el resultado:
- "passed": true - el criterio se cumplió claramente
- "passed": false - el criterio claramente NO se cumplió
- "passed": null - INCONCLUSO - no puedes determinar si el criterio se cumplió (ej. el llamante colgó antes de que el agente pudiera completar la acción, o la situación a evaluar nunca ocurrió)
Sé justo pero estricto. Solo usa null/inconcluso cuando realmente no hay suficiente información. IMPORTANTE: ¡Escribe el campo "reasoning" en español! Responde solo con JSON válido.`,
}

const PROMPT_LABELS: Record<string, { criterion: string; transcript: string; evaluation: string; reasoning: string }> = {
  en: {
    criterion: 'Criterion to Evaluate',
    transcript: 'Call Transcript',
    evaluation: 'Your Evaluation',
    reasoning: 'Brief explanation of your evaluation',
  },
  de: {
    criterion: 'Zu bewertendes Kriterium',
    transcript: 'Gesprächsprotokoll',
    evaluation: 'Deine Bewertung',
    reasoning: 'Kurze Erklärung deiner Bewertung auf Deutsch',
  },
  es: {
    criterion: 'Criterio a Evaluar',
    transcript: 'Transcripción de la Llamada',
    evaluation: 'Tu Evaluación',
    reasoning: 'Breve explicación de tu evaluación en español',
  },
}

interface EvaluateCriterionParams {
  criterion: CallCriterion
  transcript: string
  locale?: string
}

/**
 * Evaluate a single criterion against a call transcript
 */
async function evaluateCriterion(params: EvaluateCriterionParams): Promise<CriterionEvaluationResult> {
  const { criterion, transcript, locale = 'en' } = params
  const labels = PROMPT_LABELS[locale] || PROMPT_LABELS.en
  const systemPrompt = SYSTEM_PROMPTS[locale] || SYSTEM_PROMPTS.en

  try {
    const llm = createLLMProvider({
      provider: 'openai',
      model: 'gpt-5-mini-2025-08-07',
      temperature: 0.1,
    })

    const prompt = `## ${labels.criterion}
Name: ${criterion.name}
Description: ${criterion.description}

## ${labels.transcript}
${transcript}

## ${labels.evaluation}
{
  "passed": true/false/null,
  "reasoning": "${labels.reasoning}"
}`

    const response = await llm.generate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 1000,
    })

    // Parse the JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[Call Criteria Evaluator] No JSON found in response:', response.content)
      return {
        criterion_id: criterion.id,
        passed: null,
        reasoning: 'Failed to parse evaluation response',
      }
    }

    const evaluation = JSON.parse(jsonMatch[0])

    // Handle the three possible states: true, false, null (inconclusive)
    let passed: boolean | null
    if (evaluation.passed === true) {
      passed = true
    } else if (evaluation.passed === false) {
      passed = false
    } else {
      // null or any other value = inconclusive
      passed = null
    }

    return {
      criterion_id: criterion.id,
      passed,
      reasoning: evaluation.reasoning || 'No reasoning provided',
    }
  } catch (error) {
    console.error('[Call Criteria Evaluator] Error evaluating criterion:', error)
    return {
      criterion_id: criterion.id,
      passed: null,
      reasoning: `Evaluation error: ${String(error)}`,
    }
  }
}

interface EvaluateCallParams {
  callSessionId: string
  criteriaIds?: string[]  // If not provided, evaluate all applicable criteria
  locale?: string
}

/**
 * Evaluate a call against all applicable criteria
 * Returns the results and stores them in the database
 */
export async function evaluateCallCriteria(params: EvaluateCallParams): Promise<{
  results: CriterionEvaluationResult[]
  error: string | null
}> {
  const { callSessionId, criteriaIds, locale = 'en' } = params
  const supabase = createServiceRoleClient()

  try {
    // 1. Fetch the call session to get organization_id, assistant_id, and scenario_id
    const { data: callSession, error: sessionError } = await supabase
      .from('call_sessions')
      .select('id, organization_id, assistant_id, scenario_id')
      .eq('id', callSessionId)
      .single()

    if (sessionError || !callSession) {
      return { results: [], error: 'Call session not found' }
    }

    // 2. Fetch the transcript
    const { data: transcripts, error: transcriptError } = await supabase
      .from('call_transcripts')
      .select('speaker, text, timestamp')
      .eq('call_session_id', callSessionId)
      .order('timestamp', { ascending: true })

    if (transcriptError) {
      return { results: [], error: 'Failed to fetch transcript' }
    }

    if (!transcripts || transcripts.length === 0) {
      return { results: [], error: 'No transcript available for this call' }
    }

    // Format transcript for evaluation
    const transcriptText = transcripts
      .map(t => `${t.speaker}: ${t.text}`)
      .join('\n')

    // 3. Fetch applicable criteria
    // Merge: org-level defaults + scenario-level + assistant-level (additive)
    const orParts: string[] = ['assistant_id.is.null,scenario_id.is.null']  // Org-level defaults
    if (callSession.scenario_id) {
      orParts.push(`scenario_id.eq.${callSession.scenario_id}`)
    }
    if (callSession.assistant_id) {
      orParts.push(`assistant_id.eq.${callSession.assistant_id}`)
    }

    let criteriaQuery = supabase
      .from('call_criteria')
      .select('*')
      .eq('organization_id', callSession.organization_id)
      .eq('is_active', true)
      .or(orParts.join(','))
      .order('position', { ascending: true })

    // If specific criteria IDs provided, filter to those
    if (criteriaIds && criteriaIds.length > 0) {
      criteriaQuery = criteriaQuery.in('id', criteriaIds)
    }

    const { data: criteriaData, error: criteriaError } = await criteriaQuery

    if (criteriaError) {
      return { results: [], error: 'Failed to fetch criteria' }
    }

    if (!criteriaData || criteriaData.length === 0) {
      return { results: [], error: null }  // No criteria to evaluate, not an error
    }

    // Cast criteria to proper type
    const criteria = criteriaData as unknown as CallCriterion[]

    // 4. Evaluate each criterion
    const results: CriterionEvaluationResult[] = []

    for (const criterion of criteria) {
      debug(`[Call Criteria Evaluator] Evaluating criterion: ${criterion.name}`)
      const result = await evaluateCriterion({
        criterion,
        transcript: transcriptText,
        locale,
      })
      results.push(result)

      // Store result in database (upsert to handle re-evaluation)
      const { error: upsertError } = await supabase
        .from('call_criteria_results')
        .upsert({
          call_session_id: callSessionId,
          criterion_id: criterion.id,
          passed: result.passed,
          reasoning: result.reasoning,
          evaluated_at: new Date().toISOString(),
        }, {
          onConflict: 'call_session_id,criterion_id',
        })

      if (upsertError) {
        console.error('[Call Criteria Evaluator] Error storing result:', upsertError)
      }

      // Small delay between evaluations to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    debug(`[Call Criteria Evaluator] Completed evaluation of ${results.length} criteria for call ${callSessionId}`)

    return { results, error: null }
  } catch (error) {
    console.error('[Call Criteria Evaluator] Error:', error)
    return { results: [], error: String(error) }
  }
}

/**
 * Get the criteria results for a call (from database, not re-evaluation)
 */
export async function getCallCriteriaResults(callSessionId: string) {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('call_criteria_results')
    .select(`
      *,
      criterion:call_criteria (
        id,
        name,
        description,
        position
      )
    `)
    .eq('call_session_id', callSessionId)
    .order('criterion(position)', { ascending: true })

  if (error) {
    console.error('[Call Criteria] Error fetching results:', error)
    return { results: [], error: error.message }
  }

  return { results: data || [], error: null }
}
