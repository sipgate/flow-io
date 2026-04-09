'use server'

import { createLLMProvider } from '@/lib/llm/provider'
import type { LLMPerformanceMetrics } from '@/lib/llm/types'
import { getComparisonModels } from '@/lib/models'

export interface ModelComparisonResult {
  model: string
  provider: 'openai' | 'google' | 'mistral'
  response: string
  performance: LLMPerformanceMetrics | null
  error?: string
  runType: 'cold' | 'warm'
  thinkingLevel?: string
}

interface CompareModelsParams {
  systemPrompt: string
  testPrompt?: string
}

const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'] as const

// Run cold + warm test with same provider instance to reuse connection
async function runColdWarmTest(
  provider: 'openai' | 'google' | 'mistral',
  model: string,
  label: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high'
): Promise<{ cold: ModelComparisonResult; warm: ModelComparisonResult }> {
  const apiKeyMap: Record<typeof provider, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_AI_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
  }
  const apiKey = apiKeyMap[provider]

  if (!apiKey) {
    const errorResult = {
      model: label,
      provider,
      response: '',
      performance: null,
      error: `No API key for ${provider}`,
      thinkingLevel,
    }
    return {
      cold: { ...errorResult, runType: 'cold' },
      warm: { ...errorResult, runType: 'warm' },
    }
  }

  // Create ONE provider instance to reuse the connection
  const llmProvider = createLLMProvider({ provider, model })

  // Cold run
  let coldResult: ModelComparisonResult
  try {
    const response = await llmProvider.generate({
      messages,
      temperature: 0.7,
      maxTokens: 500,
      thinkingLevel,
    })
    coldResult = {
      model: label,
      provider,
      response: response.content,
      performance: response.performance || null,
      thinkingLevel,
      runType: 'cold',
    }
  } catch (error) {
    coldResult = {
      model: label,
      provider,
      response: '',
      performance: null,
      error: String(error),
      thinkingLevel,
      runType: 'cold',
    }
  }

  // Small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 500))

  // Warm run - reuses the same provider/connection
  let warmResult: ModelComparisonResult
  try {
    const response = await llmProvider.generate({
      messages,
      temperature: 0.7,
      maxTokens: 500,
      thinkingLevel,
    })
    warmResult = {
      model: label,
      provider,
      response: response.content,
      performance: response.performance || null,
      thinkingLevel,
      runType: 'warm',
    }
  } catch (error) {
    warmResult = {
      model: label,
      provider,
      response: '',
      performance: null,
      error: String(error),
      thinkingLevel,
      runType: 'warm',
    }
  }

  return { cold: coldResult, warm: warmResult }
}

export async function compareModels(params: CompareModelsParams): Promise<{
  results: ModelComparisonResult[]
  error?: string
}> {
  const { systemPrompt, testPrompt = 'Who are you? Answer in one sentence.' } = params

  const results: ModelComparisonResult[] = []

  // Build messages with system prompt
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    { role: 'user' as const, content: testPrompt },
  ]

  // Run all model comparisons in parallel
  // Each model runs cold then warm sequentially (to reuse connection)
  // But different models run in parallel
  const MODELS_TO_COMPARE = getComparisonModels()

  const promises = MODELS_TO_COMPARE.flatMap(({ provider, model, label }) => {
    const isGemini3Flash = model === 'gemini-3-flash-preview'

    if (isGemini3Flash) {
      // For Gemini 3 Flash, test all thinking levels
      return THINKING_LEVELS.map((thinkingLevel) =>
        runColdWarmTest(provider, model, `${label} (${thinkingLevel})`, messages, thinkingLevel)
      )
    } else {
      // For other models, just one cold + warm test
      return [runColdWarmTest(provider, model, label, messages, undefined)]
    }
  })

  const settledResults = await Promise.all(promises)

  // Flatten cold and warm results
  for (const { cold, warm } of settledResults) {
    results.push(cold, warm)
  }

  // Sort by warm TTFT (fastest first), grouping by model
  results.sort((a, b) => {
    // First sort by model name
    if (a.model !== b.model) {
      return a.model.localeCompare(b.model)
    }
    // Then by run type (cold before warm)
    if (a.runType !== b.runType) {
      return a.runType === 'cold' ? -1 : 1
    }
    return 0
  })

  return { results }
}
