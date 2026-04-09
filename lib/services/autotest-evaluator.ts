'use server'

import { createLLMProvider } from '@/lib/llm/provider'
import type { TurnEvaluation, ConversationLogEntry, OverallEvaluation } from '@/types/autotest'

// Language-specific system prompts for better compliance
const SYSTEM_PROMPTS: Record<string, { turn: string; overall: string }> = {
  en: {
    turn: `You are an AI test evaluator. Evaluate if the assistant's response meets the expected criteria.
Consider: Does it address user needs? Match expected behavior? Appropriate tone?
Be fair but strict. Respond with valid JSON only.`,
    overall: `You are an AI test evaluator. Evaluate if the entire conversation meets the overall criteria.
Consider: Did the assistant achieve the goal? Was the flow logical? Any critical failures?
Respond with valid JSON only.`,
  },
  de: {
    turn: `Du bist ein KI-Test-Bewerter. Bewerte, ob die Antwort des Assistenten die erwarteten Kriterien erfüllt.
Berücksichtige: Erfüllt sie die Bedürfnisse des Nutzers? Entspricht sie dem erwarteten Verhalten? Angemessener Ton?
Sei fair aber streng. WICHTIG: Schreibe das "reasoning"-Feld auf Deutsch! Antworte nur mit gültigem JSON.`,
    overall: `Du bist ein KI-Test-Bewerter. Bewerte, ob das gesamte Gespräch die Gesamtkriterien erfüllt.
Berücksichtige: Hat der Assistent das Ziel erreicht? War der Ablauf logisch? Kritische Fehler?
WICHTIG: Schreibe das "reasoning"-Feld auf Deutsch! Antworte nur mit gültigem JSON.`,
  },
  es: {
    turn: `Eres un evaluador de pruebas de IA. Evalúa si la respuesta del asistente cumple con los criterios esperados.
Considera: ¿Aborda las necesidades del usuario? ¿Coincide con el comportamiento esperado? ¿Tono apropiado?
Sé justo pero estricto. IMPORTANTE: ¡Escribe el campo "reasoning" en español! Responde solo con JSON válido.`,
    overall: `Eres un evaluador de pruebas de IA. Evalúa si toda la conversación cumple con los criterios generales.
Considera: ¿Logró el asistente el objetivo? ¿Fue lógico el flujo? ¿Fallos críticos?
IMPORTANTE: ¡Escribe el campo "reasoning" en español! Responde solo con JSON válido.`,
  },
}

function getEvaluatorSystemPrompt(locale: string): string {
  return SYSTEM_PROMPTS[locale]?.turn || SYSTEM_PROMPTS.en.turn
}

function getOverallEvaluatorSystemPrompt(locale: string): string {
  return SYSTEM_PROMPTS[locale]?.overall || SYSTEM_PROMPTS.en.overall
}

// Language-specific labels for the user prompt
const PROMPT_LABELS: Record<string, { expected: string; actual: string; evaluation: string; criteria: string; conversation: string; turnResults: string; reasoning: string }> = {
  en: {
    expected: 'Expected Behavior/Criteria',
    actual: "Assistant's Actual Response",
    evaluation: 'Your Evaluation',
    criteria: 'Overall Evaluation Criteria',
    conversation: 'Complete Conversation',
    turnResults: 'Individual Turn Results',
    reasoning: 'Brief explanation of your evaluation',
  },
  de: {
    expected: 'Erwartetes Verhalten/Kriterien',
    actual: 'Tatsächliche Antwort des Assistenten',
    evaluation: 'Deine Bewertung',
    criteria: 'Gesamtbewertungskriterien',
    conversation: 'Vollständiges Gespräch',
    turnResults: 'Einzelne Zug-Ergebnisse',
    reasoning: 'Kurze Erklärung deiner Bewertung auf Deutsch',
  },
  es: {
    expected: 'Comportamiento/Criterios Esperados',
    actual: 'Respuesta Real del Asistente',
    evaluation: 'Tu Evaluación',
    criteria: 'Criterios de Evaluación General',
    conversation: 'Conversación Completa',
    turnResults: 'Resultados de Turnos Individuales',
    reasoning: 'Breve explicación de tu evaluación en español',
  },
}

interface EvaluateTurnParams {
  turnIndex: number
  expected: string
  actual: string
  conversationContext: ConversationLogEntry[]
  organizationId: string
  locale?: string
}

/**
 * Evaluate a single assistant turn against expected criteria
 */
