import { NextResponse } from 'next/server'
import { createCallSession, addTranscriptMessage } from '@/lib/repositories/calls.repository'
import { fetchCallContext } from '@/lib/services/context-webhook'
import { getAssistantVariableDefinitionsForExtraction } from '@/lib/repositories/variables.repository'
import { initVariableCollection } from '@/lib/services/variable-collection-state'
import { getCallToolConfigServiceRole } from '@/lib/repositories/call-tools.repository'
import { getPhonemeReplacementsForAssistant } from '@/lib/repositories/phoneme-sets.repository'
import { debug } from '@/lib/utils/logger'
import { DEFAULT_ELEVENLABS_VOICE_ID, DEFAULT_TTS_PROVIDER } from '@/lib/constants/voices'
import { sessionState } from '@/lib/services/session-state'
import type { BargeInConfig } from '@/lib/services/session-state'
import { buildSpeakResponse, buildAssistantMeta, buildTTSConfig } from './lib/speak-response'
import { routeCallToAssistant, loadAssistantConfig } from './lib/routing'
import { findScenarioEntryNode, findScenarioVoiceNode } from './lib/scenario-state'
import type { SessionStartEvent } from './lib/types'

/**
 * Handle SessionStart event - called when a call begins.
 * Routes the call through a scenario, creates the call session,
 * fetches context data, and returns the opening message.
 */
