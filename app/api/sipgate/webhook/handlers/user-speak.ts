import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { addTranscriptMessage } from '@/lib/repositories/calls.repository'
import { generateLLMResponse } from '@/lib/services/llm-conversation'
import { hasAssistantMCPServers } from '@/lib/services/mcp-tool-executor'
import {
  startPendingMCP,
  setPendingMCPPartialTurn,
  getNextHoldMessage,
  cancelPendingMCP,
} from '@/lib/services/pending-mcp-state'
import { startHesitation, clearHesitation } from '@/lib/services/hesitation-state'
import { getPendingTurn, setPendingTurn, clearPendingTurn, isPendingTurnTimedOut } from '@/lib/services/pending-turn-state'
import {
  getVariableCollection,
  checkPendingWebhooks,
  buildValidationContext,
  buildCollectionSystemPrompt,
  updateCollectedVariable,
  setWebhookResult,
  setConfirmed,
  startWebhookValidation,
} from '@/lib/services/variable-collection-state'
import {
  extractVariablesFromUtterance,
  checkConfirmationFromUtterance,
} from '@/lib/services/variable-realtime-extractor'
import { validateWithRegex, validateWithWebhook } from '@/lib/services/variable-validation'
import { sessionState } from '@/lib/services/session-state'
import { debug } from '@/lib/utils/logger'
import { DEFAULT_ELEVENLABS_VOICE_ID, DEFAULT_TTS_PROVIDER } from '@/lib/constants/voices'
import { buildSpeakResponse, buildTTSConfig, buildAssistantMeta } from './lib/speak-response'
import { loadAssistantConfig } from './lib/routing'
import { generateScenarioGreeting, persistActiveNodeId, rebuildScenarioState } from './lib/scenario-state'
import type { UserSpeakEvent, CallSessionWithAssistant, AssistantConfig } from './lib/types'
import type { ScenarioTransferNode } from '@/lib/llm/tools/scenario-transfer-tool'

/**
 * Save tool call entries to the transcript (fire-and-forget).
 * Covers KB searches, MCP tool calls, and scenario transfers.
 */
export async function saveToolTranscriptEntries(
  callSessionId: string,
  toolCalls: Array<{ name: string; arguments: Record<string, unknown>; result: string }> | undefined,
) {
  if (!toolCalls?.length) return
  for (const tc of toolCalls) {
    let text = tc.name
    if (tc.name === 'search_knowledge_base' && tc.arguments.query) {
      text = `search_knowledge_base: "${tc.arguments.query}"`
    } else if (tc.name === 'transfer_to_agent') {
      // scenario transfer is already logged via addTranscriptMessage in the handoff path
      continue
    } else {
      const argKeys = Object.keys(tc.arguments)
      if (argKeys.length) text = `${tc.name}(${argKeys.join(', ')})`
    }
    await addTranscriptMessage({
      call_session_id: callSessionId,
      speaker: 'tool',
      text,
      metadata: { tool_name: tc.name, arguments: tc.arguments, result_preview: tc.result?.slice(0, 200) },
    }).catch(() => {})
  }
}

/**
 * Process real-time variable extraction from a user utterance.
 * Runs extraction, validates results, and checks confirmations.
 * Designed to run in parallel with the main LLM call.
 */
export async function processRealtimeExtraction(
  sessionId: string,
  userText: string,
  conversationHistory: { role: string; content: string }[],
  assistant: { llm_provider: string | null; llm_model: string | null }
): Promise<void> {
  const collection = getVariableCollection(sessionId)
  if (!collection) return

  try {
    // 1. Check for user confirmations (if any variables are pending confirmation)
    const pendingConfirmations: Array<{ name: string; value: string }> = []
    for (const [name, collected] of collection.collected.entries()) {
      if (collected.confirmed === false && collected.value) {
        pendingConfirmations.push({ name, value: collected.value })
      }
    }

    if (pendingConfirmations.length > 0) {
      const confirmations = await checkConfirmationFromUtterance(userText, pendingConfirmations)
      for (const c of confirmations) {
        setConfirmed(sessionId, c.name, c.confirmed)
      }
    }

    // 2. Extract variable values from utterance
    const extracted = await extractVariablesFromUtterance(
      userText,
      conversationHistory,
      collection.definitions,
      assistant.llm_provider || 'openai',
      assistant.llm_model || 'gpt-4o-mini'
    )

    // 3. Validate each extracted value
    for (const { name, value } of extracted) {
      const definition = collection.definitions.find((d) => d.name === name)
      if (!definition) continue

      let regexValid: boolean | null = null
      if (definition.validation_regex) {
        regexValid = validateWithRegex(value, definition.validation_regex)
      }

      updateCollectedVariable(sessionId, name, value, regexValid)

      if (regexValid !== false && definition.validation_endpoint) {
        const webhookPromise = validateWithWebhook(
          definition.validation_endpoint,
          name,
          value,
          sessionId
        ).then((result) => {
          setWebhookResult(sessionId, name, result.valid, result.message)
          return result
        })
        startWebhookValidation(sessionId, name, webhookPromise)
      }
    }
  } catch (error) {
    console.warn('[RealtimeExtraction] Error during extraction:', error)
  }
}

