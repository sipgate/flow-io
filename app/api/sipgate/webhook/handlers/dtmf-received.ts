import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { addTranscriptMessage } from '@/lib/repositories/calls.repository'
import { sessionState } from '@/lib/services/session-state'
import type { ScenarioSessionState } from '@/lib/services/session-state'
import { debug } from '@/lib/utils/logger'
import { DEFAULT_ELEVENLABS_VOICE_ID, DEFAULT_TTS_PROVIDER } from '@/lib/constants/voices'
import { generateScenarioGreeting, persistActiveNodeId, rebuildScenarioState } from './lib/scenario-state'
import { loadAssistantConfig } from './lib/routing'
import type { DTMFReceivedEvent, CallSessionWithAssistant } from './lib/types'
import type { ScenarioNode } from '@/types/scenarios'

/**
 * Persist DTMF variables to call_sessions.metadata so they survive serverless instance switches.
 */
async function persistDTMFVariables(sipgateSessionId: string, dtmfVariables: Record<string, string>): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data: current } = await supabase
    .from('call_sessions')
    .select('metadata')
    .eq('session_id', sipgateSessionId)
    .single()
  await supabase
    .from('call_sessions')
    .update({
      metadata: {
        ...(current?.metadata as Record<string, unknown> ?? {}),
        dtmf_variables: dtmfVariables,
      },
    })
    .eq('session_id', sipgateSessionId)
}

/**
 * Build a speak response using the entry voice config (DTMF nodes have no own voice).
 */
function buildDTMFSpeak(
  sessionId: string,
  text: string,
  voiceProvider: string | null,
  voiceId: string | null,
  voiceLanguage: string | null,
  userInputTimeoutSeconds?: number,
) {
  const tts: Record<string, unknown> = {
    provider: voiceProvider === 'elevenlabs' ? 'eleven_labs' : (voiceProvider || DEFAULT_TTS_PROVIDER),
    voice: voiceId || DEFAULT_ELEVENLABS_VOICE_ID,
    ...(voiceLanguage && voiceProvider !== 'elevenlabs' ? { language: voiceLanguage } : {}),
  }
  const json: Record<string, unknown> = {
    type: 'speak',
    session_id: sessionId,
    text,
    tts,
  }
  if (userInputTimeoutSeconds) {
    json.user_input_timeout_seconds = userInputTimeoutSeconds
  }
  return json
}

/**
 * After transitioning to a new node, build the appropriate response:
 * - DTMF nodes: speak their announcement text
 * - Agent nodes: speak opening_message, or generate a greeting if send_greeting is enabled
 */
async function buildNextNodeResponse(
  sessionId: string,
  nextNode: ScenarioNode | undefined,
  voiceProvider: string | null,
  voiceId: string | null,
  voiceLanguage: string | null,
  organizationId?: string,
): Promise<Record<string, unknown> | null> {
  if (!nextNode) return null

  if (nextNode.type === 'dtmf_collect' && nextNode.data.prompt) {
    return buildDTMFSpeak(
      sessionId,
      nextNode.data.prompt,
      voiceProvider,
      voiceId,
      voiceLanguage,
      nextNode.data.timeout_seconds ?? 5,
    )
  }

  if (nextNode.type === 'dtmf_menu' && nextNode.data.prompt) {
    return buildDTMFSpeak(
      sessionId,
      nextNode.data.prompt,
      voiceProvider,
      voiceId,
      voiceLanguage,
      nextNode.data.timeout_seconds ?? 10,
    )
  }

  // Agent node — speak opening_message, or generate a greeting when send_greeting is enabled
  if ((nextNode.type === 'agent' || nextNode.type === 'entry_agent') && nextNode.data.assistant_id) {
    const assistant = await loadAssistantConfig(nextNode.data.assistant_id)
    if (assistant) {
      const tts: Record<string, unknown> = {
        provider: (assistant.voice_provider === 'elevenlabs' ? 'eleven_labs' : assistant.voice_provider) || DEFAULT_TTS_PROVIDER,
        voice: assistant.voice_id || DEFAULT_ELEVENLABS_VOICE_ID,
        ...(assistant.voice_language && assistant.voice_provider !== 'elevenlabs' ? { language: assistant.voice_language } : {}),
      }

      if (assistant.opening_message) {
        return { type: 'speak', session_id: sessionId, text: assistant.opening_message, tts }
      }

      if (nextNode.data.send_greeting && organizationId) {
        const greeting = await generateScenarioGreeting(
          nextNode,
          organizationId,
          [],
          'The caller was routed here via the keypad menu.',
          sessionId,
        )
        if (greeting) {
          return { type: 'speak', session_id: sessionId, text: greeting, tts }
        }
      }
    }
  }

  // No greeting configured — caller speaks first to trigger the LLM
  return null
}

