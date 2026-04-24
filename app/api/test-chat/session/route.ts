import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createTestSession,
  addTestTranscriptMessage,
  getNextSequenceNumber,
} from '@/lib/actions/test-chat'
import { getScenarioByIdServiceRole } from '@/lib/actions/scenarios'
import { findScenarioEntryNode, findScenarioVoiceNode } from '@/app/api/sipgate/webhook/handlers/lib/scenario-state'
import { fetchContextPreview } from '@/lib/services/context-webhook'
import { renderOpeningMessage } from '@/lib/services/opening-message'
import { DEFAULT_ELEVENLABS_VOICE_ID, DEFAULT_TTS_PROVIDER } from '@/lib/constants/voices'

type AssistantSessionInfo = {
  id: string
  name: string
  opening_message: string | null
  is_active: boolean
  voice_provider: string | null
  voice_id: string | null
  avatar_url: string | null
}

function normalizeCallDirection(value: unknown): 'inbound' | 'outbound' {
  return value === 'outbound' ? 'outbound' : 'inbound'
}

function buildScenarioVoiceConfig(scenario: {
  voice_provider: string | null
  voice_id: string | null
  voice_language: string | null
}) {
  return {
    provider: scenario.voice_provider || DEFAULT_TTS_PROVIDER,
    voiceId: scenario.voice_id || DEFAULT_ELEVENLABS_VOICE_ID,
    voiceLanguage: scenario.voice_language || null,
  }
}