/**
 * Handle UserSpeak event - called when user says something.
 * Routes through MCP async path (with hold messages) or fast synchronous path.
 */
export async function handleUserSpeak(event: UserSpeakEvent) {
  debug('🗣️  User Speak:', event)

  const bargeIn = sessionState.getBargeInConfig(event.session.id)
  const supabase = createServiceRoleClient()

  const { data: sessionData } = await supabase
    .from('call_sessions')
    .select(`
      *,
      assistants (
        id,
        name,
        avatar_url,
        llm_provider,
        llm_model,
        llm_temperature,
        system_prompt,
        voice_provider,
        voice_id,
        voice_language
      )
    `)
    .eq('session_id', event.session.id)
    .single()

  const session = sessionData as unknown as CallSessionWithAssistant | null

  if (!session) {
    console.error('Call session not found:', event.session.id)
    return NextResponse.json({
      type: 'speak',
      session_id: event.session.id,
      text: 'Sorry, there was an error processing your request.',
      tts: { provider: DEFAULT_TTS_PROVIDER, voice: DEFAULT_ELEVENLABS_VOICE_ID },
    })
  }

  const wasBargeIn = sessionState.wasBargeInOccurred(event.session.id)
  sessionState.clearBargeInOccurred(event.session.id)

  // Semantic EOT: if a partial turn is pending AND no barge-in (barge-in = user started fresh),
  // combine the accumulated partial text with the new utterance.
  const pendingPartial = wasBargeIn ? null : getPendingTurn(event.session.id)
  const effectiveUserText = pendingPartial ? `${pendingPartial} ${event.text}` : event.text
  clearPendingTurn(event.session.id)

  const userTranscriptMetadata: Record<string, unknown> = {
    ...event,
    ...(wasBargeIn ? { barge_in: true } : {}),
    ...(pendingPartial ? { combined_from_partial: true } : {}),
  }
  const { id: userTranscriptId } = await addTranscriptMessage({
    call_session_id: session.id,
    speaker: 'user',
    text: effectiveUserText,
    metadata: userTranscriptMetadata,
  })

  // Determine active assistant: for scenario sessions, use the active node's assistant.
  // Rebuild scenarioState from DB if missing (e.g. different serverless instance).
  let scenarioState = sessionState.getScenarioState(event.session.id)
  if (!scenarioState && session.scenario_id) {
    scenarioState = await rebuildScenarioState(session, event.session.id) ?? undefined
  }
  let assistant: AssistantConfig = session.assistants

  if (scenarioState) {
    const activeNode = scenarioState.nodes.find((n) => n.id === scenarioState!.activeNodeId)
    if (activeNode?.data.assistant_id) {
      const scenarioAssistant = await loadAssistantConfig(activeNode.data.assistant_id)
      if (scenarioAssistant) {
        if (activeNode.data.inherit_voice) {
          assistant = {
            ...scenarioAssistant,
            voice_provider: scenarioState.entryVoiceConfig.voice_provider,
            voice_id: scenarioState.entryVoiceConfig.voice_id,
            voice_language: scenarioState.entryVoiceConfig.voice_language,
          }
        } else {
          assistant = scenarioAssistant
        }
      }
    }
  }

  if (!assistant) {
    console.error('No active assistant for session:', event.session.id)
    return NextResponse.json({
      type: 'speak',
      session_id: event.session.id,
      text: 'Sorry, there was an error processing your request.',
      tts: { provider: DEFAULT_TTS_PROVIDER, voice: DEFAULT_ELEVENLABS_VOICE_ID },
    })
  }

  // Build reachable scenario nodes for transfer tool (only in scenario mode)
  let scenarioTransferNodes: ScenarioTransferNode[] | undefined
  if (scenarioState) {
    const outboundEdges = scenarioState.edges.filter((e) => e.source === scenarioState!.activeNodeId)
    scenarioTransferNodes = outboundEdges
      .map((edge) => {
        const targetNode = scenarioState!.nodes.find((n) => n.id === edge.target)
        if (!targetNode) return null
        if (targetNode.type === 'phone_transfer') {
          return {
            nodeId: targetNode.id,
            label: targetNode.data.label || 'External Transfer',
            transferInstruction: targetNode.data.transfer_instruction || '',
            isPhoneTransfer: true,
            targetPhoneNumber: targetNode.data.target_phone_number,
            callerIdName: targetNode.data.caller_id_name,
            callerIdNumber: targetNode.data.caller_id_number,
          }
        }
        if (!targetNode.data.assistant_id) return null
        return {
          nodeId: targetNode.id,
          assistantId: targetNode.data.assistant_id,
          label: targetNode.data.label || 'Agent',
          transferInstruction: targetNode.data.transfer_instruction || '',
          inheritVoice: targetNode.data.inherit_voice,
        }
      })
      .filter(Boolean) as ScenarioTransferNode[]
  }

  // Check pending webhook results from previous turn
  const collection = getVariableCollection(event.session.id)
  if (collection) {
    await checkPendingWebhooks(event.session.id)
  }

  // Cancel any existing pending MCP or hesitation (user asked a new question)
  cancelPendingMCP(event.session.id)
  clearHesitation(event.session.id)

  const hasMCP = await hasAssistantMCPServers(assistant.id)

  const userTurn = { effectiveText: effectiveUserText, transcriptId: userTranscriptId, metadata: userTranscriptMetadata }

  if (hasMCP) {
    return handleUserSpeakMCPPath(event, session, assistant, scenarioState, scenarioTransferNodes, collection, bargeIn, userTurn)
  }

  return handleUserSpeakFastPath(event, session, assistant, scenarioState, scenarioTransferNodes, collection, bargeIn, userTurn)
}

