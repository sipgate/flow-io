export type LLMProviderType = 'openai' | 'google' | 'mistral'

export interface ModelDefinition {
  provider: LLMProviderType
  model: string
  label: string
  /** Suitable for real-time voice AI (<800ms TTFT) */
  voiceEligible?: boolean
  /** Supports Gemini thinking levels (minimal/low/medium/high) */
  supportsThinking?: boolean
  /** Available as tool model for internal app functions */
  toolEligible?: boolean
  /** Exclude from model comparison test */
  hideFromComparison?: boolean
}

// Sources (April 2026):
// - Artificial Analysis LLM Leaderboard: https://artificialanalysis.ai/leaderboards/models
// - Daily.co Voice AI Benchmark: https://www.daily.co/blog/benchmarking-llms-for-voice-agent-use-cases/
// - OpenAI: gpt-5.4-mini ~490ms TTFT, gpt-5.4-nano ~200ms TTFT
// - Google: gemini-2.5-flash-lite ~330–381ms TTFT (recommended by ElevenLabs for enterprise voice)
// - Gemini 3 Flash Preview: 2.9s TTFT — not voice-eligible
// - Mistral Large/Medium: 1.2–1.4s TTFT — not voice-eligible
export const ALL_MODELS: ModelDefinition[] = [
  // ── OpenAI ──────────────────────────────────────────────────────────
  // Voice-eligible (fast TTFT)
  { provider: 'openai', model: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', voiceEligible: true, toolEligible: true },
  { provider: 'openai', model: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', voiceEligible: true, toolEligible: true },
  // Tool-only (extended reasoning — slow but most capable)
  { provider: 'openai', model: 'gpt-5', label: 'GPT-5', toolEligible: true, hideFromComparison: true },

  // ── Google ──────────────────────────────────────────────────────────
  // Voice-eligible (fast TTFT)
  { provider: 'google', model: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', voiceEligible: true, toolEligible: true },
  { provider: 'google', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', voiceEligible: true, supportsThinking: true, toolEligible: true },
  // Tool-only (slower but more capable)
  { provider: 'google', model: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', supportsThinking: true, toolEligible: true },
  // Preview models — not for voice, useful for testing
  { provider: 'google', model: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', voiceEligible: true, toolEligible: true, hideFromComparison: true },
  { provider: 'google', model: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', supportsThinking: true, toolEligible: true, hideFromComparison: true },
  { provider: 'google', model: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', supportsThinking: true, toolEligible: true, hideFromComparison: true },

  // ── Mistral ─────────────────────────────────────────────────────────
  // Voice-eligible
  { provider: 'mistral', model: 'mistral-small-latest', label: 'Mistral Small 4', voiceEligible: true, toolEligible: true },
  // Tool-only (1.2–1.4s TTFT — too slow for voice, good for tools)
  { provider: 'mistral', model: 'mistral-medium-latest', label: 'Mistral Medium 3.1', toolEligible: true },
  { provider: 'mistral', model: 'mistral-large-latest', label: 'Mistral Large 3', toolEligible: true },
]

/** Default model for voice assistants (fastest, cheapest, voice-eligible) */
export const DEFAULT_ASSISTANT_MODEL = {
  provider: 'google' as LLMProviderType,
  model: 'gemini-2.5-flash-lite',
}

/** Default model for internal tool functions */
export const DEFAULT_TOOL_MODEL = {
  provider: 'openai' as LLMProviderType,
  model: 'gpt-5.4-mini',
}

export function getModelsByProvider(provider: LLMProviderType): ModelDefinition[] {
  return ALL_MODELS.filter((m) => m.provider === provider)
}

export function getToolEligibleModels(): ModelDefinition[] {
  return ALL_MODELS.filter((m) => m.toolEligible)
}

export function getComparisonModels(): ModelDefinition[] {
  return ALL_MODELS.filter((m) => !m.hideFromComparison)
}

export function getModelLabel(provider: LLMProviderType, modelId: string): string {
  return ALL_MODELS.find((m) => m.provider === provider && m.model === modelId)?.label ?? modelId
}

export function getDefaultModel(provider: LLMProviderType): string {
  return getModelsByProvider(provider)[0]?.model ?? ''
}
