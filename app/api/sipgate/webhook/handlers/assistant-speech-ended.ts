import { NextResponse } from 'next/server'
import { debug } from '@/lib/utils/logger'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { addTranscriptMessage } from '@/lib/repositories/calls.repository'
import {
  hasPendingMCP,
  waitForMCPWithTimeout,
  waitForPendingMCP,
  getPendingMCPElapsedMs,
  getNextHoldMessage,
  cancelPendingMCP,
  startPendingMCP,
} from '@/lib/services/pending-mcp-state'
import {
  hasHesitationState,
  getHesitationState,
  clearHesitation,
} from '@/lib/services/hesitation-state'
import { generateLLMResponse } from '@/lib/services/llm-conversation'
import { sessionState } from '@/lib/services/session-state'
import { HANGUP_CLICK_AUDIO_BASE64 } from '@/lib/services/hangup-audio'
import { buildSpeakResponse, buildTTSConfig } from './lib/speak-response'
import { loadAssistantConfig } from './lib/routing'
import { persistActiveNodeId, generateScenarioGreeting } from './lib/scenario-state'
import { saveToolTranscriptEntries } from './user-speak'
import type { AssistantSpeechEndedEvent, CallSessionWithAssistant } from './lib/types'

/**
 * Handle AssistantSpeechEnded event - called when assistant finishes speaking.
 * Executes deferred call actions (hangup/transfer), delivers pending flow greetings,
 * and returns the next MCP response if one is ready.
 */
