import { debug } from '@/lib/utils/logger'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createLLMProvider } from '@/lib/llm/provider'
import type { LLMMessage, LLMTool, LLMResponseResult } from '@/lib/llm/types'
import {
  knowledgeBaseSearchTool,
  executeKnowledgeBaseSearch,
} from '@/lib/llm/tools/knowledge-base-tool'
import { MCPToolExecutor, createMCPToolExecutor } from './mcp-tool-executor'
import { isMCPTool } from '@/lib/mcp'
import { hesitateToolDefinition, isHesitateTool } from '@/lib/llm/tools/hesitate-tool'
import { waitForTurnToolDefinition, isWaitForTurnTool } from '@/lib/llm/tools/wait-for-turn-tool'
import { substitutePromptVariables, PromptVariableContext } from '@/lib/utils/prompt-variables'
import { PromptBuilder } from '@/lib/llm/prompt-builder'
import { getCallContextData } from './context-webhook'
import { getCallToolConfigServiceRole, createCallNote } from '@/lib/actions/call-tools'
import {
  buildCallControlTools,
  isCallControlTool,
  CALL_CONTROL_TOOL_NAMES,
  type HangupToolArgs,
  type ForwardToolArgs,
  type NoteToolArgs,
} from '@/lib/llm/tools/call-control-tools'
import {
  buildScenarioTransferTool,
  isScenarioTransferTool,
  type ScenarioTransferNode,
  type ScenarioTransferToolArgs,
} from '@/lib/llm/tools/scenario-transfer-tool'
import type { CallToolConfig } from '@/types/call-tools'

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Generate LLM response based on conversation history
 *
 * This is the core logic extracted from the webhook handler,
 * made reusable for both real calls and test chats.
 *
 * @param params.assistantId - The assistant to use for generating the response
 * @param params.organizationId - Organization ID for KB search analytics
 * @param params.conversationHistory - Array of conversation messages in chronological order
 * @param params.sessionId - Optional session ID for KB/MCP analytics tracking (call_session_id)
 * @param params.testSessionId - Optional test session ID for test chat analytics
 * @param params.variableContext - Optional context for prompt variable substitution
 * @returns LLM response with usage stats or error
 */
