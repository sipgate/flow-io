import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { sessionState } from '@/lib/services/session-state'
import { debug } from '@/lib/utils/logger'
import { DEFAULT_ELEVENLABS_VOICE_ID, DEFAULT_TTS_PROVIDER } from '@/lib/constants/voices'
import { persistActiveNodeId, rebuildScenarioState } from './lib/scenario-state'
import { loadAssistantConfig } from './lib/routing'
import type { UserInputTimeoutEvent, CallSessionWithAssistant } from './lib/types'

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
  const json: Record<string, unknown> = { type: 'speak', session_id: sessionId, text, tts }
  if (userInputTimeoutSeconds) json.user_input_timeout_seconds = userInputTimeoutSeconds
  return json
}

/**
 * Handle UserInputTimeout event.
 *
 * For dtmf_collect: if digits have been collected, treat as complete (same as terminator).
 *                   Otherwise re-announce the prompt.
 *
 * For dtmf_menu: re-announce the menu text — or error message — with retry logic.
 */
export async function handleUserInputTimeout(event: UserInputTimeoutEvent): Promise<NextResponse> {
  debug('⏱️  User Input Timeout:', event.session.id)
  const sid = event.session.id

  let scenarioState_ = sessionState.getScenarioState(sid)
  if (!scenarioState_) {
    // Try to rebuild from DB
    const supabase = createServiceRoleClient()
    const { data: sessionData } = await supabase
      .from('call_sessions')
      .select('id, session_id, organization_id, assistant_id, scenario_id, metadata')
      .eq('session_id', sid)
      .single()
    if (!sessionData) return NextResponse.json({ success: true })
    const rebuilt = await rebuildScenarioState(sessionData as unknown as CallSessionWithAssistant, sid)
    if (!rebuilt) return NextResponse.json({ success: true })
    scenarioState_ = rebuilt
  }

  const activeNode = scenarioState_.nodes.find((n) => n.id === scenarioState_!.activeNodeId)
  if (!activeNode) return NextResponse.json({ success: true })

  const { voice_provider, voice_id, voice_language } = scenarioState_.entryVoiceConfig

  if (activeNode.type === 'dtmf_collect') {
    const digits = scenarioState_.pendingDTMFDigits ?? ''

    if (digits.length > 0) {
      // Treat as complete — same logic as digit completion
      const { variable_name = 'dtmfInput' } = activeNode.data
      sessionState.clearPendingDTMF(sid)
      sessionState.setDTMFVariable(sid, variable_name, digits)

      const outboundEdge = scenarioState_.edges.find((e) => e.source === activeNode.id)
      if (!outboundEdge) return NextResponse.json({ success: true })

      const nextNode = scenarioState_.nodes.find((n) => n.id === outboundEdge.target)
      scenarioState_.activeNodeId = outboundEdge.target
      persistActiveNodeId(sid, outboundEdge.target).catch(() => {})

      if (!nextNode) return NextResponse.json({ success: true })

      if ((nextNode.type === 'dtmf_collect' || nextNode.type === 'dtmf_menu') && nextNode.data.prompt) {
        return NextResponse.json(
          buildDTMFSpeak(sid, nextNode.data.prompt, voice_provider, voice_id, voice_language, nextNode.data.timeout_seconds)
        )
      }

      // Agent node — speak opening_message if available
      if ((nextNode.type === 'agent' || nextNode.type === 'entry_agent') && nextNode.data.assistant_id) {
        const assistant = await loadAssistantConfig(nextNode.data.assistant_id)
        if (assistant?.opening_message) {
          const tts: Record<string, unknown> = {
            provider: (assistant.voice_provider === 'elevenlabs' ? 'eleven_labs' : assistant.voice_provider) || DEFAULT_TTS_PROVIDER,
            voice: assistant.voice_id || DEFAULT_ELEVENLABS_VOICE_ID,
            ...(assistant.voice_language && assistant.voice_provider !== 'elevenlabs' ? { language: assistant.voice_language } : {}),
          }
          return NextResponse.json({ type: 'speak', session_id: sid, text: assistant.opening_message, tts })
        }
      }
      return NextResponse.json({ success: true })
    }

    // No digits — re-announce prompt
    if (activeNode.data.prompt) {
      return NextResponse.json(
        buildDTMFSpeak(sid, activeNode.data.prompt, voice_provider, voice_id, voice_language, activeNode.data.timeout_seconds ?? 5)
      )
    }
    return NextResponse.json({ success: true })
  }

  if (activeNode.type === 'dtmf_menu') {
    const { max_retries = 2, timeout_seconds = 10 } = activeNode.data
    const retries = sessionState.incrementDTMFMenuRetries(sid)

    if (retries > max_retries) {
      sessionState.clearDTMFMenuRetries(sid)
      return NextResponse.json({ type: 'hangup', session_id: sid })
    }

    const text = activeNode.data.error_prompt || activeNode.data.prompt || ''
    if (!text) return NextResponse.json({ success: true })

    return NextResponse.json(
      buildDTMFSpeak(sid, text, voice_provider, voice_id, voice_language, timeout_seconds)
    )
  }

  return NextResponse.json({ success: true })
}