/**
 * Handle dtmf_collect node: accumulate digits, complete on max_digits or terminator.
 */
async function handleDTMFCollect(
  event: DTMFReceivedEvent,
  activeNode: ScenarioNode,
  scenarioState_: ScenarioSessionState,
  sessionId: string,
  callSessionId: string,
  organizationId: string,
): Promise<NextResponse> {
  const sid = event.session.id
  const { max_digits = 20, terminator = '#', variable_name = 'dtmfInput', timeout_seconds = 5 } = activeNode.data

  const digits = sessionState.appendDTMFDigit(sid, event.digit)
  const isTerminator = terminator && event.digit === terminator
  const isComplete = isTerminator || digits.length >= max_digits
  console.log(`[DTMF Collect] digit="${event.digit}" accumulated="${digits}" max=${max_digits} terminator="${terminator}" isComplete=${isComplete}`)

  if (!isComplete) {
    // Still collecting — 204 No Content signals sipgate to keep listening for more digits
    return new NextResponse(null, { status: 204 })
  }

  // Strip terminator from collected value
  const finalValue = isTerminator ? digits.slice(0, -1) : digits
  sessionState.clearPendingDTMF(sid)
  sessionState.setDTMFVariable(sid, variable_name, finalValue)
  persistDTMFVariables(sid, sessionState.getDTMFVariables(sid)).catch(() => {})

  debug(`[DTMF Collect] Complete: ${variable_name}="${finalValue}"`)

  // Log to transcript
  addTranscriptMessage({
    call_session_id: callSessionId,
    speaker: 'user',
    text: `[DTMF] ${finalValue}`,
    metadata: { dtmf: true, variable_name, value: finalValue },
  }).catch(() => {})

  // Find next node via outbound edge
  const outboundEdge = scenarioState_.edges.find((e) => e.source === activeNode.id)
  if (!outboundEdge) {
    return new NextResponse(null, { status: 204 })
  }

  const nextNode = scenarioState_.nodes.find((n) => n.id === outboundEdge.target)
  scenarioState_.activeNodeId = outboundEdge.target
  persistActiveNodeId(sid, outboundEdge.target).catch(() => {})

  const { voice_provider, voice_id, voice_language } = scenarioState_.entryVoiceConfig
  const responseJson = await buildNextNodeResponse(sid, nextNode, voice_provider, voice_id, voice_language, organizationId)
  if (!responseJson) return new NextResponse(null, { status: 204 })

  if (responseJson.type === 'speak' && responseJson.text) {
    addTranscriptMessage({
      call_session_id: callSessionId,
      speaker: 'assistant',
      text: responseJson.text as string,
      metadata: { dtmf_response: true, variable_name, value: finalValue },
    }).catch(() => {})
  }

  return NextResponse.json([{ type: 'barge_in', session_id: sid }, responseJson])
}

/**
 * Handle dtmf_menu node: route to the matching edge, retry on invalid key.
 */