export async function evaluateTurn(params: EvaluateTurnParams): Promise<TurnEvaluation> {
  const { turnIndex, expected, actual, conversationContext, locale = 'en' } = params
  const labels = PROMPT_LABELS[locale] || PROMPT_LABELS.en

  try {
    // Use OpenAI for evaluation (more reliable for structured output)
    const llm = createLLMProvider({
      provider: 'openai',
      model: 'gpt-5-mini-2025-08-07',
      temperature: 0.1,
    })

    // Build context string from conversation
    const contextStr = conversationContext
      .slice(0, -1) // Exclude the last entry (the response being evaluated)
      .map((entry) => `${entry.role}: ${entry.content}`)
      .join('\n')

    const prompt = `## ${labels.expected}
${expected}

## ${labels.actual}
${actual}

## ${labels.evaluation}
{
  "passed": true/false,
  "score": 0-100,
  "reasoning": "${labels.reasoning}"
}`

    const response = await llm.generate({
      messages: [
        { role: 'system', content: getEvaluatorSystemPrompt(locale) },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 4000, // Reasoning models need more tokens (reasoning + output)
    })

    // Parse the JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[Autotest Evaluator] No JSON found in response:', response.content)
      return {
        turn_index: turnIndex,
        role: 'assistant',
        expected,
        actual,
        passed: false,
        score: 0,
        reasoning: 'Failed to parse evaluation response',
      }
    }

    const evaluation = JSON.parse(jsonMatch[0])

    return {
      turn_index: turnIndex,
      role: 'assistant',
      expected,
      actual,
      passed: evaluation.passed === true,
      score: Math.min(100, Math.max(0, Number(evaluation.score) || 0)),
      reasoning: evaluation.reasoning || 'No reasoning provided',
    }
  } catch (error) {
    console.error('[Autotest Evaluator] Error evaluating turn:', error)
    return {
      turn_index: turnIndex,
      role: 'assistant',
      expected,
      actual,
      passed: false,
      score: 0,
      reasoning: `Evaluation error: ${String(error)}`,
    }
  }
}

interface EvaluateOverallParams {
  criteria: string
  conversationLog: ConversationLogEntry[]
  turnEvaluations: TurnEvaluation[]
  organizationId: string
  locale?: string
}

// Prompt improvement suggestion prompts
const IMPROVEMENT_PROMPTS: Record<string, string> = {
  en: `You are an expert AI prompt engineer. Analyze the test results and improve the assistant's system prompt.

Your task:
1. Analyze what behaviors failed or scored low
2. Create an improved version of the system prompt that addresses these issues
3. Explain your changes briefly

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "analysis": "Brief analysis of what went wrong (2-3 sentences)",
  "changes": ["Change 1 description", "Change 2 description"],
  "revisedPrompt": "The complete improved system prompt here"
}

The revisedPrompt must be a complete, ready-to-use system prompt - not a diff or partial update.`,
  de: `Du bist ein Experte für KI-Prompt-Engineering. Analysiere die Testergebnisse und verbessere den System-Prompt des Assistenten.

Deine Aufgabe:
1. Analysiere welche Verhaltensweisen fehlgeschlagen sind oder niedrig bewertet wurden
2. Erstelle eine verbesserte Version des System-Prompts, die diese Probleme behebt
3. Erkläre deine Änderungen kurz

WICHTIG: Du musst mit gültigem JSON in diesem exakten Format antworten:
{
  "analysis": "Kurze Analyse was schief gelaufen ist (2-3 Sätze)",
  "changes": ["Änderung 1 Beschreibung", "Änderung 2 Beschreibung"],
  "revisedPrompt": "Der vollständige verbesserte System-Prompt hier"
}

Der revisedPrompt muss ein vollständiger, einsatzbereiter System-Prompt sein - kein Diff oder teilweises Update.`,
  es: `Eres un experto en ingeniería de prompts de IA. Analiza los resultados de las pruebas y mejora el prompt del sistema del asistente.

Tu tarea:
1. Analizar qué comportamientos fallaron o tuvieron puntuación baja
2. Crear una versión mejorada del prompt del sistema que aborde estos problemas
3. Explicar tus cambios brevemente

IMPORTANTE: Debes responder con JSON válido en este formato exacto:
{
  "analysis": "Breve análisis de qué salió mal (2-3 oraciones)",
  "changes": ["Descripción del cambio 1", "Descripción del cambio 2"],
  "revisedPrompt": "El prompt del sistema mejorado completo aquí"
}

El revisedPrompt debe ser un prompt del sistema completo y listo para usar, no un diff o actualización parcial.`,
}

export interface PromptImprovementSuggestion {
  analysis: string
  changes: string[]
  revisedPrompt: string
  error?: string
}

interface SuggestImprovementsParams {
  systemPrompt: string
  conversationLog: ConversationLogEntry[]
  turnEvaluations: TurnEvaluation[]
  overallEvaluation: { passed: boolean; score: number; reasoning: string } | null
  locale?: string
}

/**
 * Suggest improvements to the assistant's system prompt based on test results
 */