export async function generateLLMResponse(params: {
  assistantId: string
  organizationId: string
  conversationHistory: ConversationMessage[]
  sessionId?: string
  testSessionId?: string
  variableContext?: PromptVariableContext
  promptOverride?: string
  variableCollectionPrompt?: string  // Persistent instruction for mandatory field collection
  validationContext?: string          // Dynamic status updates injected each turn
  scenarioTransferNodes?: ScenarioTransferNode[]  // Reachable agent nodes for scenario-based transfer
  seamlessTransfer?: boolean  // When true, suppress self-introduction (caller doesn't know they were transferred)
  disableHesitation?: boolean  // When true, skip hesitate tool (used for follow-up calls after hesitation)
  priorHesitationMessage?: string  // When set, inject a fake hesitate tool-call + result into messages so the model knows to proceed to the real tool
  rawHesitateContent?: unknown  // Raw Gemini Content from the hesitate call — restores thought_signature for Gemini 3 thinking models
}): Promise<LLMResponseResult> {
  const supabase = createServiceRoleClient()
  let mcpExecutor: MCPToolExecutor | null = null

  try {
    // Fetch assistant configuration
    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select(`
        id,
        name,
        organization_id,
        llm_provider,
        llm_model,
        llm_temperature,
        thinking_level,
        system_prompt,
        enable_kb_tool,
        enable_hesitation,
        enable_semantic_eot
      `)
      .eq('id', params.assistantId)
      .single()

    if (assistantError || !assistant) {
      return {
        response: '',
        error: 'Assistant not found',
      }
    }

    // Build messages array for LLM
    const messages: LLMMessage[] = []

    // Fetch call tool config early — needed for prompt building (withCallControlRules)
    let callToolConfig: CallToolConfig | null = null
    if (params.sessionId) {
      callToolConfig = await getCallToolConfigServiceRole(assistant.id)
    }

    // Fetch context data from webhook (if available for this call)
    let contextData: Record<string, unknown> | null = null
    if (params.sessionId) {
      contextData = await getCallContextData(params.sessionId)
      if (contextData && Object.keys(contextData).length > 0) {
        debug('[LLM Service] Context data loaded:', Object.keys(contextData))
      }
    }

    // Add system prompt if exists (with variable substitution)
    // Use promptOverride if provided (for testing prompt changes)
    const basePrompt = params.promptOverride || assistant.system_prompt
    if (basePrompt) {
      // Build variable context with assistant name and webhook context data
      const variableContext: PromptVariableContext = {
        ...params.variableContext,
        assistantName: assistant.name,
        // Merge webhook context data into custom variables
        custom: {
          ...params.variableContext?.custom,
          ...(contextData ? Object.fromEntries(Object.entries(contextData).map(([k, v]) => [k, String(v)])) : {}),
        },
      }

      // Substitute variables in the system prompt
      const processedPrompt = substitutePromptVariables(
        basePrompt,
        variableContext
      )

      // Assemble the system prompt from all optional parts.
      // IMPORTANT: All parts must be in the initial system prompt, NOT as separate system messages.
      // Late system messages after conversation history can be echoed by the model.
      const fullPrompt = new PromptBuilder(processedPrompt)
        .withVariableCollection(params.variableCollectionPrompt)
        .withValidationContext(params.validationContext)
        .withFlowTransferRules(params.scenarioTransferNodes)
        .withCallControlRules(callToolConfig)
        .withSeamlessTransfer(params.seamlessTransfer)
        .withHesitation(assistant.enable_hesitation && !params.disableHesitation)
        .withSemanticEndOfTurn(!!assistant.enable_semantic_eot)
        .withSpellingInstruction()
        .build()

      messages.push({
        role: 'system',
        content: fullPrompt,
      })

      // Log variable substitution if any occurred
      if (processedPrompt !== assistant.system_prompt) {
        debug('[LLM Service] Prompt variables substituted:', {
          callerNumber: variableContext.callerNumber,
          assistantName: variableContext.assistantName,
          contextKeys: contextData ? Object.keys(contextData) : [],
        })
      }
      if (params.variableCollectionPrompt || params.validationContext) {
        debug('[LLM Service] Variable collection context appended to system prompt')
      }
      if (params.seamlessTransfer) {
        debug('[LLM Service] Seamless transfer: suppressing self-introduction')
      }
    }

    // Add conversation history
    for (const message of params.conversationHistory) {
      messages.push({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content,
      })
    }

    // Hesitation follow-up: inject the prior hesitate tool call + result so the model
    // knows it already made the announcement and should now call the actual tool.
    // Without this, some models (e.g. Gemini 2.5 Flash) generate an empty response
    // because they "want" to call hesitate but the tool is disabled.
    let preloadedRawContents: Map<string, unknown> | undefined
    if (params.priorHesitationMessage && params.disableHesitation) {
      const fakeHesitateCallId = 'prior-hesitation-call'
      messages.push({
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: fakeHesitateCallId,
            type: 'function',
            function: {
              name: 'hesitate',
              arguments: JSON.stringify({ message: params.priorHesitationMessage }),
            },
          },
        ],
      })
      messages.push({
        role: 'tool',
        content: 'Announcement delivered to user. Now call the appropriate tool to fulfill the request.',
        tool_call_id: fakeHesitateCallId,
        name: 'hesitate',
      })
      // For Gemini 3 thinking models: restore the original raw Content (with thought_signature)
      // so convertHistoryMessages can pass it back unchanged, avoiding a 400 error.
      if (params.rawHesitateContent) {
        preloadedRawContents = new Map([[fakeHesitateCallId, params.rawHesitateContent]])
      }
      debug('[LLM Service] Injected prior hesitation context:', params.priorHesitationMessage)
    }

    // Seamless transfer: inject a late system message right after the conversation history.
    // Being the last thing the model reads before generating, this overrides any greeting
    // examples or introduction templates buried in the system prompt.
    if (params.seamlessTransfer) {
      messages.push({
        role: 'system',
        content:
          'LETZTE ANWEISUNG (höchste Priorität): Beginne deine Antwort OHNE jede Begrüßung, OHNE deinen Namen zu nennen und OHNE auf andere Agenten oder Kollegen zu verweisen. Antworte ausschließlich auf das zuletzt Gesagte.',
      })
    }

    // Debug: Log messages being sent to LLM
    debug('[LLM Service] Messages to LLM:', JSON.stringify(messages.map(m => ({ role: m.role, content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '') })), null, 2))
    debug('[LLM Service] Total messages:', messages.length)

    // Create LLM provider with assistant's configuration
    const llmProvider = createLLMProvider({
      provider: (assistant.llm_provider || 'openai') as 'openai' | 'google',
      model: assistant.llm_model || 'gpt-5',
      temperature: assistant.llm_temperature ?? 0.7,
    })

    // Build tools array
    const allTools: LLMTool[] = []
    const toolCallResults: Array<{
      name: string
      arguments: Record<string, unknown>
      result: string
    }> = []

    // Check if assistant has knowledge bases assigned
    const { data: kbAssignments } = await supabase
      .from('assistant_knowledge_bases')
      .select('knowledge_base_id')
      .eq('assistant_id', assistant.id)
      .limit(1)

    const hasKnowledgeBases = kbAssignments && kbAssignments.length > 0

    // Add KB tool if available
    if (hasKnowledgeBases && assistant.enable_kb_tool !== false) {
      allTools.push(knowledgeBaseSearchTool)
    }

    // Initialize MCP tools
    mcpExecutor = createMCPToolExecutor()
    const { tools: mcpTools, errors: mcpErrors } = await mcpExecutor.initialize(
      assistant.id,
      params.organizationId
    )

    if (mcpErrors.length > 0) {
      console.warn('[LLM Service] MCP initialization errors:', mcpErrors)
    }

    allTools.push(...mcpTools)

    // Add hesitate tool when enabled for this assistant and tools are present (KB or MCP)
    const hasTools = mcpTools.length > 0 || (hasKnowledgeBases && assistant.enable_kb_tool !== false)
    if (assistant.enable_hesitation && hasTools && !params.disableHesitation) {
      allTools.unshift(hesitateToolDefinition)
      debug('[LLM Service] Hesitate tool enabled')
    }

    // Add wait_for_turn tool when semantic end-of-turn detection is enabled
    if (assistant.enable_semantic_eot) {
      allTools.unshift(waitForTurnToolDefinition)
      debug('[LLM Service] Semantic EOT (wait_for_turn) tool enabled')
    }

    // Add call control tools (only for real calls, not test chats)
    if (callToolConfig) {
      const callControlTools = buildCallControlTools(callToolConfig)
      allTools.push(...callControlTools)
      debug('[LLM Service] Call control tools enabled:', callControlTools.map(t => t.function.name))
    }

    // Add scenario transfer tool if running in scenario mode with reachable nodes
    if (params.scenarioTransferNodes && params.scenarioTransferNodes.length > 0) {
      allTools.push(buildScenarioTransferTool(params.scenarioTransferNodes))
      debug('[LLM Service] Scenario transfer tool enabled for nodes:', params.scenarioTransferNodes.map(n => n.nodeId))
    }

    debug('[LLM Service] Tools available:', {
      knowledgeBase: hasKnowledgeBases && assistant.enable_kb_tool !== false ? 1 : 0,
      mcp: mcpTools.length,
      callControl: callToolConfig ? buildCallControlTools(callToolConfig).length : 0,
      scenarioTransfer: params.scenarioTransferNodes?.length ?? 0,
      total: allTools.length,
    })

    // Determine thinking level for Gemini models
    // Only Gemini 3 preview models support thinkingLevel (stable 2.5 versions do NOT)
    const isGeminiThinkingModel = assistant.llm_model?.includes('gemini-3') && assistant.llm_model?.includes('preview')
    let thinkingLevel: 'minimal' | 'low' | 'medium' | 'high' | undefined = undefined

    if (isGeminiThinkingModel) {
      if (assistant.thinking_level && assistant.thinking_level !== 'auto') {
        // Use configured level
        thinkingLevel = assistant.thinking_level as 'minimal' | 'low' | 'medium' | 'high'
      } else {
        // Default to 'low' for voice latency optimization
        thinkingLevel = 'low'
      }
    }

    // Generate response with tools if available
    let llmResponse = await llmProvider.generate({
      messages,
      temperature: assistant.llm_temperature ?? 0.7,
      maxTokens: 4000, // High limit to accommodate Gemini's thinking tokens + response
      tools: allTools.length > 0 ? allTools : undefined,
      thinkingLevel,
      preloadedRawContents,
    })

    // Handle tool calls (KB, MCP, and Call Control tools)
    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      // wait_for_turn tool: user has not finished speaking — signal caller to wait for more input.
      const waitForTurnCall = llmResponse.tool_calls.find((tc) => isWaitForTurnTool(tc.function.name))
      if (waitForTurnCall) {
        const waitArgs = JSON.parse(waitForTurnCall.function.arguments || '{}') as { message?: string }
        const filler = waitArgs.message?.trim() || undefined
        debug('[LLM Service] wait_for_turn tool called — user utterance is incomplete', filler ? `filler: "${filler}"` : '(silent)')
        return { response: filler ?? '', waitForTurn: true, ...(filler ? { waitForTurnFiller: filler } : {}) }
      }

      // Hesitate tool: LLM wants to announce what it's doing before calling the real tool.
      // Return the hesitation message immediately — the caller will speak it and re-run the LLM.
      const hesitateCall = llmResponse.tool_calls.find((tc) => isHesitateTool(tc.function.name))
      if (hesitateCall) {
        const hesitateArgs = JSON.parse(hesitateCall.function.arguments) as { message: string }
        debug('[LLM Service] Hesitate tool called:', hesitateArgs.message)
        return {
          response: hesitateArgs.message,
          hesitationMessage: hesitateArgs.message,
          rawHesitateContent: llmResponse.rawToolCallContent,
        }
      }

      // Hesitation enforcement: model skipped the hesitate tool despite instructions.
      // Return an error for every tool call so the model is forced to call hesitate first.
      // Skip enforcement if all tool calls are call control actions or scenario transfers — those execute immediately without hesitation.
      const hasNonCallControlCall = llmResponse.tool_calls!.some(tc => !isCallControlTool(tc.function.name) && !isScenarioTransferTool(tc.function.name) && !isWaitForTurnTool(tc.function.name))
      if (assistant.enable_hesitation && !params.disableHesitation && hasNonCallControlCall) {
        debug('[LLM Service] Enforcing hesitation — returning error for skipped hesitate tool')
        messages.push({
          role: 'assistant',
          content: '',
          tool_calls: llmResponse.tool_calls,
        })
        for (const toolCall of llmResponse.tool_calls) {
          messages.push({
            role: 'tool',
            content: 'Error: You must call the `hesitate` tool first before calling any other tool.',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
          })
        }
        // Re-run LLM — it should now call hesitate
        llmResponse = await llmProvider.generate({
          messages,
          temperature: assistant.llm_temperature ?? 0.7,
          maxTokens: 4000,
          tools: allTools.length > 0 ? allTools : undefined,
          thinkingLevel,
        })
        // Check again for hesitate call
        const hesitateRetry = llmResponse.tool_calls?.find((tc) => isHesitateTool(tc.function.name))
        if (hesitateRetry) {
          const hesitateArgs = JSON.parse(hesitateRetry.function.arguments) as { message: string }
          debug('[LLM Service] Hesitate tool called after enforcement:', hesitateArgs.message)
          return {
            response: hesitateArgs.message,
            hesitationMessage: hesitateArgs.message,
            rawHesitateContent: llmResponse.rawToolCallContent,
          }
        }
        // Model still didn't call hesitate — fall through to normal tool execution
        debug('[LLM Service] Hesitation enforcement failed — proceeding without hesitation')
        if (!llmResponse.tool_calls?.length) {
          // Model returned a text response after enforcement — skip tool execution
          return { response: llmResponse.content }
        }
      }

      // Add consolidated assistant message with all tool_calls so providers (especially
      // Gemini) can reconstruct the functionCall → functionResponse sequence in history.
      const pendingToolCalls = llmResponse.tool_calls!
      messages.push({
        role: 'assistant',
        content: '',
        tool_calls: pendingToolCalls,
      })

      for (const toolCall of pendingToolCalls) {
        let toolResult: string

        // Check for call control tools first - they need special handling
        if (isCallControlTool(toolCall.function.name)) {
          const args = JSON.parse(toolCall.function.arguments)

          if (toolCall.function.name === CALL_CONTROL_TOOL_NAMES.HANGUP) {
            // Hangup tool - immediately return with hangup action
            const hangupArgs = args as HangupToolArgs
            debug('[LLM Service] Hangup tool called:', hangupArgs)

            return {
              response: hangupArgs.farewell_message || 'Goodbye!',
              callAction: {
                type: 'hangup',
                farewellMessage: hangupArgs.farewell_message,
              },
              toolCalls: [{
                name: toolCall.function.name,
                arguments: args,
                result: 'Call will be ended',
              }],
            }
          }

          if (toolCall.function.name === CALL_CONTROL_TOOL_NAMES.FORWARD) {
            // Forward tool - immediately return with forward action
            const forwardArgs = args as ForwardToolArgs
            debug('[LLM Service] Forward tool called:', forwardArgs)

            if (!callToolConfig?.forward_phone_number) {
              toolResult = 'Error: No forward phone number configured'
              toolCallResults.push({
                name: toolCall.function.name,
                arguments: args,
                result: toolResult,
              })
            } else {
              return {
                response: forwardArgs.handoff_message || 'I\'ll transfer you now.',
                callAction: {
                  type: 'forward',
                  targetPhoneNumber: callToolConfig.forward_phone_number,
                  callerIdName: callToolConfig.forward_caller_id_name || undefined,
                  callerIdNumber: callToolConfig.forward_caller_id_number || undefined,
                  handoffMessage: forwardArgs.handoff_message,
                },
                toolCalls: [{
                  name: toolCall.function.name,
                  arguments: args,
                  result: `Transferring to ${callToolConfig.forward_phone_number}`,
                }],
              }
            }
          }

          if (toolCall.function.name === CALL_CONTROL_TOOL_NAMES.TAKE_NOTE) {
            // Take note tool - save the note and continue
            const noteArgs = args as NoteToolArgs
            debug('[LLM Service] Take note tool called:', noteArgs)

            if (params.sessionId) {
              // Get the last few messages for context
              const recentMessages = params.conversationHistory.slice(-3)
              const context = recentMessages.map(m => `${m.role}: ${m.content.substring(0, 100)}`).join('\n')

              const { error } = await createCallNote({
                call_session_id: params.sessionId,
                organization_id: params.organizationId,
                assistant_id: assistant.id,
                content: noteArgs.content,
                category: noteArgs.category,
                priority: noteArgs.priority,
                conversation_context: context,
              })

              if (error) {
                toolResult = `Error saving note: ${error}`
              } else {
                toolResult = 'Note saved successfully'
              }
            } else {
              toolResult = 'Note saved (test mode)'
            }

            toolCallResults.push({
              name: toolCall.function.name,
              arguments: args,
              result: toolResult,
            })

            // Continue processing - add tool result to messages for final response
            messages.push({
              role: 'tool',
              content: toolResult,
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            })
            continue
          }
        }

        // Check for scenario transfer tool
        if (isScenarioTransferTool(toolCall.function.name)) {
          const transferArgs = JSON.parse(toolCall.function.arguments) as ScenarioTransferToolArgs
          debug('[LLM Service] Scenario transfer tool called:', transferArgs)

          return {
            response: transferArgs.handoff_message || 'Let me connect you with the right agent.',
            scenarioTransfer: {
              targetNodeId: transferArgs.agent_node_id,
              handoffMessage: transferArgs.handoff_message,
            },
            toolCalls: [{
              name: toolCall.function.name,
              arguments: transferArgs as unknown as Record<string, unknown>,
              result: `Transferring to agent node ${transferArgs.agent_node_id}`,
            }],
            usage: llmResponse.usage
              ? {
                  promptTokens: llmResponse.usage.promptTokens,
                  completionTokens: llmResponse.usage.completionTokens,
                  totalTokens: llmResponse.usage.totalTokens,
                }
              : undefined,
            performance: llmResponse.performance,
            model: llmResponse.model,
          }
        }

        if (toolCall.function.name === 'search_knowledge_base') {
          // Knowledge Base tool
          const args = JSON.parse(toolCall.function.arguments)
          toolResult = await executeKnowledgeBaseSearch(
            assistant.id,
            params.organizationId,
            args.query,
            params.sessionId
          )
          toolCallResults.push({
            name: toolCall.function.name,
            arguments: args,
            result: toolResult,
          })
        } else if (isMCPTool(toolCall.function.name)) {
          // MCP tool (namespaced with server name)
          const args = JSON.parse(toolCall.function.arguments)
          toolResult = await mcpExecutor.executeTool(
            toolCall.function.name,
            args,
            params.organizationId,
            assistant.id,
            params.sessionId,
            params.testSessionId
          )
          toolCallResults.push({
            name: toolCall.function.name,
            arguments: args,
            result: toolResult,
          })
        } else if (!isCallControlTool(toolCall.function.name)) {
          // Unknown tool (not a call control tool we already handled)
          toolResult = `Error: Unknown tool "${toolCall.function.name}"`
          toolCallResults.push({
            name: toolCall.function.name,
            arguments: {},
            result: toolResult,
          })
        } else {
          continue // Skip already handled call control tools
        }

        // Add tool result to messages
        messages.push({
          role: 'tool',
          content: toolResult,
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        })
      }

      // Generate final response with tool results (no tools in this call)
      llmResponse = await llmProvider.generate({
        messages,
        temperature: assistant.llm_temperature ?? 0.7,
        maxTokens: 4000,
        thinkingLevel,
      })
    }

    // Debug logging
    debug('[LLM Conversation] Final response:', {
      response_length: llmResponse.content.length,
      finish_reason: llmResponse.finish_reason,
      usage: llmResponse.usage,
      toolCalls: toolCallResults.length,
      performance: llmResponse.performance,
      model: llmResponse.model,
    })

    return {
      response: llmResponse.content,
      usage: llmResponse.usage
        ? {
            promptTokens: llmResponse.usage.promptTokens,
            completionTokens: llmResponse.usage.completionTokens,
            totalTokens: llmResponse.usage.totalTokens,
          }
        : undefined,
      toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
      performance: llmResponse.performance,
      model: llmResponse.model,
    }
  } catch (error) {
    console.error('Error generating LLM response:', error)
    return {
      response: '',
      error: String(error),
    }
  } finally {
    // Cleanup MCP sessions
    if (mcpExecutor) {
      await mcpExecutor.cleanup()
    }
  }
}