async function loadAssistantForSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assistantId: string,
  organizationId: string
): Promise<AssistantSessionInfo | null> {
  const { data: assistant, error } = await supabase
    .from('assistants')
    .select('id, name, opening_message, is_active, voice_provider, voice_id, avatar_url')
    .eq('id', assistantId)
    .eq('organization_id', organizationId)
    .single()

  if (error || !assistant || !assistant.is_active) {
    return null
  }

  return assistant as AssistantSessionInfo
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organization_id, assistant_id, scenario_id, name } = body
    const callerNumber = typeof body.caller_number === 'string' ? body.caller_number : undefined
    const calledNumber = typeof body.called_number === 'string' ? body.called_number : undefined
    const callDirection = normalizeCallDirection(body.call_direction)

    if (!organization_id || (!assistant_id && !scenario_id)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // ── Scenario mode ────────────────────────────────────────────────────────
    if (scenario_id) {
      const { scenario, error: scenarioError } = await getScenarioByIdServiceRole(scenario_id)
      if (scenarioError || !scenario) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
      }

      const entryNode = findScenarioEntryNode(scenario.nodes, scenario.edges)
      const voiceNode = findScenarioVoiceNode(scenario.nodes)
      if (!entryNode || !voiceNode?.data.assistant_id) {
        return NextResponse.json(
          { error: 'Scenario has no agent node with an assigned assistant' },
          { status: 400 }
        )
      }

      const voiceAssistant = await loadAssistantForSession(
        supabase,
        voiceNode.data.assistant_id,
        organization_id
      )
      if (!voiceAssistant) {
        return NextResponse.json(
          { error: 'Voice assistant not found or inactive' },
          { status: 404 }
        )
      }

      const entryAssistant = entryNode.data.assistant_id
        ? await loadAssistantForSession(supabase, entryNode.data.assistant_id, organization_id)
        : null

      if (entryNode.data.assistant_id && !entryAssistant) {
        return NextResponse.json(
          { error: 'Entry assistant not found or inactive' },
          { status: 404 }
        )
      }

      const sessionAssistant = entryAssistant || voiceAssistant
      const sessionName = name || `Scenario: ${scenario.name}`
      const { session: sessionData, error: sessionError } = await createTestSession({
        organization_id,
        assistant_id: sessionAssistant.id,
        name: sessionName,
      })

      const session = sessionData as { id: string; assistant_id: string; name: string; started_at: string } | null
      if (sessionError || !session) {
        return NextResponse.json(
          { error: sessionError || 'Failed to create session' },
          { status: 500 }
        )
      }

      const scenarioVoice = buildScenarioVoiceConfig(scenario)
      const contextResult = entryAssistant
        ? await fetchContextPreview({
            assistantId: entryAssistant.id,
            assistantName: entryAssistant.name,
            organizationId: organization_id,
            sipgateSessionId: session.id,
            callerNumber,
            calledNumber,
            direction: callDirection,
          })
        : { success: true, contextData: {} as Record<string, unknown> }

      const metadata: Record<string, unknown> = {
        scenario_id,
        active_node_id: entryNode.id,
        active_node_label: entryNode.data.label,
        call_direction: callDirection,
        scenario_voice_provider: scenarioVoice.provider,
        scenario_voice_id: scenarioVoice.voiceId,
        scenario_voice_language: scenarioVoice.voiceLanguage,
        ...(callerNumber ? { caller_number: callerNumber } : {}),
        ...(calledNumber ? { called_number: calledNumber } : {}),
        ...(contextResult.contextData && Object.keys(contextResult.contextData).length > 0
          ? { context_data: contextResult.contextData }
          : {}),
      }

      await supabase
        .from('test_sessions')
        .update({ metadata })
        .eq('id', session.id)

      const openingText = (entryNode.type === 'dtmf_collect' || entryNode.type === 'dtmf_menu')
        ? (entryNode.data.prompt ?? null)
        : renderOpeningMessage({
            template: entryAssistant?.opening_message,
            assistantName: entryAssistant?.name || voiceAssistant.name,
            callerNumber,
            callDirection,
            contextData: contextResult.contextData,
          })

      let openingMessage = null
      if (openingText) {
        const { sequenceNumber } = await getNextSequenceNumber(session.id)
        const { transcript: transcriptData } = await addTestTranscriptMessage({
          test_session_id: session.id,
          organization_id,
          role: 'assistant',
          content: openingText,
          sequence_number: sequenceNumber,
          metadata: (entryNode.type === 'dtmf_collect' || entryNode.type === 'dtmf_menu')
            ? { dtmf_prompt: true, node_type: entryNode.type }
            : undefined,
        })

        const transcript = transcriptData as { id: string; content: string; timestamp: string } | null
        if (transcript) {
          openingMessage = {
            id: transcript.id,
            content: transcript.content,
            timestamp: transcript.timestamp,
          }
        }
      }

      const responseVoice = (entryNode.type === 'dtmf_collect' || entryNode.type === 'dtmf_menu' || entryNode.data.inherit_voice)
        ? { provider: scenarioVoice.provider, voiceId: scenarioVoice.voiceId }
        : {
            provider: entryAssistant?.voice_provider || voiceAssistant.voice_provider,
            voiceId: entryAssistant?.voice_id || voiceAssistant.voice_id,
          }

      return NextResponse.json({
        session: {
          id: session.id,
          assistant_id: session.assistant_id,
          name: session.name,
          started_at: session.started_at,
          scenario_id,
          active_node_label: entryNode.data.label,
        },
        opening_message: openingMessage,
        voice: responseVoice,
        agent: (entryNode.type === 'dtmf_collect' || entryNode.type === 'dtmf_menu')
          ? null
          : { name: entryAssistant?.name || voiceAssistant.name, avatarUrl: entryAssistant?.avatar_url || voiceAssistant.avatar_url },
        active_node_type: entryNode.type,
      })
    }

    // ── Assistant mode ───────────────────────────────────────────────────────
    const assistant = await loadAssistantForSession(supabase, assistant_id, organization_id)
    if (!assistant) {
      return NextResponse.json(
        { error: 'Assistant not found or inactive' },
        { status: 404 }
      )
    }

    const { session: sessionData, error: sessionError } = await createTestSession({
      organization_id,
      assistant_id,
      name,
    })

    const session = sessionData as { id: string; assistant_id: string; name: string; started_at: string } | null
    if (sessionError || !session) {
      return NextResponse.json(
        { error: sessionError || 'Failed to create session' },
        { status: 500 }
      )
    }

    const contextResult = await fetchContextPreview({
      assistantId: assistant.id,
      assistantName: assistant.name,
      organizationId: organization_id,
      sipgateSessionId: session.id,
      callerNumber,
      calledNumber,
      direction: callDirection,
    })

    await supabase
      .from('test_sessions')
      .update({
        metadata: {
          call_direction: callDirection,
          ...(callerNumber ? { caller_number: callerNumber } : {}),
          ...(calledNumber ? { called_number: calledNumber } : {}),
          ...(contextResult.contextData && Object.keys(contextResult.contextData).length > 0
            ? { context_data: contextResult.contextData }
            : {}),
        },
      })
      .eq('id', session.id)

    const openingText = renderOpeningMessage({
      template: assistant.opening_message,
      assistantName: assistant.name,
      callerNumber,
      callDirection,
      contextData: contextResult.contextData,
    })

    let openingMessage = null
    if (openingText) {
      const { sequenceNumber } = await getNextSequenceNumber(session.id)
      const { transcript: transcriptData } = await addTestTranscriptMessage({
        test_session_id: session.id,
        organization_id,
        role: 'assistant',
        content: openingText,
        sequence_number: sequenceNumber,
      })

      const transcript = transcriptData as { id: string; content: string; timestamp: string } | null
      if (transcript) {
        openingMessage = {
          id: transcript.id,
          content: transcript.content,
          timestamp: transcript.timestamp,
        }
      }
    }

    return NextResponse.json({
      session: {
        id: session.id,
        assistant_id: session.assistant_id,
        name: session.name,
        started_at: session.started_at,
      },
      opening_message: openingMessage,
      voice: { provider: assistant.voice_provider, voiceId: assistant.voice_id },
      agent: { name: assistant.name, avatarUrl: assistant.avatar_url },
    })
  } catch (error) {
    console.error('Error in test-chat/session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
