import { Mistral } from '@mistralai/mistralai'
import { debug } from '@/lib/utils/logger'
import type { LLMProvider, LLMGenerateOptions, LLMGenerateResponse, LLMPerformanceMetrics } from './types'

export class MistralProvider implements LLMProvider {
  private client: Mistral
  private model: string

  constructor(apiKey: string, model: string = 'mistral-medium-latest') {
    this.client = new Mistral({ apiKey })
    this.model = model
  }

  async generate(options: LLMGenerateOptions): Promise<LLMGenerateResponse> {
    // Debug: Log actual messages being sent to Mistral API
    debug('[Mistral] === ACTUAL API REQUEST ===')
    debug('[Mistral] Model:', this.model)
    debug('[Mistral] Messages being sent to API:')
    options.messages.forEach((msg, idx) => {
      debug(`  [${idx}] ${msg.role}: ${msg.content}`)
    })
    debug('[Mistral] Total messages:', options.messages.length)
    debug('[Mistral] ========================')

    // Convert messages to Mistral format
    const messages = options.messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          name: msg.name,
          toolCallId: msg.tool_call_id,
        }
      }
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }
    })

    // Convert tools to Mistral format (same as OpenAI format)
    const tools = options.tools?.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }))

    // Convert tool_choice to Mistral format
    let toolChoice: 'auto' | 'none' | 'any' | { type: 'function'; function: { name: string } } | undefined
    if (options.tool_choice) {
      if (options.tool_choice === 'auto' || options.tool_choice === 'none') {
        toolChoice = options.tool_choice
      } else if (typeof options.tool_choice === 'object') {
        toolChoice = options.tool_choice
      }
    }

    // Track timing for performance metrics
    const startTime = performance.now()

    const response = await this.client.chat.complete({
      model: this.model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 4000,
      stop: options.stopSequences,
      ...(tools && { tools }),
      ...(toolChoice && { toolChoice }),
    })

    // Calculate performance metrics
    const totalTimeMs = performance.now() - startTime
    const completionTokens = response.usage?.completionTokens ?? 0
    const tokensPerSecond = completionTokens > 0 && totalTimeMs > 0
      ? completionTokens / (totalTimeMs / 1000)
      : 0

    const performanceMetrics: LLMPerformanceMetrics = {
      ttftMs: totalTimeMs, // For non-streaming, TTFT equals total time
      totalTimeMs,
      tokensPerSecond,
    }

    const choice = response.choices?.[0]

    // Debug logging
    debug('[Mistral] Response details:', {
      finish_reason: choice?.finishReason,
      content_length: choice?.message?.content?.length || 0,
      content_preview: typeof choice?.message?.content === 'string'
        ? choice.message.content.slice(0, 100) + '...'
        : '[non-string content]',
      has_tool_calls: !!(choice?.message?.toolCalls && choice.message.toolCalls.length > 0),
      usage: response.usage,
    })

    // Handle tool calls
    if (choice?.message?.toolCalls && choice.message.toolCalls.length > 0) {
      return {
        content: typeof choice.message.content === 'string' ? choice.message.content : '',
        tool_calls: choice.message.toolCalls.map((tc) => {
          // Mistral may return arguments as string or object - normalize to string
          const args = tc.function?.arguments
          const argsString = typeof args === 'string' ? args : JSON.stringify(args ?? {})
          return {
            id: tc.id || `call_${Date.now()}`,
            type: 'function' as const,
            function: {
              name: tc.function?.name || '',
              arguments: argsString,
            },
          }
        }),
        finish_reason: 'tool_calls',
        usage: response.usage
          ? {
              promptTokens: response.usage.promptTokens ?? 0,
              completionTokens: response.usage.completionTokens ?? 0,
              totalTokens: response.usage.totalTokens ?? 0,
            }
          : undefined,
        performance: performanceMetrics,
        model: this.model,
      }
    }

    // Regular text response
    const content = typeof choice?.message?.content === 'string' ? choice.message.content : ''

    if (!content) {
      throw new Error(`No content in Mistral response. Finish reason: ${choice?.finishReason}`)
    }

    return {
      content,
      finish_reason: choice?.finishReason === 'stop' ? 'stop' : 'length',
      usage: response.usage
        ? {
            promptTokens: response.usage.promptTokens ?? 0,
            completionTokens: response.usage.completionTokens ?? 0,
            totalTokens: response.usage.totalTokens ?? 0,
          }
        : undefined,
      performance: performanceMetrics,
      model: this.model,
    }
  }
}