async function handleDTMFMenu(
  event: DTMFReceivedEvent,
  activeNode: ScenarioNode,
  scenarioState_: ScenarioSessionState,
  sessionId: string,
  callSessionId: string,
  organizationId: string,
): Promise<NextResponse> {
  const sid = event.session.id
  const { max_retries = 2, error_prompt = '', timeout_seconds = 10 } = activeNode.data

  // Find matching edge by label
  const matchingEdge = scenarioState_.edges.find(
    (e) => e.source === activeNode.id && String(e.label) === event.digit
  )
  console.log(`[DTMF Menu] digit="${event.digit}" matchingEdge=${matchingEdge ? matchingEdge.target : 'none'} availableLabels=${scenarioState_.edges.filter(e => e.source === activeNode.id).map(e => e.label).join(',')}`)

  if (!matchingEdge) {
    // Invalid key
    const retries = sessionState.incrementDTMFMenuRetries(sid)
    console.log(`[DTMF Menu] invalid key "${event.digit}" (retry ${retries}/${max_retries})`)

    if (retries > max_retries) {
      // Too many retries — hang up or fallback
      sessionState.clearDTMFMenuRetries(sid)
      return NextResponse.json({
        type: 'hangup',
        session_id: sid,
      })
    }

    // Re-announce menu (error prompt if set, else main prompt)
    const text = error_prompt || activeNode.data.prompt || ''
    if (!text) return new NextResponse(null, { status: 204 })

    addTranscriptMessage({
      call_session_id: callSessionId,
      speaker: 'assistant',
      text,
      metadata: { dtmf_retry_prompt: true, retry: retries },
    }).catch(() => {})

    const { voice_provider, voice_id, voice_language } = scenarioState_.entryVoiceConfig
    return NextResponse.json([
      { type: 'barge_in', session_id: sid },
      buildDTMFSpeak(sid, text, voice_provider, voice_id, voice_language, timeout_seconds),
    ])
  }

  // Valid key — transition to target node
  sessionState.clearDTMFMenuRetries(sid)
  const nextNode = scenarioState_.nodes.find((n) => n.id === matchingEdge.target)
  scenarioState_.activeNodeId = matchingEdge.target
  persistActiveNodeId(sid, matchingEdge.target).catch(() => {})

  console.log(`[DTMF Menu] key "${event.digit}" → node ${matchingEdge.target} (${nextNode?.data.label ?? 'unknown'}) type=${nextNode?.type}`)

  addTranscriptMessage({
    call_session_id: callSessionId,
    speaker: 'user',
    text: `[DTMF Menu] Key ${event.digit}`,
    metadata: { dtmf: true, digit: event.digit, target_node_id: matchingEdge.target },
  }).catch(() => {})

  const { voice_provider, voice_id, voice_language } = scenarioState_.entryVoiceConfig
  const responseJson = await buildNextNodeResponse(sid, nextNode, voice_provider, voice_id, voice_language, organizationId)
  if (!responseJson) return new NextResponse(null, { status: 204 })

  if (responseJson.type === 'speak' && responseJson.text) {
    addTranscriptMessage({
      call_session_id: callSessionId,
      speaker: 'assistant',
      text: responseJson.text as string,
      metadata: { dtmf_response: true, target_node_id: matchingEdge.target },
    }).catch(() => {})
  }

  return NextResponse.json([{ type: 'barge_in', session_id: sid }, responseJson])
}

/**
 * Handle DTMFReceived event.
 * Dispatches to dtmf_collect or dtmf_menu handler based on the active node type.
 */
export async function handleDTMFReceived(event: DTMFReceivedEvent): Promise<NextResponse> {
  const sid = event.session.id
  console.log('[DTMF] digit:', event.digit, 'session:', sid)

  // Load call session from DB
  const supabase = createServiceRoleClient()
  const { data: sessionData } = await supabase
    .from('call_sessions')
    .select('id, session_id, organization_id, assistant_id, scenario_id, metadata')
    .eq('session_id', sid)
    .single()

  const session = sessionData as { id: string; session_id: string; organization_id: string; assistant_id: string | null; scenario_id: string | null; metadata: Record<string, unknown> } | null

  if (!session) {
    console.error('[DTMF] Call session not found in DB:', sid)
    return new NextResponse(null, { status: 204 })
  }
  console.log('[DTMF] session found, scenario_id:', session.scenario_id)

  // Get or rebuild scenario state
  let scenarioState_ = sessionState.getScenarioState(sid)
  if (!scenarioState_) {
    console.log('[DTMF] scenario state not in memory, rebuilding from DB...')
    const rebuilt = await rebuildScenarioState(session as unknown as CallSessionWithAssistant, sid)
    if (!rebuilt) {
      console.error('[DTMF] failed to rebuild scenario state for session:', sid)
      return new NextResponse(null, { status: 204 })
    }
    scenarioState_ = rebuilt
    console.log('[DTMF] scenario state rebuilt, activeNodeId:', scenarioState_.activeNodeId)
  } else {
    console.log('[DTMF] scenario state in memory, activeNodeId:', scenarioState_.activeNodeId)
  }

  const activeNode = scenarioState_.nodes.find((n) => n.id === scenarioState_!.activeNodeId)
  if (!activeNode) {
    console.error('[DTMF] active node not found, activeNodeId:', scenarioState_.activeNodeId)
    return new NextResponse(null, { status: 204 })
  }
  console.log('[DTMF] active node type:', activeNode.type, 'id:', activeNode.id)

  if (activeNode.type === 'dtmf_collect') {
    return handleDTMFCollect(event, activeNode, scenarioState_!, sid, session.id, session.organization_id)
  }

  if (activeNode.type === 'dtmf_menu') {
    return handleDTMFMenu(event, activeNode, scenarioState_!, sid, session.id, session.organization_id)
  }

  // Active node is an agent — DTMF input ignored (agent handles voice)
  console.log('[DTMF] ignoring digit — active node is type:', activeNode.type)
  return new NextResponse(null, { status: 204 })
}
