import OpenAI from 'openai'
import type { LLMProvider, LLMGenerateOptions, LLMGenerateResponse, LLMPerformanceMetrics } from './types'

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model: string = 'gpt-5') {
    this.client = new OpenAI({ apiKey })
    this.model = model
  }

  async generate(options: LLMGenerateOptions): Promise<LLMGenerateResponse> {
    return this.generateWithRetry(options, 2) // Retry up to 2 times
  }

  private async generateWithRetry(options: LLMGenerateOptions, retriesLeft: number): Promise<LLMGenerateResponse> {
    // Debug: Log actual messages being sent to OpenAI API
    console.log('[OpenAI] === ACTUAL API REQUEST ===')
    console.log('[OpenAI] Model:', this.model)
    console.log('[OpenAI] Messages being sent to API:')
    options.messages.forEach((msg, idx) => {
      console.log(`  [${idx}] ${msg.role}: ${msg.content}`)
    })
    console.log('[OpenAI] Total messages:', options.messages.length)
    console.log('[OpenAI] ========================')

    // Newer OpenAI models (gpt-4o, gpt-5, etc.) use max_completion_tokens instead of max_tokens
    const isNewerModel = this.model.startsWith('gpt-4o') ||
                         this.model.startsWith('gpt-5') ||
                         this.model.startsWith('o1') ||
                         this.model.startsWith('o3')

    // Some models don't support custom temperature (only default 1):
    // - o1, o3 reasoning models
    // - All gpt-5 models (gpt-5, gpt-5-mini, gpt-5-nano)
    const supportsTemperature = !this.model.startsWith('o1') &&
                                !this.model.startsWith('o3') &&
                                !this.model.startsWith('gpt-5')

    // Track timing for performance metrics
    const startTime = performance.now()

    const response = await this.client.chat.completions.create({
      model: this.model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: options.messages as any,
      ...(supportsTemperature && { temperature: options.temperature ?? 0.7 }),
      ...(isNewerModel
        ? { max_completion_tokens: options.maxTokens ?? 4000 }
        : { max_tokens: options.maxTokens ?? 4000 }),
      stop: options.stopSequences,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: options.tools as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tool_choice: options.tool_choice as any,
    })

    // Calculate performance metrics
    const totalTimeMs = performance.now() - startTime
    const completionTokens = response.usage?.completion_tokens ?? 0
    const tokensPerSecond = completionTokens > 0 && totalTimeMs > 0
      ? completionTokens / (totalTimeMs / 1000)
      : 0

    const performanceMetrics: LLMPerformanceMetrics = {
      ttftMs: totalTimeMs, // For non-streaming, TTFT equals total time
      totalTimeMs,
      tokensPerSecond,
    }

    const choice = response.choices[0]

    // Debug logging
    console.log('[OpenAI] Response details:', {
      finish_reason: choice.finish_reason,
      content_length: choice.message.content?.length || 0,
      content_preview: choice.message.content?.slice(0, 100) + '...',
      content_end: choice.message.content?.slice(-50),
      has_tool_calls: !!choice.message.tool_calls,
      usage: response.usage,
    })

    // Handle tool calls
    if (choice.message.tool_calls) {
      return {
        content: choice.message.content || '',
        tool_calls: choice.message.tool_calls.map((tc) => {
          const functionCall = tc as { id: string; function: { name: string; arguments: string } }
          return {
            id: functionCall.id,
            type: 'function' as const,
            function: {
              name: functionCall.function.name,
              arguments: functionCall.function.arguments,
            },
          }
        }),
        finish_reason: 'tool_calls',
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        performance: performanceMetrics,
        model: this.model,
      }
    }

    // Regular text response
    if (!choice?.message?.content) {
      // Retry on empty content (common with GPT-5 Mini/Nano on cold starts)
      if (retriesLeft > 0) {
        console.log(`[OpenAI] Empty response, retrying... (${retriesLeft} retries left)`)
        await new Promise(resolve => setTimeout(resolve, 500)) // Brief delay before retry
        return this.generateWithRetry(options, retriesLeft - 1)
      }
      throw new Error(`No content in OpenAI response. Finish reason: ${choice?.finish_reason}, refusal: ${choice?.message?.refusal || 'none'}`)
    }

    return {
      content: choice.message.content,
      finish_reason: choice.finish_reason === 'stop' ? 'stop' : 'length',
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      performance: performanceMetrics,
      model: this.model,
    }
  }
}