export async function suggestPromptImprovements(params: SuggestImprovementsParams): Promise<PromptImprovementSuggestion> {
  const { systemPrompt, conversationLog, turnEvaluations, overallEvaluation, locale = 'en' } = params

  try {
    const llm = createLLMProvider({
      provider: 'openai',
      model: 'gpt-4.1-2025-04-14',
      temperature: 0.7,
    })

    // Build conversation log string
    const conversationStr = conversationLog
      .map((entry) => `${entry.role}: ${entry.content}`)
      .join('\n\n')

    // Build turn evaluations summary with failures highlighted
    const failedTurns = turnEvaluations.filter(te => !te.passed || te.score < 80)
    const turnSummary = failedTurns.length > 0
      ? failedTurns.map(te =>
          `Turn ${te.turn_index + 1} (Score: ${te.score}/100):\n  Expected: ${te.expected}\n  Actual: ${te.actual}\n  Issue: ${te.reasoning}`
        ).join('\n\n')
      : 'All turns passed with good scores.'

    const labels = locale === 'de'
      ? { current: 'Aktueller System-Prompt', conversation: 'Testgespräch', issues: 'Identifizierte Probleme', overall: 'Gesamtbewertung' }
      : locale === 'es'
        ? { current: 'Prompt de Sistema Actual', conversation: 'Conversación de Prueba', issues: 'Problemas Identificados', overall: 'Evaluación General' }
        : { current: 'Current System Prompt', conversation: 'Test Conversation', issues: 'Identified Issues', overall: 'Overall Evaluation' }

    const prompt = `## ${labels.current}
${systemPrompt}

## ${labels.conversation}
${conversationStr}

## ${labels.issues}
${turnSummary}

## ${labels.overall}
Score: ${overallEvaluation?.score ?? 'N/A'}/100
${overallEvaluation?.reasoning ?? 'No overall evaluation available.'}`

    const response = await llm.generate({
      messages: [
        { role: 'system', content: IMPROVEMENT_PROMPTS[locale] || IMPROVEMENT_PROMPTS.en },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 4000,
    })

    // Parse JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[Autotest Evaluator] No JSON found in response:', response.content)
      return {
        analysis: '',
        changes: [],
        revisedPrompt: systemPrompt,
        error: 'Failed to parse improvement suggestions',
      }
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      analysis: parsed.analysis || '',
      changes: Array.isArray(parsed.changes) ? parsed.changes : [],
      revisedPrompt: parsed.revisedPrompt || systemPrompt,
    }
  } catch (error) {
    console.error('[Autotest Evaluator] Error suggesting improvements:', error)
    return {
      analysis: '',
      changes: [],
      revisedPrompt: systemPrompt,
      error: String(error),
    }
  }
}

/**
 * Evaluate the overall conversation against criteria
 */
export async function evaluateOverall(params: EvaluateOverallParams): Promise<OverallEvaluation> {
  const { criteria, conversationLog, turnEvaluations, locale = 'en' } = params
  const labels = PROMPT_LABELS[locale] || PROMPT_LABELS.en

  try {
    const llm = createLLMProvider({
      provider: 'openai',
      model: 'gpt-5-mini-2025-08-07',
      temperature: 0.1,
    })

    // Build conversation log string
    const conversationStr = conversationLog
      .map((entry) => `${entry.role}: ${entry.content}`)
      .join('\n\n')

    // Build turn evaluations summary
    const passedLabel = locale === 'de' ? 'BESTANDEN' : locale === 'es' ? 'APROBADO' : 'PASSED'
    const failedLabel = locale === 'de' ? 'FEHLGESCHLAGEN' : locale === 'es' ? 'FALLIDO' : 'FAILED'
    const turnSummary = turnEvaluations
      .map(
        (te) =>
          `${te.turn_index + 1}: ${te.passed ? passedLabel : failedLabel} (${te.score}/100) - ${te.reasoning}`
      )
      .join('\n')

    const prompt = `## ${labels.criteria}
${criteria}

## ${labels.conversation}
${conversationStr}

## ${labels.turnResults}
${turnSummary || '-'}

## ${labels.evaluation}
{
  "passed": true/false,
  "score": 0-100,
  "reasoning": "${labels.reasoning}"
}`

    const response = await llm.generate({
      messages: [
        { role: 'system', content: getOverallEvaluatorSystemPrompt(locale) },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 4000, // Reasoning models need more tokens (reasoning + output)
    })

    // Parse the JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[Autotest Evaluator] No JSON found in overall response:', response.content)
      // Fall back to turn-based evaluation
      const anyFailed = turnEvaluations.some((te) => !te.passed)
      const avgScore =
        turnEvaluations.length > 0
          ? Math.round(turnEvaluations.reduce((sum, te) => sum + te.score, 0) / turnEvaluations.length)
          : 100
      return {
        passed: !anyFailed,
        score: avgScore,
        reasoning: 'Evaluation based on individual turn results',
      }
    }

    const evaluation = JSON.parse(jsonMatch[0])

    return {
      passed: evaluation.passed === true,
      score: Math.min(100, Math.max(0, Number(evaluation.score) || 0)),
      reasoning: evaluation.reasoning || 'No reasoning provided',
    }
  } catch (error) {
    console.error('[Autotest Evaluator] Error in overall evaluation:', error)
    // Fall back to turn-based evaluation
    const anyFailed = turnEvaluations.some((te) => !te.passed)
    const avgScore =
      turnEvaluations.length > 0
        ? Math.round(turnEvaluations.reduce((sum, te) => sum + te.score, 0) / turnEvaluations.length)
        : 100
    return {
      passed: !anyFailed,
      score: avgScore,
      reasoning: `Overall evaluation error: ${String(error)}. Based on turn results.`,
    }
  }
}