/** Context for the current user turn — computed once in handleUserSpeak, threaded into both paths. */
interface UserTurnContext {
  effectiveText: string
  transcriptId: string | undefined
  metadata: Record<string, unknown>
}

/**
 * Mark a transcript entry as a partial turn so it is excluded from future conversation history.
 * Called when the LLM returns wait_for_turn for that entry.
 */
export async function markTranscriptPartial(
  supabase: ReturnType<typeof createServiceRoleClient>,
  transcriptId: string | undefined,
  existingMetadata: Record<string, unknown>,
): Promise<void> {
  if (!transcriptId) return
  await supabase
    .from('call_transcripts')
    .update({ metadata: { ...existingMetadata, partial_turn: true } })
    .eq('id', transcriptId)
}

/**
 * MCP async path: start LLM in background, return hold message if it takes > 4s.
 */
async function handleUserSpeakMCPPath(
  event: UserSpeakEvent,
  session: CallSessionWithAssistant,
  assistant: AssistantConfig,
  scenarioState: ReturnType<typeof sessionState.getScenarioState>,
  scenarioTransferNodes: ScenarioTransferNode[] | undefined,
  collection: ReturnType<typeof getVariableCollection>,
  bargeIn: ReturnType<typeof sessionState.getBargeInConfig>,
  userTurn: UserTurnContext,
) {
  debug('[Webhook] Assistant has MCP servers - using async pattern with delayed hold')

  const supabase = createServiceRoleClient()
  const { data: transcripts } = await supabase
    .from('call_transcripts')
    .select('speaker, text, metadata')
    .eq('call_session_id', session.id)
    .order('timestamp', { ascending: true })

  const conversationHistory = transcripts
    ? transcripts
        .filter((t) =>
          (t.speaker === 'user' || t.speaker === 'assistant') &&
          !(t.metadata as Record<string, unknown> | null)?.partial_turn &&
          !(t.metadata as Record<string, unknown> | null)?.wait_for_turn_filler &&
          !(t.metadata as Record<string, unknown> | null)?.hold_message
        )
        .map((t) => ({
          role: t.speaker === 'user' ? ('user' as const) : ('assistant' as const),
          content: t.text,
        }))
    : []

  const validationContext = collection ? buildValidationContext(event.session.id) : undefined
  const collectionPrompt = collection ? buildCollectionSystemPrompt(collection.definitions) : undefined

  if (collection) {
    processRealtimeExtraction(event.session.id, event.text, conversationHistory, assistant).catch(
      (err) => console.warn('[Webhook] Realtime extraction failed (MCP path):', err)
    )
  }

  const llmStartMs = Date.now()
  const llmPromise = generateLLMResponse({
    assistantId: assistant.id,
    organizationId: session.organization_id,
    conversationHistory,
    sessionId: session.id,
    variableContext: {
      callerNumber: session.caller_number || event.session.from_phone_number,
      callDirection: event.session.direction,
    },
    variableCollectionPrompt: collectionPrompt || undefined,
    validationContext,
    scenarioTransferNodes,
    disableWaitForTurn: isPendingTurnTimedOut(event.session.id),
  }).then(result => {
    const responseLatencyMs = Date.now() - llmStartMs
    if (result.waitForTurn) {
      return { response: result.waitForTurnFiller ?? '', waitForTurn: true as const, waitForTurnFiller: result.waitForTurnFiller, callAction: undefined, scenarioTransfer: undefined, toolCalls: undefined, hesitationMessage: undefined, rawHesitateContent: undefined, usage: undefined, performance: undefined, responseLatencyMs }
    }
    if (result.error || !result.response) {
      return { response: '', error: result.error || 'No response from LLM', waitForTurn: undefined, waitForTurnFiller: undefined, callAction: undefined, scenarioTransfer: undefined, toolCalls: undefined, hesitationMessage: undefined, rawHesitateContent: undefined, usage: undefined, performance: undefined, responseLatencyMs }
    }
    return { response: result.response, waitForTurn: undefined, waitForTurnFiller: undefined, callAction: result.callAction, scenarioTransfer: result.scenarioTransfer, toolCalls: result.toolCalls, hesitationMessage: result.hesitationMessage, rawHesitateContent: result.rawHesitateContent, usage: result.usage, performance: result.performance, responseLatencyMs }
  }).catch(error => {
    console.error('[Webhook] Async LLM call failed:', error)
    return { response: '', waitForTurn: undefined, waitForTurnFiller: undefined, error: String(error), callAction: undefined, scenarioTransfer: undefined, toolCalls: undefined, hesitationMessage: undefined, rawHesitateContent: undefined, usage: undefined, performance: undefined, responseLatencyMs: Date.now() - llmStartMs }
  })

  const INITIAL_WAIT_MS = 4000
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), INITIAL_WAIT_MS))
  const quickResult = await Promise.race([llmPromise, timeoutPromise])

  if (quickResult !== null) {
    debug('[Webhook] LLM completed quickly, returning direct response')

    // Semantic EOT: user has not finished speaking — mark entry as partial and wait
    if (quickResult.waitForTurn) {
      debug('[Webhook] wait_for_turn: user utterance incomplete, storing partial turn', quickResult.waitForTurnFiller ? `filler: "${quickResult.waitForTurnFiller}"` : '(silent)')
      await markTranscriptPartial(supabase, userTurn.transcriptId, userTurn.metadata)
      setPendingTurn(event.session.id, userTurn.effectiveText)
      if (quickResult.waitForTurnFiller) {
        const speak = buildSpeakResponse(event.session.id, quickResult.waitForTurnFiller, assistant, bargeIn)
        await addTranscriptMessage({
          call_session_id: session.id,
          speaker: 'assistant',
          text: speak.cleanText,
          metadata: { wait_for_turn_filler: true },
          assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
        })
        return NextResponse.json(speak.json)
      }
      return NextResponse.json([])
    }

    if (quickResult.error) {
      const fallbackResponse = 'Es tut mir leid, es gab einen Fehler. Können Sie das bitte wiederholen?'
      await addTranscriptMessage({
        call_session_id: session.id,
        speaker: 'assistant',
        text: fallbackResponse,
        metadata: { error: quickResult.error },
        assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
      })
      return NextResponse.json({
        type: 'speak',
        session_id: event.session.id,
        text: fallbackResponse,
        tts: buildTTSConfig(assistant),
      })
    }

    if (quickResult.scenarioTransfer && scenarioState) {
      return handleScenarioTransfer({
        event, session, assistant, scenarioState, conversationHistory, bargeIn,
        targetNodeId: quickResult.scenarioTransfer.targetNodeId,
        handoffMessage: quickResult.scenarioTransfer.handoffMessage,
        response: quickResult.response,
        isQuickResponse: true,
      })
    }

    // Hesitation: LLM announced what it will do — store state for follow-up in assistant_speech_ended
    if (quickResult.hesitationMessage) {
      debug('[Webhook] LLM hesitating:', quickResult.hesitationMessage)
      startHesitation(event.session.id, {
        assistantId: assistant.id,
        organizationId: session.organization_id,
        // Do NOT include the hesitation message in history: it is injected as a fake
        // tool call in the follow-up so the model knows to proceed to the real tool.
        conversationHistory,
        sessionId: session.id,
        variableContext: {
          callerNumber: session.caller_number || event.session.from_phone_number,
          callDirection: event.session.direction,
        },
        variableCollectionPrompt: collectionPrompt || undefined,
        validationContext,
        scenarioTransferNodes,
        hesitationMessage: quickResult.hesitationMessage,
        rawHesitateContent: quickResult.rawHesitateContent,
      })
      const speak = buildSpeakResponse(event.session.id, quickResult.hesitationMessage, assistant, bargeIn)
      await addTranscriptMessage({
        call_session_id: session.id,
        speaker: 'assistant',
        text: speak.cleanText,
        metadata: { hesitation: true, response_latency_ms: quickResult.responseLatencyMs },
        assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
      })
      return NextResponse.json(speak.json)
    }

    if (quickResult.callAction) {
      const response = await handleCallAction(event, session, assistant, quickResult.response, quickResult.callAction, bargeIn, true, quickResult.usage, quickResult.performance, quickResult.responseLatencyMs)
      if (response) return response
    }

    saveToolTranscriptEntries(session.id, quickResult.toolCalls).catch(() => {})
    const speak = buildSpeakResponse(event.session.id, quickResult.response, assistant, bargeIn)
    await addTranscriptMessage({
      call_session_id: session.id,
      speaker: 'assistant',
      text: speak.cleanText,
      metadata: buildAssistantMeta(assistant, {
        usage: quickResult.usage,
        performance: quickResult.performance,
        response_latency_ms: quickResult.responseLatencyMs,
      }),
      assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
    })
    return NextResponse.json(speak.json)
  }

  // LLM taking > 4s — use hold message pattern
  debug('[Webhook] LLM taking >4s, switching to hold message pattern')
  startPendingMCP(event.session.id, llmPromise, event.text)
  // Store partial-turn data so assistant_speech_ended can handle a wait_for_turn result correctly
  if (userTurn.transcriptId) {
    setPendingMCPPartialTurn(event.session.id, userTurn.transcriptId, userTurn.effectiveText)
  }

  const language = (assistant.voice_language || 'de-DE').startsWith('de') ? 'de' : 'en'
  const holdMessage = getNextHoldMessage(event.session.id, language)

  await addTranscriptMessage({
    call_session_id: session.id,
    speaker: 'assistant',
    text: holdMessage,
    metadata: { hold_message: true, mcp_async: true },
    assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
  })

  return NextResponse.json({
    type: 'speak',
    session_id: event.session.id,
    text: holdMessage,
    tts: buildTTSConfig(assistant),
  })
}

