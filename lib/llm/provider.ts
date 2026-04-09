import { OpenAIProvider } from './openai-provider'
import { GeminiProvider } from './gemini-provider'
import { MistralProvider } from './mistral-provider'
import type { LLMProvider } from './types'

export interface LLMConfig {
  provider: 'openai' | 'google' | 'mistral'
  model: string
  temperature?: number
}

/**
 * Create an LLM provider instance based on configuration
 */
export function createLLMProvider(config: LLMConfig): LLMProvider {
  const apiKey = getApiKey(config.provider)

  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, config.model)
    case 'google':
      return new GeminiProvider(apiKey, config.model)
    case 'mistral':
      return new MistralProvider(apiKey, config.model)
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`)
  }
}

/**
 * Get API key from environment variables
 */
function getApiKey(provider: 'openai' | 'google' | 'mistral'): string {
  const envVarMap: Record<typeof provider, string> = {
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_AI_API_KEY',
    mistral: 'MISTRAL_API_KEY',
  }

  const envVar = envVarMap[provider]
  const key = process.env[envVar]

  if (!key) {
    throw new Error(`Missing API key for ${provider}. Set ${envVar} environment variable.`)
  }

  return key
}

export * from './types'
