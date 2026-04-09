import { getToolEligibleModels, getDefaultModel, type LLMProviderType } from '@/lib/models'

export interface ToolModelConfig {
  tool_provider: LLMProviderType
  tool_model: string
}

export const TOOL_MODEL_DEFAULT: ToolModelConfig = {
  tool_provider: 'openai',
  tool_model: 'gpt-4o-mini',
}

/** Models available for selection in the tool model settings, grouped by provider */
export function getToolModelOptions(): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const m of getToolEligibleModels()) {
    if (!result[m.provider]) result[m.provider] = []
    result[m.provider].push(m.model)
  }
  return result
}

/** Providers that have at least one tool-eligible model */
export function getToolModelProviders(): LLMProviderType[] {
  return Object.keys(getToolModelOptions()) as LLMProviderType[]
}

export function getToolModelConfig(settings: Record<string, unknown>): ToolModelConfig {
  const provider = settings.tool_provider
  const model = settings.tool_model
  if (
    (provider === 'openai' || provider === 'google' || provider === 'mistral') &&
    typeof model === 'string' &&
    model.length > 0
  ) {
    return { tool_provider: provider, tool_model: model }
  }
  return TOOL_MODEL_DEFAULT
}

export function getDefaultToolModel(provider: LLMProviderType): string {
  return getDefaultModel(provider)
}