/**
 * Fast synchronous path: no MCP servers, call LLM directly and return.
 */
async function handleUserSpeakFastPath(
  event: UserSpeakEvent,
  session: CallSessionWithAssistant,
  assistant: AssistantConfig,
  scenarioState: ReturnType<typeof sessionState.getScenarioState>,
  scenarioTransferNodes: ScenarioTransferNode[] | undefined,
  collection: ReturnType<typeof getVariableCollection>,
  bargeIn: ReturnType<typeof sessionState.getBargeInConfig>,
  userTurn: UserTurnContext,
) {
  try {
    const supabase = createServiceRoleClient()
    const { data: transcripts } = await supabase
      .from('call_transcripts')
      .select('speaker, text, metadata')
      .eq('call_session_id', session.id)
      .order('timestamp', { ascending: true })

    const conversationHistory = transcripts
      ? transcripts
          .filter((t) =>
            (t.speaker === 'user' || t.speaker === 'assistant') &&
            !(t.metadata as Record<string, unknown> | null)?.partial_turn &&
            !(t.metadata as Record<string, unknown> | null)?.wait_for_turn_filler &&
            !(t.metadata as Record<string, unknown> | null)?.hold_message
          )
          .map((t) => ({
            role: t.speaker === 'user' ? ('user' as const) : ('assistant' as const),
            content: t.text,
          }))
      : []

    debug('[Webhook] Conversation history:', JSON.stringify(conversationHistory, null, 2))
    debug('[Webhook] Total messages in history:', conversationHistory.length)

    const validationContext = collection ? buildValidationContext(event.session.id) : undefined
    const collectionPrompt = collection ? buildCollectionSystemPrompt(collection.definitions) : undefined

    if (collection) {
      processRealtimeExtraction(event.session.id, event.text, conversationHistory, assistant).catch(
        (err) => console.warn('[Webhook] Realtime extraction failed (fast path):', err)
      )
    }

    const llmStartMs = Date.now()
    const llmResult = await generateLLMResponse({
      assistantId: assistant.id,
      organizationId: session.organization_id,
      conversationHistory,
      sessionId: session.id,
      variableContext: {
        callerNumber: session.caller_number || event.session.from_phone_number,
        callDirection: event.session.direction,
      },
      variableCollectionPrompt: collectionPrompt || undefined,
      validationContext,
      scenarioTransferNodes,
      disableWaitForTurn: isPendingTurnTimedOut(event.session.id),
    })
    const responseLatencyMs = Date.now() - llmStartMs

    if (llmResult.error || (!llmResult.response && !llmResult.waitForTurn)) {
      throw new Error(llmResult.error || 'No response from LLM')
    }

    // Semantic EOT: user has not finished speaking — mark entry as partial and wait
    if (llmResult.waitForTurn) {
      debug('[Webhook] wait_for_turn (fast path): user utterance incomplete, storing partial turn', llmResult.waitForTurnFiller ? `filler: "${llmResult.waitForTurnFiller}"` : '(silent)')
      await markTranscriptPartial(supabase, userTurn.transcriptId, userTurn.metadata)
      setPendingTurn(event.session.id, userTurn.effectiveText)
      if (llmResult.waitForTurnFiller) {
        const speak = buildSpeakResponse(event.session.id, llmResult.waitForTurnFiller, assistant, bargeIn)
        await addTranscriptMessage({
          call_session_id: session.id,
          speaker: 'assistant',
          text: speak.cleanText,
          metadata: { wait_for_turn_filler: true },
          assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
        })
        return NextResponse.json(speak.json)
      }
      return NextResponse.json([])
    }

    // Hesitation: LLM announced what it will do — store state for follow-up in assistant_speech_ended
    if (llmResult.hesitationMessage) {
      debug('[Webhook] LLM hesitating (fast path):', llmResult.hesitationMessage)
      startHesitation(event.session.id, {
        assistantId: assistant.id,
        organizationId: session.organization_id,
        // Do NOT include the hesitation message in history: it is injected as a fake
        // tool call in the follow-up so the model knows to proceed to the real tool.
        conversationHistory,
        sessionId: session.id,
        variableContext: {
          callerNumber: session.caller_number || event.session.from_phone_number,
          callDirection: event.session.direction,
        },
        variableCollectionPrompt: collectionPrompt || undefined,
        validationContext,
        scenarioTransferNodes,
        hesitationMessage: llmResult.hesitationMessage,
        rawHesitateContent: llmResult.rawHesitateContent,
      })
      const speak = buildSpeakResponse(event.session.id, llmResult.hesitationMessage, assistant, bargeIn)
      await addTranscriptMessage({
        call_session_id: session.id,
        speaker: 'assistant',
        text: speak.cleanText,
        metadata: { hesitation: true, response_latency_ms: responseLatencyMs },
        assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
      })
      return NextResponse.json(speak.json)
    }

    const response = llmResult.response

    if (llmResult.scenarioTransfer && scenarioState) {
      return handleScenarioTransfer({
        event, session, assistant, scenarioState, conversationHistory, bargeIn,
        targetNodeId: llmResult.scenarioTransfer.targetNodeId,
        handoffMessage: llmResult.scenarioTransfer.handoffMessage,
        response,
        isQuickResponse: false,
        usage: llmResult.usage,
      })
    }

    if (llmResult.callAction) {
      const actionResponse = await handleCallAction(event, session, assistant, response, llmResult.callAction, bargeIn, false, llmResult.usage, llmResult.performance, responseLatencyMs)
      if (actionResponse) return actionResponse
    }

    saveToolTranscriptEntries(session.id, llmResult.toolCalls).catch(() => {})
    const speak = buildSpeakResponse(event.session.id, response, assistant, bargeIn)
    await addTranscriptMessage({
      call_session_id: session.id,
      speaker: 'assistant',
      text: speak.cleanText,
      metadata: buildAssistantMeta(assistant, {
        usage: llmResult.usage,
        performance: llmResult.performance,
        response_latency_ms: responseLatencyMs,
      }),
      assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
    })
    return NextResponse.json(speak.json)
  } catch (error) {
    console.error('Error generating LLM response:', error)

    const fallbackResponse = 'I apologize, but I encountered an error. Could you please repeat that?'
    await addTranscriptMessage({
      call_session_id: session.id,
      speaker: 'assistant',
      text: fallbackResponse,
      metadata: { error: String(error) },
      assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
    })
    return NextResponse.json({
      type: 'speak',
      session_id: event.session.id,
      text: fallbackResponse,
      tts: buildTTSConfig(assistant),
    })
  }
}

