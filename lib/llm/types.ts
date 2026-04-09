/**
 * Common types for LLM provider abstraction
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string // For tool messages
  tool_call_id?: string // For tool responses
  tool_calls?: LLMToolCall[] // For assistant messages that triggered tool calls
}

export interface LLMTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, {
        type: string
        description: string
        enum?: string[]
      }>
      required: string[]
    }
  }
}

export interface LLMToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string // JSON string
  }
}

export interface LLMGenerateOptions {
  messages: LLMMessage[]
  temperature?: number
  maxTokens?: number
  stopSequences?: string[]
  tools?: LLMTool[]
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  /** Thinking level for Gemini 3 models. Use 'none' to disable thinking entirely. */
  thinkingLevel?: 'none' | 'minimal' | 'low' | 'medium' | 'high'
}

export interface LLMPerformanceMetrics {
  /** Time to first token in milliseconds (for streaming) or total time (for non-streaming) */
  ttftMs: number
  /** Total generation time in milliseconds */
  totalTimeMs: number
  /** Tokens per second (completion tokens / generation time) */
  tokensPerSecond: number
}

export interface LLMGenerateResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  tool_calls?: LLMToolCall[]
  finish_reason?: 'stop' | 'tool_calls' | 'length'
  /** Performance metrics for this generation */
  performance?: LLMPerformanceMetrics
  /** The model that was used for this generation */
  model?: string
}

export interface LLMProvider {
  generate(options: LLMGenerateOptions): Promise<LLMGenerateResponse>
}

/**
 * Return type of generateLLMResponse — includes response text, usage stats,
 * tool call records, optional call control actions, and performance metrics.
 */
export interface LLMResponseResult {
  response: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  toolCalls?: Array<{
    name: string
    arguments: Record<string, unknown>
    result: string
  }>
  error?: string
  // Call control actions
  callAction?: {
    type: 'hangup' | 'forward'
    // For hangup
    farewellMessage?: string
    // For forward
    targetPhoneNumber?: string
    callerIdName?: string
    callerIdNumber?: string
    handoffMessage?: string
  }
  // Scenario transfer action (agent handoff within a call scenario)
  scenarioTransfer?: {
    targetNodeId: string
    handoffMessage?: string
  }
  // Performance metrics
  performance?: {
    ttftMs: number
    totalTimeMs: number
    tokensPerSecond: number
  }
  // Model used
  model?: string
  /**
   * Set when the LLM called the `hesitate` tool instead of a real tool.
   * The caller should speak this message and then re-run the LLM (with disableHesitation: true)
   * so the real tool call happens in the next turn.
   */
  hesitationMessage?: string
}
