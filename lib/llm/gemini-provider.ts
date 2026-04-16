import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import type { Content, FunctionDeclaration, FunctionDeclarationsTool, Schema } from '@google/generative-ai'
import { debug } from '@/lib/utils/logger'
import type { LLMProvider, LLMGenerateOptions, LLMGenerateResponse, LLMMessage, LLMTool, LLMPerformanceMetrics } from './types'

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI
  private model: string
  // Map Gemini-safe names back to original names (for colon conversion)
  private toolNameMap: Map<string, string> = new Map()
  // Raw Gemini model Content keyed by first tool_call id — preserves thought_signature for thinking models
  private rawModelContents: Map<string, Content> = new Map()

  constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
    this.client = new GoogleGenerativeAI(apiKey)
    this.model = model
  }

  /**
   * Convert tool name to Gemini-safe format (no colons allowed).
   * Tool names now use __ as separator (OpenAI-safe too), so no conversion needed.
   * Kept for safety in case any legacy colon names reach this path.
   */
  private toGeminiSafeName(name: string): string {
    return name.replace(/:/g, '__')
  }

  /**
   * Convert Gemini-safe name back to original.
   * Names use __ separator natively — just look up the map, no string replacement.
   */
  private fromGeminiSafeName(safeName: string): string {
    return this.toolNameMap.get(safeName) || safeName
  }

  /**
   * Convert LLMTool format to Gemini FunctionDeclaration format
   */
  private convertToolsToGeminiFormat(tools: LLMTool[]): FunctionDeclarationsTool[] {
    // Clear the name map for this request
    this.toolNameMap.clear()

    const functionDeclarations: FunctionDeclaration[] = tools.map((tool) => {
      // Convert OpenAI-style parameters to Gemini Schema format
      const properties: Record<string, Schema> = {}

      for (const [key, value] of Object.entries(tool.function.parameters.properties)) {
        properties[key] = this.convertPropertyToSchema(value)
      }

      // Convert tool name to Gemini-safe format
      const originalName = tool.function.name
      const safeName = this.toGeminiSafeName(originalName)
      this.toolNameMap.set(safeName, originalName)

      return {
        name: safeName,
        description: tool.function.description,
        parameters: {
          type: SchemaType.OBJECT,
          properties,
          required: tool.function.parameters.required,
        },
      }
    })

    return [{ functionDeclarations }]
  }

  /**
   * Convert a property definition to Gemini Schema format
   */
  private convertPropertyToSchema(prop: { type: string; description: string; enum?: string[] }): Schema {
    const schemaType = this.mapTypeToGemini(prop.type)

    // Handle enum strings specially
    if (schemaType === SchemaType.STRING && prop.enum && prop.enum.length > 0) {
      return {
        type: SchemaType.STRING,
        format: 'enum',
        enum: prop.enum,
        description: prop.description,
      }
    }

    // Base schema for other types
    return {
      type: schemaType,
      description: prop.description,
    } as Schema
  }

  /**
   * Map JSON Schema type to Gemini SchemaType
   */
  private mapTypeToGemini(type: string): SchemaType {
    switch (type.toLowerCase()) {
      case 'string':
        return SchemaType.STRING
      case 'number':
        return SchemaType.NUMBER
      case 'integer':
        return SchemaType.INTEGER
      case 'boolean':
        return SchemaType.BOOLEAN
      case 'array':
        return SchemaType.ARRAY
      case 'object':
        return SchemaType.OBJECT
      default:
        return SchemaType.STRING
    }
  }

  async generate(options: LLMGenerateOptions): Promise<LLMGenerateResponse> {
    // Pre-seed rawModelContents from caller (used to restore thought_signature for fake hesitation replays)
    if (options.preloadedRawContents) {
      for (const [id, content] of options.preloadedRawContents) {
        this.rawModelContents.set(id, content as import('@google/generative-ai').Content)
      }
    }

    // Convert tools to Gemini format if provided
    const geminiTools = options.tools ? this.convertToolsToGeminiFormat(options.tools) : undefined

    const model = this.client.getGenerativeModel({
      model: this.model,
      ...(geminiTools && { tools: geminiTools }),
    })

    // Convert messages to Gemini format
    // This will exclude the last user message as it needs to be sent separately
    const { systemPrompt, history, lastUserMessage } = this.convertMessages(options.messages)

    // Debug: Log what's actually being sent to Gemini
    debug('[Gemini] === ACTUAL API REQUEST ===')
    debug('[Gemini] Model:', this.model)
    debug('[Gemini] System prompt:', systemPrompt?.substring(0, 100) + '...')
    debug('[Gemini] History messages:')
    history.forEach((msg, idx) => {
      const part = msg.parts[0]
      const content = 'text' in part ? part.text : 'functionResponse' in part ? `[Function: ${part.functionResponse?.name}]` : '[Unknown]'
      debug(`  [${idx}] ${msg.role}: ${content}`)
    })
    const isFunctionResponse = Array.isArray(lastUserMessage)
    debug('[Gemini] Last user message:', isFunctionResponse ? 'Function response(s)' : lastUserMessage)
    debug('[Gemini] Is function response:', isFunctionResponse)
    debug('[Gemini] Total history messages:', history.length)
    debug('[Gemini] Tools provided:', geminiTools ? geminiTools[0]?.functionDeclarations?.map(f => f.name) : 'none')
    debug('[Gemini] ========================')

    // Build generation config with optional thinking level for Gemini 3 models
    const generationConfig: Record<string, unknown> = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 4000,
      stopSequences: options.stopSequences,
    }

    // Add thinking config for Gemini 3 models (reduces latency when set to 'low' or 'minimal')
    // 'none' skips thinkingConfig entirely — the model won't think unless it defaults to it
    if (options.thinkingLevel && options.thinkingLevel !== 'none') {
      generationConfig.thinkingConfig = {
        thinkingLevel: options.thinkingLevel,
      }
    }

    // Create chat with history
    const chat = model.startChat({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      history: history as any, // Type cast needed for function role
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generationConfig: generationConfig as any,
      ...(systemPrompt && {
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }],
        },
      }),
    })

    // Track timing for performance metrics
    const startTime = performance.now()

    // Send the last user message (or function response) and get response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await chat.sendMessage(lastUserMessage as any)
    const response = result.response

    // Calculate performance metrics
    const totalTimeMs = performance.now() - startTime
    const completionTokens = response.usageMetadata?.candidatesTokenCount ?? 0
    const tokensPerSecond = completionTokens > 0 && totalTimeMs > 0
      ? completionTokens / (totalTimeMs / 1000)
      : 0

    const performanceMetrics: LLMPerformanceMetrics = {
      ttftMs: totalTimeMs, // For non-streaming, TTFT equals total time
      totalTimeMs,
      tokensPerSecond,
    }

    // Check for function calls first
    const functionCalls = response.functionCalls()

    // Debug logging
    const candidate = response.candidates?.[0]
    debug('[Gemini] Response details:', {
      has_function_calls: !!(functionCalls && functionCalls.length > 0),
      function_calls: functionCalls?.map(fc => fc.name) || [],
      finish_reason: candidate?.finishReason,
      safety_ratings: candidate?.safetyRatings?.map(r => ({ category: r.category, probability: r.probability })),
      usage: response.usageMetadata,
    })

    // If there are function calls, return them
    if (functionCalls && functionCalls.length > 0) {
      debug('[Gemini] Function calls detected:', JSON.stringify(functionCalls, null, 2))

      // Generate IDs upfront so we can key the raw content for thought_signature preservation
      const now = Date.now()
      const toolCalls = functionCalls.map((fc, index) => ({
        id: `call_${now}_${index}`,
        type: 'function' as const,
        function: {
          name: this.fromGeminiSafeName(fc.name),
          arguments: JSON.stringify(fc.args),
        },
      }))

      // Store raw model Content so convertHistoryMessages can pass thought_signature back unchanged
      const rawContent = response.candidates?.[0]?.content
      if (rawContent) {
        this.rawModelContents.set(toolCalls[0].id, rawContent)
      }

      return {
        content: '', // Gemini doesn't return text content with function calls
        tool_calls: toolCalls,
        finish_reason: 'tool_calls',
        rawToolCallContent: rawContent,
        usage: response.usageMetadata
          ? {
              promptTokens: response.usageMetadata.promptTokenCount ?? 0,
              completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: response.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
        performance: performanceMetrics,
        model: this.model,
      }
    }

    // Regular text response
    let content: string
    try {
      content = response.text()
    } catch {
      content = ''
    }

    debug('[Gemini] Text response length:', content?.length || 0)

    // Handle empty response - provide fallback instead of throwing
    if (!content) {
      // Check if this was blocked by safety filters
      const finishReason = candidate?.finishReason
      if (finishReason === 'SAFETY') {
        content = "I apologize, but I can't help with that request."
      } else if (finishReason === 'STOP' && !functionCalls?.length) {
        // Gemini returned STOP with no content - this is unusual
        // Return a helpful message instead of crashing
        console.warn('[Gemini] Empty response with STOP finish reason. Candidate:', JSON.stringify(candidate, null, 2))
        content = "I'm having trouble processing that request. Could you try rephrasing it?"
      } else {
        throw new Error(`No content in Gemini response. Finish reason: ${finishReason}`)
      }
    }

    return {
      content,
      finish_reason: 'stop',
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
      performance: performanceMetrics,
      model: this.model,
    }
  }

  private convertMessages(messages: LLMMessage[]): {
    systemPrompt?: string
    history: Array<{ role: 'user' | 'model' | 'function'; parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: { content: string } } }> }>
    lastUserMessage: string | Array<{ functionResponse: { name: string; response: { content: string } } }>
  } {
    let systemPrompt: string | undefined

    // Extract system message if present
    const messagesWithoutSystem = messages.filter((msg) => {
      if (msg.role === 'system') {
        systemPrompt = msg.content
        return false
      }
      return true
    })

    // Check if the last message is a tool response (function result)
    const lastMsg = messagesWithoutSystem[messagesWithoutSystem.length - 1]
    const isToolResponse = lastMsg?.role === 'tool'

    if (isToolResponse) {
      // Handle tool response scenario
      // Find all consecutive tool messages at the end
      const toolMessages: LLMMessage[] = []
      let idx = messagesWithoutSystem.length - 1
      while (idx >= 0 && messagesWithoutSystem[idx].role === 'tool') {
        toolMessages.unshift(messagesWithoutSystem[idx])
        idx--
      }

      // Skip assistant messages with tool_call_id (they're just placeholders)
      while (idx >= 0 && messagesWithoutSystem[idx].role === 'assistant' && messagesWithoutSystem[idx].tool_call_id) {
        idx--
      }

      // Build history from remaining messages
      const historyMessages = messagesWithoutSystem.slice(0, idx + 1)

      // Convert history
      let history = this.convertHistoryMessages(historyMessages)

      // Handle model-first history
      if (history.length > 0 && history[0].role === 'model') {
        const firstModelMessage = (history[0].parts[0] as { text?: string }).text || ''
        if (history.length === 1) {
          const enhancedSystemPrompt = systemPrompt
            ? `${systemPrompt}\n\n## Opening Message\nYou have already greeted the user with: "${firstModelMessage}"\nDo not repeat this greeting unless explicitly asked.`
            : `## Opening Message\nYou have already greeted the user with: "${firstModelMessage}"\nDo not repeat this greeting unless explicitly asked.`
          history = []
          systemPrompt = enhancedSystemPrompt
        } else {
          history = history.slice(1)
        }
      }

      // Create function responses for Gemini
      const functionResponses = toolMessages.map((msg) => ({
        functionResponse: {
          name: this.toGeminiSafeName(msg.name || 'unknown'),
          response: { content: msg.content },
        },
      }))

      return { systemPrompt, history, lastUserMessage: functionResponses }
    }

    // Regular user message scenario
    if (messagesWithoutSystem.length === 0 || lastMsg.role !== 'user') {
      throw new Error('Last message must be from user')
    }

    const lastUserMessage = lastMsg.content

    // Convert to Gemini format (exclude last user message as it's sent separately)
    let history = this.convertHistoryMessages(messagesWithoutSystem.slice(0, -1))

    // Gemini requires history to start with a user message, not model
    if (history.length > 0 && history[0].role === 'model') {
      const firstModelMessage = (history[0].parts[0] as { text?: string }).text || ''
      if (history.length === 1) {
        const enhancedSystemPrompt = systemPrompt
          ? `${systemPrompt}\n\n## Opening Message\nYou have already greeted the user with: "${firstModelMessage}"\nDo not repeat this greeting unless explicitly asked.`
          : `## Opening Message\nYou have already greeted the user with: "${firstModelMessage}"\nDo not repeat this greeting unless explicitly asked.`
        return { systemPrompt: enhancedSystemPrompt, history: [], lastUserMessage }
      } else {
        history = history.slice(1)
      }
    }

    return { systemPrompt, history, lastUserMessage }
  }

  private convertHistoryMessages(messages: LLMMessage[]): Array<{ role: 'user' | 'model' | 'function'; parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: { content: string } } }> }> {
    return messages
      .filter((msg) => !msg.tool_call_id || msg.role === 'tool') // Skip old-style assistant placeholder messages
      .map((msg) => {
        if (msg.role === 'tool') {
          return {
            role: 'function' as const,
            parts: [{
              functionResponse: {
                name: this.toGeminiSafeName(msg.name || 'unknown'),
                response: { content: msg.content },
              },
            }],
          }
        }
        // Assistant message that triggered tool calls → model functionCall parts
        if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
          // Use raw Content parts if available — this preserves thought_signature
          // required by Gemini thinking models (e.g. gemini-3-flash-preview)
          const rawContent = this.rawModelContents.get(msg.tool_calls[0].id)
          if (rawContent) {
            // Do NOT delete — the same instance may call generate() multiple times
            // (e.g. hesitate → real tool → final response), and each call rebuilds
            // the full history via convertHistoryMessages. Keeping the entry lets
            // subsequent calls pass thought_signature back correctly.
            return {
              role: 'model' as const,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              parts: rawContent.parts as any,
            }
          }
          // Fallback for non-thinking models or missing raw content
          return {
            role: 'model' as const,
            parts: msg.tool_calls.map((tc) => ({
              functionCall: {
                name: this.toGeminiSafeName(tc.function.name),
                args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
              },
            })),
          }
        }
        return {
          role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: msg.content }],
        }
      })
  }
}