type ScenarioTransferParams = {
  event: UserSpeakEvent
  session: CallSessionWithAssistant
  assistant: AssistantConfig
  scenarioState: NonNullable<ReturnType<typeof sessionState.getScenarioState>>
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
  bargeIn: ReturnType<typeof sessionState.getBargeInConfig>
  targetNodeId: string
  handoffMessage: string | undefined
  response: string
  isQuickResponse: boolean
  usage?: unknown
}

async function handleScenarioTransfer(params: ScenarioTransferParams) {
  const { event, session, assistant, scenarioState, conversationHistory, bargeIn, targetNodeId, handoffMessage, response, isQuickResponse, usage } = params

  scenarioState.activeNodeId = targetNodeId
  persistActiveNodeId(event.session.id, targetNodeId).catch(() => {})

  const pathLabel = isQuickResponse ? 'async path' : 'fast path'
  debug(`[Webhook] Scenario transfer (${pathLabel}): switching active node to ${targetNodeId}`)

  const targetNode = scenarioState.nodes.find((n) => n.id === targetNodeId)

  // Phone transfer: speak handoff message, then forward the call to an external number
  if (targetNode?.type === 'phone_transfer') {
    const speakText = handoffMessage || response
    const rawTarget = targetNode.data.target_phone_number ?? ''
    // Flow API expects E.164 without leading +
    const targetPhoneNumber = rawTarget.startsWith('+') ? rawTarget.slice(1) : rawTarget
    sessionState.setPendingAction(event.session.id, {
      type: 'transfer',
      targetPhoneNumber,
      callerIdName: targetNode.data.caller_id_name || assistant.name,
      callerIdNumber: targetNode.data.caller_id_number || event.session.to_phone_number,
    })
    const speak = buildSpeakResponse(event.session.id, speakText, assistant, bargeIn)
    await addTranscriptMessage({
      call_session_id: session.id,
      speaker: 'assistant',
      text: speak.cleanText,
      metadata: buildAssistantMeta(assistant, {
        scenario_transfer: targetNodeId,
        phone_transfer: rawTarget,
        ...(isQuickResponse ? { quick_response: true } : { usage }),
      }),
      assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
    })
    addTranscriptMessage({
      call_session_id: session.id,
      speaker: 'tool',
      text: `phone_transfer: ${targetNode.data.label || rawTarget}`,
      metadata: { tool_name: 'phone_transfer', target_node_id: targetNodeId, target_phone_number: rawTarget },
    }).catch(() => {})
    return NextResponse.json(speak.json)
  }

  // Seamless transfer: same voice, no handoff message, call new agent immediately
  if (targetNode?.data.inherit_voice && targetNode.data.assistant_id) {
    const newAssistant = await loadAssistantConfig(targetNode.data.assistant_id)
    if (newAssistant) {
      const seamlessAssistant = {
        ...newAssistant,
        voice_provider: scenarioState.entryVoiceConfig.voice_provider,
        voice_id: scenarioState.entryVoiceConfig.voice_id,
        voice_language: scenarioState.entryVoiceConfig.voice_language,
      }
      // Strip assistant messages so new agent can't reference previous agent by name
      const seamlessHistory = conversationHistory.filter((m) => m.role === 'user')
      const seamlessResult = await generateLLMResponse({
        assistantId: newAssistant.id,
        organizationId: session.organization_id,
        conversationHistory: seamlessHistory,
        sessionId: session.id,
        variableContext: {
          callerNumber: session.caller_number || event.session.from_phone_number,
          callDirection: event.session.direction,
        },
        scenarioTransferNodes: undefined,
        seamlessTransfer: true,
      }).catch(() => null)
      const seamlessText = seamlessResult?.response || response
      const speak = buildSpeakResponse(event.session.id, seamlessText, seamlessAssistant, bargeIn)
      await addTranscriptMessage({
        call_session_id: session.id,
        speaker: 'assistant',
        text: speak.cleanText,
        metadata: buildAssistantMeta(newAssistant, {
          scenario_transfer: targetNodeId,
          seamless: true,
          ...(isQuickResponse ? { quick_response: true } : {}),
        }),
        assistant_name: newAssistant.name, assistant_avatar_url: newAssistant.avatar_url,
      })
      return NextResponse.json(speak.json)
    }
  }

  const speakText = handoffMessage || response
  if (targetNode?.data.send_greeting && targetNode.data.assistant_id) {
    scenarioState.pendingGreeting = {
      assistantId: targetNode.data.assistant_id,
      textPromise: generateScenarioGreeting(targetNode, session.organization_id, conversationHistory, speakText, session.id),
    }
  }
  const speak = buildSpeakResponse(event.session.id, speakText, assistant, bargeIn)
  await addTranscriptMessage({
    call_session_id: session.id,
    speaker: 'assistant',
    text: speak.cleanText,
    metadata: buildAssistantMeta(assistant, {
      scenario_transfer: targetNodeId,
      ...(isQuickResponse ? { quick_response: true } : { usage }),
    }),
    assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
  })
  // Tool entry after assistant speak so it appears after in the transcript
  addTranscriptMessage({
    call_session_id: session.id,
    speaker: 'tool',
    text: `transfer_to_agent: ${targetNode?.data.label || targetNodeId}`,
    metadata: { tool_name: 'transfer_to_agent', target_node_id: targetNodeId, target_label: targetNode?.data.label },
  }).catch(() => {})
  return NextResponse.json(speak.json)
}

