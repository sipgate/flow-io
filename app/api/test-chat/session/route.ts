import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createTestSession,
  addTestTranscriptMessage,
  getNextSequenceNumber,
} from '@/lib/actions/test-chat'
import { getScenarioByIdServiceRole } from '@/lib/actions/scenarios'
import { findScenarioEntryNode, findScenarioVoiceNode } from '@/app/api/sipgate/webhook/handlers/lib/scenario-state'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organization_id, assistant_id, scenario_id, name } = body

    // Validate input
    if (!organization_id || (!assistant_id && !scenario_id)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // ── Scenario mode ────────────────────────────────────────────────────────────
    if (scenario_id) {
      const { scenario, error: scenarioError } = await getScenarioByIdServiceRole(scenario_id)
      if (scenarioError || !scenario) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
      }

      // Find entry node topologically and get first agent for the session
      const entryNode = findScenarioEntryNode(scenario.nodes, scenario.edges)
      const voiceNode = findScenarioVoiceNode(scenario.nodes)
      if (!entryNode || !voiceNode?.data.assistant_id) {
        return NextResponse.json(
          { error: 'Scenario has no agent node with an assigned assistant' },
          { status: 400 }
        )
      }

      // Verify first agent assistant belongs to org
      const { data: assistant, error: assistantError } = await supabase
        .from('assistants')
        .select('id, name, opening_message, is_active, voice_provider, voice_id, avatar_url')
        .eq('id', voiceNode.data.assistant_id)
        .eq('organization_id', organization_id)
        .single()

      if (assistantError || !assistant || !assistant.is_active) {
        return NextResponse.json(
          { error: 'Entry assistant not found or inactive' },
          { status: 404 }
        )
      }

      const sessionName = name || `Scenario: ${scenario.name}`
      const { session: sessionData, error: sessionError } = await createTestSession({
        organization_id,
        assistant_id: assistant.id,
        name: sessionName,
      })

      const session = sessionData as { id: string; assistant_id: string; name: string; started_at: string } | null

      if (sessionError || !session) {
        return NextResponse.json(
          { error: sessionError || 'Failed to create session' },
          { status: 500 }
        )
      }

      // Store scenario state in metadata
      await supabase
        .from('test_sessions')
        .update({
          metadata: {
            scenario_id,
            active_node_id: entryNode.id,
            active_node_label: entryNode.data.label,
          },
        })
        .eq('id', session.id)

      // Opening message: for DTMF nodes use the node prompt, for agent nodes use assistant.opening_message
      let openingMessage = null
      const openingText = (entryNode.type === 'dtmf_collect' || entryNode.type === 'dtmf_menu')
        ? (entryNode.data.prompt ?? null)
        : (assistant.opening_message ?? null)

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
        voice: { provider: assistant.voice_provider, voiceId: assistant.voice_id },
        agent: { name: assistant.name, avatarUrl: assistant.avatar_url },
        active_node_type: entryNode.type,
      })
    }

    // ── Assistant mode (unchanged) ────────────────────────────────────────────
    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('id, name, opening_message, is_active, voice_provider, voice_id, avatar_url')
      .eq('id', assistant_id)
      .eq('organization_id', organization_id)
      .single()

    if (assistantError || !assistant) {
      return NextResponse.json(
        { error: 'Assistant not found' },
        { status: 404 }
      )
    }

    if (!assistant.is_active) {
      return NextResponse.json(
        { error: 'Assistant is not active' },
        { status: 400 }
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

    let openingMessage = null
    if (assistant.opening_message) {
      const { sequenceNumber } = await getNextSequenceNumber(session.id)
      const { transcript: transcriptData } = await addTestTranscriptMessage({
        test_session_id: session.id,
        organization_id,
        role: 'assistant',
        content: assistant.opening_message,
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