export async function handleSessionStart(event: SessionStartEvent, organizationId: string) {
  debug('📞 Session Start:', event)
  console.log('[SessionStart] session object:', JSON.stringify(event.session))

  const { to_phone_number, from_phone_number, id: sessionId, direction } = event.session

  const routing = await routeCallToAssistant(to_phone_number, organizationId)

  if (!routing) {
    return NextResponse.json({
      type: 'speak',
      session_id: sessionId,
      text: 'This number is not currently configured. Please try again later.',
      tts: { provider: DEFAULT_TTS_PROVIDER, voice: DEFAULT_ELEVENLABS_VOICE_ID },
    })
  }

  const { phoneNumber, scenario } = routing

  // Find the entry node topologically (no incoming edges = first node in the flow)
  const entryNode = findScenarioEntryNode(scenario.nodes, scenario.edges)
  if (!entryNode) {
    console.error('[SessionStart] Scenario has no nodes:', scenario.id)
    return NextResponse.json({
      type: 'speak',
      session_id: sessionId,
      text: 'This call scenario is not configured correctly. Please try again later.',
      tts: { provider: DEFAULT_TTS_PROVIDER, voice: DEFAULT_ELEVENLABS_VOICE_ID },
    })
  }

  // Voice config always comes from the first agent node (DTMF nodes have no own voice)
  const voiceNode = findScenarioVoiceNode(scenario.nodes)
  if (!voiceNode?.data.assistant_id) {
    console.error('[SessionStart] Scenario has no agent node with an assigned assistant:', scenario.id)
    return NextResponse.json({
      type: 'speak',
      session_id: sessionId,
      text: 'This call scenario is not configured correctly. Please try again later.',
      tts: { provider: DEFAULT_TTS_PROVIDER, voice: DEFAULT_ELEVENLABS_VOICE_ID },
    })
  }

  const voiceAssistant = await loadAssistantConfig(voiceNode.data.assistant_id)
  if (!voiceAssistant) {
    console.error('[SessionStart] Voice agent not found:', voiceNode.data.assistant_id)
    return NextResponse.json({
      type: 'speak',
      session_id: sessionId,
      text: 'The agent for this scenario could not be loaded.',
      tts: { provider: DEFAULT_TTS_PROVIDER, voice: DEFAULT_ELEVENLABS_VOICE_ID },
    })
  }

  if (!voiceAssistant.is_active) {
    return NextResponse.json({
      type: 'speak',
      session_id: sessionId,
      text: 'This assistant is currently inactive. Please try again later.',
      tts: { provider: DEFAULT_TTS_PROVIDER, voice: DEFAULT_ELEVENLABS_VOICE_ID },
    })
  }

  // Scenario-level voice overrides agent voice (used for DTMF announcements + inherit_voice agents)
  const entryVoiceConfig = {
    voice_provider: scenario.voice_provider || voiceAssistant.voice_provider,
    voice_id: scenario.voice_id || voiceAssistant.voice_id,
    voice_language: scenario.voice_language || voiceAssistant.voice_language,
  }

  sessionState.setScenarioState(sessionId, {
    scenarioId: scenario.id,
    activeNodeId: entryNode.id,
    entryNodeId: entryNode.id,
    entryVoiceConfig,
    nodes: scenario.nodes,
    edges: scenario.edges,
    dtmfVariables: {},
  })
  debug(`[SessionStart] Scenario routing: scenarioId=${scenario.id} entryNode=${entryNode.id} (type=${entryNode.type})`)

  // ── DTMF entry: speak the prompt and wait for keypad input ───────────────
  if (entryNode.type === 'dtmf_collect' || entryNode.type === 'dtmf_menu') {
    const { session: callSession } = await createCallSession({
      session_id: sessionId,
      organization_id: voiceAssistant.organization_id,
      assistant_id: voiceAssistant.id,
      phone_number_id: phoneNumber.id,
      scenario_id: scenario.id,
      caller_number: from_phone_number,
      metadata: event,
    }) as { session: { id: string } | null }

    if (!callSession) {
      console.error('[SessionStart] Failed to create call session for DTMF entry')
      return NextResponse.json({
        type: 'speak',
        session_id: sessionId,
        text: 'Sorry, there was an error setting up the call.',
        tts: buildTTSConfig(voiceAssistant),
      })
    }

    const { prompt, timeout_seconds } = entryNode.data
    if (!prompt) return NextResponse.json({ success: true })

    const tts: Record<string, unknown> = {
      provider: voiceAssistant.voice_provider === 'elevenlabs' ? 'eleven_labs' : (voiceAssistant.voice_provider || DEFAULT_TTS_PROVIDER),
      voice: voiceAssistant.voice_id || DEFAULT_ELEVENLABS_VOICE_ID,
      ...(voiceAssistant.voice_language && voiceAssistant.voice_provider !== 'elevenlabs'
        ? { language: voiceAssistant.voice_language }
        : {}),
    }
    return NextResponse.json({
      type: 'speak',
      session_id: sessionId,
      text: prompt,
      tts,
      user_input_timeout_seconds: timeout_seconds ?? (entryNode.type === 'dtmf_collect' ? 5 : 10),
    })
  }

  // ── Agent entry: existing behaviour ──────────────────────────────────────

  // For agent entry, load the entry node's own assistant (may differ from voiceNode)
  const entryAssistantId = entryNode.data.assistant_id
  if (!entryAssistantId) {
    console.error('[SessionStart] Entry agent node has no assistant assigned:', entryNode.id)
    return NextResponse.json({
      type: 'speak',
      session_id: sessionId,
      text: 'This call scenario is not configured correctly. Please try again later.',
      tts: { provider: DEFAULT_TTS_PROVIDER, voice: DEFAULT_ELEVENLABS_VOICE_ID },
    })
  }

  // voiceNode is the same as entryNode when entry is an agent — reuse if possible
  const assistant = entryNode.id === voiceNode.id
    ? voiceAssistant
    : await loadAssistantConfig(entryAssistantId) ?? voiceAssistant

  const { session: callSession } = await createCallSession({
    session_id: sessionId,
    organization_id: assistant.organization_id,
    assistant_id: assistant.id,
    phone_number_id: phoneNumber.id,
    scenario_id: scenario.id,
    caller_number: from_phone_number,
    metadata: event,
  }) as { session: { id: string; organization_id: string; assistant_id: string } | null }

  if (!callSession) {
    console.error('Failed to create call session')
    return NextResponse.json({
      type: 'speak',
      session_id: sessionId,
      text: 'Sorry, there was an error setting up the call.',
      tts: buildTTSConfig(assistant),
    })
  }

  // Fetch context from webhook (if configured) — non-blocking with timeout
  const contextResult = await fetchCallContext({
    assistantId: assistant.id,
    assistantName: assistant.name,
    organizationId: assistant.organization_id,
    callSessionId: callSession.id,
    sipgateSessionId: sessionId,
    callerNumber: from_phone_number,
    calledNumber: to_phone_number,
    direction: direction,
  })

  if (contextResult.success && Object.keys(contextResult.contextData).length > 0) {
    debug('[SessionStart] Context fetched:', contextResult.contextData)
  }

  // Prepare opening message with variable substitution
  let openingMessage = assistant.opening_message || 'Hello! How can I help you today?'

  if (contextResult.contextData) {
    for (const [key, value] of Object.entries(contextResult.contextData)) {
      const placeholder = `{{${key}}}`
      if (openingMessage.includes(placeholder)) {
        openingMessage = openingMessage.replace(
          new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          String(value)
        )
      }
    }
  }

  openingMessage = openingMessage
    .replace(/\{\{callerNumber\}\}/g, from_phone_number || '')
    .replace(/\{\{callDirection\}\}/g, direction || '')

  await addTranscriptMessage({
    call_session_id: callSession.id,
    speaker: 'assistant',
    text: openingMessage,
    metadata: buildAssistantMeta(assistant),
    assistant_name: assistant.name,
    assistant_avatar_url: assistant.avatar_url,
  })

  // Initialize real-time variable collection if assistant has relevant definitions
  const { definitions: varDefs } = await getAssistantVariableDefinitionsForExtraction(assistant.id)
  const collectionDefs = varDefs.filter(
    (d) => d.mandatory_collection || d.validation_regex || d.validation_endpoint || d.confirm_with_caller
  )
  if (collectionDefs.length > 0) {
    initVariableCollection(sessionId, collectionDefs)
    debug(`[SessionStart] Variable collection initialized with ${collectionDefs.length} definitions`)
  }

  // Load barge-in config and store in session state
  const callToolConfig = await getCallToolConfigServiceRole(assistant.id)
  let bargeIn: BargeInConfig | undefined
  if (callToolConfig) {
    const strategy = callToolConfig.barge_in_strategy || 'minimum_characters'
    bargeIn = {
      strategy,
      ...(strategy === 'minimum_characters' && {
        minimum_characters: callToolConfig.barge_in_minimum_characters ?? 3,
        allow_after_ms: callToolConfig.barge_in_allow_after_ms ?? 0,
      }),
      ...(strategy === 'immediate' && {
        allow_after_ms: callToolConfig.barge_in_allow_after_ms ?? 0,
      }),
    }
    sessionState.setBargeInConfig(sessionId, bargeIn)
  }

  // Load phoneme replacements for this assistant (ElevenLabs only)
  const phonemeReplacements = await getPhonemeReplacementsForAssistant(assistant.id)
  if (phonemeReplacements.length > 0) {
    sessionState.setPhonemeReplacements(sessionId, phonemeReplacements)
    debug(`[SessionStart] Loaded ${phonemeReplacements.length} phoneme replacement(s) for assistant ${assistant.name}`)
  }

  const openingSpeak = buildSpeakResponse(sessionId, openingMessage, assistant, bargeIn)

  // Build custom_vocabulary from entries with boost_recognition=true
  const boostWords = phonemeReplacements
    .filter((r) => r.boost_recognition)
    .map((r) => r.word)

  if (boostWords.length > 0) {
    debug(`[SessionStart] Sending ${boostWords.length} boost word(s) as custom_vocabulary`)
    const configureTranscription = {
      type: 'configure_transcription',
      session_id: sessionId,
      custom_vocabulary: boostWords,
    }
    return NextResponse.json([configureTranscription, openingSpeak.json])
  }

  return NextResponse.json(openingSpeak.json)
}