async function handleCallAction(
  event: UserSpeakEvent,
  session: CallSessionWithAssistant,
  assistant: AssistantConfig,
  response: string,
  callAction: { type: 'hangup' | 'forward'; targetPhoneNumber?: string; callerIdName?: string; callerIdNumber?: string },
  bargeIn: ReturnType<typeof sessionState.getBargeInConfig>,
  isQuickResponse: boolean,
  usage?: unknown,
  performance?: unknown,
  responseLatencyMs?: number,
): Promise<NextResponse | null> {
  if (callAction.type === 'hangup') {
    const pathLabel = isQuickResponse ? '(async path) ' : ''
    debug(`[Webhook] Hangup action triggered ${pathLabel}— deferring until speech ends`)
    sessionState.setPendingAction(event.session.id, { type: 'hangup' })
    const speak = buildSpeakResponse(event.session.id, response, assistant, bargeIn)
    await addTranscriptMessage({
      call_session_id: session.id,
      speaker: 'assistant',
      text: speak.cleanText,
      metadata: buildAssistantMeta(assistant, {
        call_action: 'hangup',
        ...(isQuickResponse ? { quick_response: true } : {}),
        ...(usage ? { usage } : {}),
        ...(performance ? { performance } : {}),
        ...(responseLatencyMs !== undefined ? { response_latency_ms: responseLatencyMs } : {}),
      }),
      assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
    })
    return NextResponse.json(speak.json)
  }

  if (callAction.type === 'forward') {
    const pathLabel = isQuickResponse ? '(async path) ' : ''
    debug(`[Webhook] Forward action triggered ${pathLabel}— deferring until speech ends`)
    sessionState.setPendingAction(event.session.id, {
      type: 'transfer',
      targetPhoneNumber: callAction.targetPhoneNumber,
      callerIdName: callAction.callerIdName || assistant.name,
      callerIdNumber: callAction.callerIdNumber || event.session.to_phone_number,
    })
    const speak = buildSpeakResponse(event.session.id, response, assistant, bargeIn)
    await addTranscriptMessage({
      call_session_id: session.id,
      speaker: 'assistant',
      text: speak.cleanText,
      metadata: buildAssistantMeta(assistant, {
        call_action: 'forward',
        target: callAction.targetPhoneNumber,
        ...(isQuickResponse ? { quick_response: true } : {}),
        ...(usage ? { usage } : {}),
        ...(performance ? { performance } : {}),
        ...(responseLatencyMs !== undefined ? { response_latency_ms: responseLatencyMs } : {}),
      }),
      assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
    })
    return NextResponse.json(speak.json)
  }

  return null
}