export async function handleAssistantSpeechEnded(event: AssistantSpeechEndedEvent) {
  debug('🔊 Assistant Speech Ended:', event.session.id)

  const sessionId = event.session.id
  const bargeIn = sessionState.getBargeInConfig(sessionId)

  // Execute deferred call actions (hangup/transfer deferred until speech finishes)
  const pendingAction = sessionState.getPendingAction(sessionId)
  if (pendingAction) {
    if (pendingAction.type === 'hangup' && !pendingAction.clickPlayed) {
      // First stage: play click sound, then hangup on next assistant_speech_ended
      debug(`[AssistantSpeechEnded] Playing hangup click for session ${sessionId}`)
      pendingAction.clickPlayed = true
      return NextResponse.json({
        type: 'audio',
        session_id: sessionId,
        audio: HANGUP_CLICK_AUDIO_BASE64,
        barge_in: { strategy: 'none' },
      })
    }

    sessionState.deletePendingAction(sessionId)
    debug(`[AssistantSpeechEnded] Executing deferred ${pendingAction.type} for session ${sessionId}`)

    if (pendingAction.type === 'hangup') {
      return NextResponse.json({ type: 'hangup', session_id: sessionId })
    }

    if (pendingAction.type === 'transfer') {
      return NextResponse.json({
        type: 'transfer',
        session_id: sessionId,
        target_phone_number: pendingAction.targetPhoneNumber,
        caller_id_name: pendingAction.callerIdName,
        caller_id_number: pendingAction.callerIdNumber,
      })
    }
  }

  // Check for a pending greeting from a scenario transfer
  const scenarioState = sessionState.getScenarioState(sessionId)
  if (scenarioState?.pendingGreeting) {
    const { assistantId, textPromise } = scenarioState.pendingGreeting
    scenarioState.pendingGreeting = undefined
    const greetingNode = scenarioState.nodes.find((n) => n.data.assistant_id === assistantId)
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    const [greetingAssistant, greetingText] = await Promise.all([
      loadAssistantConfig(assistantId),
      Promise.race([textPromise, timeout]),
    ])
    debug(`[AssistantSpeechEnded] Greeting: assistantId=${assistantId}, text=${greetingText ? greetingText.slice(0, 60) : 'null'}`)
    if (greetingAssistant && greetingText) {
      const speakAssistant = greetingNode?.data.inherit_voice
        ? {
            ...greetingAssistant,
            voice_provider: scenarioState.entryVoiceConfig.voice_provider,
            voice_id: scenarioState.entryVoiceConfig.voice_id,
            voice_language: scenarioState.entryVoiceConfig.voice_language,
          }
        : greetingAssistant
      const supabaseForGreeting = createServiceRoleClient()
      const { data: greetingSession } = await supabaseForGreeting
        .from('call_sessions')
        .select('id')
        .eq('session_id', sessionId)
        .single()
      if (greetingSession) {
        await addTranscriptMessage({
          call_session_id: greetingSession.id,
          speaker: 'assistant',
          text: greetingText,
          metadata: { scenario_greeting: true },
          assistant_name: greetingAssistant.name, assistant_avatar_url: greetingAssistant.avatar_url,
        })
      }
      return NextResponse.json(buildSpeakResponse(sessionId, greetingText, speakAssistant, bargeIn).json)
    }
  }

  // Hesitation follow-up: LLM previously announced what it was going to do.
  // Now run the real LLM call (with disableHesitation: true so the actual tool gets called).
  if (hasHesitationState(sessionId)) {
    debug('[AssistantSpeechEnded] Hesitation state found — running follow-up LLM call')
    const hesitationParams = getHesitationState(sessionId)!
    clearHesitation(sessionId)

    const followUpPromise = generateLLMResponse({
      ...hesitationParams,
      disableHesitation: true,
      priorHesitationMessage: hesitationParams.hesitationMessage,
    }).then((result) => {
      if (result.error || !result.response) {
        return { response: '', error: result.error || 'No response from LLM', callAction: undefined, scenarioTransfer: undefined, toolCalls: undefined }
      }
      return { response: result.response, callAction: result.callAction, scenarioTransfer: result.scenarioTransfer, toolCalls: result.toolCalls }
    }).catch((error) => {
      console.error('[AssistantSpeechEnded] Follow-up LLM call failed:', error)
      return { response: '', error: String(error), callAction: undefined, scenarioTransfer: undefined, toolCalls: undefined }
    })

    startPendingMCP(sessionId, followUpPromise, '[hesitation follow-up]')
  }

  if (!hasPendingMCP(sessionId)) {
    debug('[AssistantSpeechEnded] No pending MCP, returning 204')
    return new NextResponse(null, { status: 204 })
  }

  const supabase = createServiceRoleClient()

  const { data: sessionData } = await supabase
    .from('call_sessions')
    .select(`
      *,
      assistants (
        id,
        name,
        avatar_url,
        voice_provider,
        voice_id,
        voice_language
      )
    `)
    .eq('session_id', sessionId)
    .single()

  const session = sessionData as unknown as CallSessionWithAssistant | null

  if (!session || !session.assistants) {
    console.error('[AssistantSpeechEnded] Call session not found:', sessionId)
    cancelPendingMCP(sessionId)
    return new NextResponse(null, { status: 204 })
  }

  const assistant = session.assistants

  // Wait for MCP to complete (up to ~4 seconds)
  const mcpResult = await waitForMCPWithTimeout(sessionId)

  if (mcpResult !== null) {
    debug('[AssistantSpeechEnded] MCP completed, returning response')

    if (mcpResult.error) {
      const errorMessage = 'Es tut mir leid, ich konnte die Informationen nicht abrufen. Kann ich Ihnen anders helfen?'
      await addTranscriptMessage({
        call_session_id: session.id,
        speaker: 'assistant',
        text: errorMessage,
        metadata: { mcp_error: mcpResult.error },
        assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
      })
      return NextResponse.json({
        type: 'speak',
        session_id: sessionId,
        text: errorMessage,
        tts: buildTTSConfig(assistant),
      })
    }

    // Handle call control actions from hesitation follow-up (hangup/forward).
    // Defer until after the farewell speech finishes, same as the user-speak path.
    if (mcpResult.callAction) {
      if (mcpResult.callAction.type === 'hangup') {
        debug('[AssistantSpeechEnded] Hesitation follow-up returned hangup — deferring until speech ends')
        sessionState.setPendingAction(sessionId, { type: 'hangup' })
      } else if (mcpResult.callAction.type === 'forward' && mcpResult.callAction.targetPhoneNumber) {
        debug('[AssistantSpeechEnded] Hesitation follow-up returned forward — deferring until speech ends')
        sessionState.setPendingAction(sessionId, {
          type: 'transfer',
          targetPhoneNumber: mcpResult.callAction.targetPhoneNumber,
          callerIdName: mcpResult.callAction.callerIdName || assistant.name,
          callerIdNumber: mcpResult.callAction.callerIdNumber,
        })
      }
    }

    // Handle scenario transfer from hesitation follow-up (Bug 2 defensive fix:
    // Bug 1 prevents this path for normal transfers, but we handle it robustly here too)
    if (mcpResult.scenarioTransfer) {
      const deferredScenarioState = sessionState.getScenarioState(sessionId)
      if (deferredScenarioState) {
        const { targetNodeId, handoffMessage } = mcpResult.scenarioTransfer
        deferredScenarioState.activeNodeId = targetNodeId
        persistActiveNodeId(sessionId, targetNodeId).catch(() => {})

        const targetNode = deferredScenarioState.nodes.find((n) => n.id === targetNodeId)
        const speakText = handoffMessage || mcpResult.response

        if (targetNode?.data.send_greeting && targetNode.data.assistant_id) {
          const { data: transcripts } = await supabase
            .from('call_transcripts')
            .select('speaker, text')
            .eq('call_session_id', session.id)
            .order('timestamp', { ascending: true })
          const conversationHistory = (transcripts ?? [])
            .filter((t) => t.speaker === 'user' || t.speaker === 'assistant')
            .map((t) => ({ role: t.speaker as 'user' | 'assistant', content: t.text }))
          deferredScenarioState.pendingGreeting = {
            assistantId: targetNode.data.assistant_id,
            textPromise: generateScenarioGreeting(targetNode, session.organization_id, conversationHistory, speakText, session.id),
          }
        }

        const deferredSpeak = buildSpeakResponse(sessionId, speakText, assistant, bargeIn)
        await addTranscriptMessage({
          call_session_id: session.id,
          speaker: 'assistant',
          text: deferredSpeak.cleanText,
          metadata: { scenario_transfer: targetNodeId, deferred: true },
          assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
        })
        // Tool entry after assistant speak so it appears after in the transcript
        addTranscriptMessage({
          call_session_id: session.id,
          speaker: 'tool',
          text: `transfer_to_agent: ${targetNode?.data.label || targetNodeId}`,
          metadata: { tool_name: 'transfer_to_agent', target_node_id: targetNodeId, target_label: targetNode?.data.label, deferred: true },
        }).catch(() => {})
        return NextResponse.json(deferredSpeak.json)
      }
    }

    saveToolTranscriptEntries(session.id, mcpResult.toolCalls).catch(() => {})
    const mcpSpeak = buildSpeakResponse(sessionId, mcpResult.response, assistant, bargeIn)
    await addTranscriptMessage({
      call_session_id: session.id,
      speaker: 'assistant',
      text: mcpSpeak.cleanText,
      metadata: { from_mcp: true, ...(mcpResult.callAction ? { call_action: mcpResult.callAction.type } : {}) },
      assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
    })
    return NextResponse.json(mcpSpeak.json)
  }

  // MCP still in progress — check elapsed time
  const elapsedMs = getPendingMCPElapsedMs(sessionId)
  debug(`[AssistantSpeechEnded] MCP still pending after ${elapsedMs}ms`)

  if (elapsedMs > 60000) {
    debug('[AssistantSpeechEnded] Waited too long, forcing wait for MCP result')
    const result = await waitForPendingMCP(sessionId, 5000)

    if (!result || result.error) {
      const errorMessage = 'Es tut mir leid, die Suche hat zu lange gedauert. Kann ich Ihnen anders helfen?'
      await addTranscriptMessage({
        call_session_id: session.id,
        speaker: 'assistant',
        text: errorMessage,
        metadata: { mcp_timeout: true },
        assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
      })
      return NextResponse.json({
        type: 'speak',
        session_id: sessionId,
        text: errorMessage,
        tts: buildTTSConfig(assistant),
      })
    }

    saveToolTranscriptEntries(session.id, result.toolCalls).catch(() => {})
    const forcedSpeak = buildSpeakResponse(sessionId, result.response, assistant, bargeIn)
    await addTranscriptMessage({
      call_session_id: session.id,
      speaker: 'assistant',
      text: forcedSpeak.cleanText,
      metadata: { from_mcp: true, forced_wait: true },
      assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
    })
    return NextResponse.json(forcedSpeak.json)
  }

  // Still waiting — play another hold message
  const language = (assistant.voice_language || 'de-DE').startsWith('de') ? 'de' : 'en'
  const holdMessage = getNextHoldMessage(sessionId, language)

  await addTranscriptMessage({
    call_session_id: session.id,
    speaker: 'assistant',
    text: holdMessage,
    metadata: { hold_message: true },
    assistant_name: assistant.name, assistant_avatar_url: assistant.avatar_url,
  })

  return NextResponse.json({
    type: 'speak',
    session_id: sessionId,
    text: holdMessage,
    tts: buildTTSConfig(assistant),
  })
}
