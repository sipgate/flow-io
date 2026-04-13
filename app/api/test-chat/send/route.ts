import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  addTestTranscriptMessage,
  getNextSequenceNumber,
  getTestSessionHistory,
} from '@/lib/actions/test-chat'
import { generateLLMResponse } from '@/lib/services/llm-conversation'
import { getScenarioByIdServiceRole } from '@/lib/actions/scenarios'
import type { ScenarioTransferNode } from '@/lib/llm/tools/scenario-transfer-tool'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { test_session_id, message, organization_id } = body

    if (!test_session_id || !message || !organization_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Message too long (max 2000 characters)' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get test session
    const { data: session, error: sessionError } = await supabase
      .from('test_sessions')
      .select(`
        id,
        organization_id,
        assistant_id,
        metadata,
        assistants (
          id,
          name,
          is_active
        )
      `)
      .eq('id', test_session_id)
      .eq('organization_id', organization_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const assistant = session.assistants as unknown as { id: string; name: string; is_active: boolean } | null
    if (!assistant || !assistant.is_active) {
      return NextResponse.json(
        { error: 'Assistant not found or inactive' },
        { status: 400 }
      )
    }

    // ── Resolve active assistant for scenario sessions ────────────────────────
    const meta = session.metadata as Record<string, unknown> | null
    const scenarioId = meta?.scenario_id as string | null
    const activeNodeId = meta?.active_node_id as string | null

    let activeAssistantId = assistant.id
    let scenarioTransferNodes: ScenarioTransferNode[] = []
    let scenarioNodes = null as Awaited<ReturnType<typeof getScenarioByIdServiceRole>>['scenario'] | null

    if (scenarioId && activeNodeId) {
      const { scenario } = await getScenarioByIdServiceRole(scenarioId)
      if (scenario) {
        scenarioNodes = scenario
        const activeNode = scenario.nodes.find((n) => n.id === activeNodeId)
        if (activeNode?.data.assistant_id) {
          activeAssistantId = activeNode.data.assistant_id
        }

        // Build reachable nodes (outgoing edges from active node)
        const reachableNodeIds = scenario.edges
          .filter((e) => e.source === activeNodeId)
          .map((e) => e.target)

        scenarioTransferNodes = scenario.nodes
          .filter((n) => reachableNodeIds.includes(n.id) && n.data.assistant_id)
          .map((n) => ({
            nodeId: n.id,
            assistantId: n.data.assistant_id!,
            label: n.data.label,
            transferInstruction: n.data.transfer_instruction,
            inheritVoice: n.data.inherit_voice,
          }))
      }
    }

    // Save user message
    const { sequenceNumber: userSeqNum } = await getNextSequenceNumber(test_session_id)
    const { transcript: userTranscriptData, error: userError } =
      await addTestTranscriptMessage({
        test_session_id,
        organization_id,
        role: 'user',
        content: message,
        sequence_number: userSeqNum,
      })

    const userTranscript = userTranscriptData as { id: string; content: string; timestamp: string } | null
    if (userError || !userTranscript) {
      return NextResponse.json({ error: 'Failed to save user message' }, { status: 500 })
    }

    // Get conversation history
    const { history, error: historyError } = await getTestSessionHistory(test_session_id)
    if (historyError) {
      return NextResponse.json({ error: 'Failed to fetch conversation history' }, { status: 500 })
    }

    // Generate LLM response
    const llmResult = await generateLLMResponse({
      assistantId: activeAssistantId,
      organizationId: organization_id,
      conversationHistory: history.map((h) => ({
        role: h.role as 'user' | 'assistant' | 'system',
        content: h.content,
      })),
      sessionId: test_session_id,
      scenarioTransferNodes: scenarioTransferNodes.length > 0 ? scenarioTransferNodes : undefined,
    })

    if (llmResult.error || !llmResult.response) {
      const errorMessage = 'I apologize, but I encountered an error. Could you please try again?'
      const { sequenceNumber: errSeqNum } = await getNextSequenceNumber(test_session_id)
      const { transcript: errorTranscriptData } = await addTestTranscriptMessage({
        test_session_id,
        organization_id,
        role: 'assistant',
        content: errorMessage,
        sequence_number: errSeqNum,
        metadata: { error: llmResult.error },
      })
      const errorTranscript = errorTranscriptData as { id: string; timestamp: string } | null
      return NextResponse.json({
        user_message: { id: userTranscript.id, content: userTranscript.content, timestamp: userTranscript.timestamp },
        assistant_message: { id: errorTranscript?.id, content: errorMessage, timestamp: errorTranscript?.timestamp },
        error: llmResult.error,
      })
    }

    // ── Handle scenario transfer ──────────────────────────────────────────────
    let transferInfo: { label: string; handoffMessage?: string } | null = null

    if (llmResult.scenarioTransfer && scenarioId && scenarioNodes) {
      const targetNode = scenarioNodes.nodes.find((n) => n.id === llmResult.scenarioTransfer!.targetNodeId)
      if (targetNode) {
        transferInfo = {
          label: targetNode.data.label,
          handoffMessage: llmResult.scenarioTransfer.handoffMessage,
        }

        // Update session metadata with new active node
        const newNodeLabel = targetNode.data.label
        await supabase
          .from('test_sessions')
          .update({
            metadata: {
              ...(meta || {}),
              active_node_id: targetNode.id,
              active_node_label: newNodeLabel,
            },
          })
          .eq('id', test_session_id)
      }
    }

    // Save assistant (handoff) response
    const { sequenceNumber: assistantSeqNum } = await getNextSequenceNumber(test_session_id)
    const assistantMetadata: Record<string, unknown> = {}
    if (llmResult.usage) assistantMetadata.usage = llmResult.usage
    if (llmResult.toolCalls) assistantMetadata.toolCalls = llmResult.toolCalls
    if (llmResult.performance) assistantMetadata.performance = llmResult.performance
    if (llmResult.model) assistantMetadata.model = llmResult.model

    const { transcript: assistantTranscriptData, error: assistantError } =
      await addTestTranscriptMessage({
        test_session_id,
        organization_id,
        role: 'assistant',
        content: llmResult.response,
        sequence_number: assistantSeqNum,
        metadata: assistantMetadata,
      })

    const assistantTranscript = assistantTranscriptData as { id: string; content: string; timestamp: string } | null
    if (assistantError || !assistantTranscript) {
      return NextResponse.json({ error: 'Failed to save assistant response' }, { status: 500 })
    }

    // ── Generate greeting from new agent if send_greeting is enabled ──────────
    let greetingMessage: { id: string; content: string; timestamp: string } | null = null
    let greetingMetadata: Record<string, unknown> = {}

    if (transferInfo && llmResult.scenarioTransfer && scenarioNodes) {
      const targetNode = scenarioNodes.nodes.find((n) => n.id === llmResult.scenarioTransfer!.targetNodeId)
      if (targetNode?.data.send_greeting && targetNode.data.assistant_id) {
        // Build updated history including the handoff message
        const greetingHistory = [
          ...history.map((h) => ({
            role: h.role as 'user' | 'assistant' | 'system',
            content: h.content,
          })),
          { role: 'assistant' as const, content: llmResult.response },
          { role: 'user' as const, content: '[Transfer complete. Greet the caller briefly and offer your help.]' },
        ]

        const greetingResult = await generateLLMResponse({
          assistantId: targetNode.data.assistant_id,
          organizationId: organization_id,
          conversationHistory: greetingHistory,
          sessionId: test_session_id,
        })

        if (greetingResult.response) {
          if (greetingResult.usage) greetingMetadata.usage = greetingResult.usage
          if (greetingResult.performance) greetingMetadata.performance = greetingResult.performance
          if (greetingResult.model) greetingMetadata.model = greetingResult.model

          const { sequenceNumber: greetingSeqNum } = await getNextSequenceNumber(test_session_id)
          const { transcript: greetingTranscriptData } = await addTestTranscriptMessage({
            test_session_id,
            organization_id,
            role: 'assistant',
            content: greetingResult.response,
            sequence_number: greetingSeqNum,
            metadata: greetingMetadata,
          })
          greetingMessage = greetingTranscriptData as { id: string; content: string; timestamp: string } | null
        }
      }
    }

    return NextResponse.json({
      user_message: {
        id: userTranscript.id,
        content: userTranscript.content,
        timestamp: userTranscript.timestamp,
      },
      assistant_message: {
        id: assistantTranscript.id,
        content: assistantTranscript.content,
        timestamp: assistantTranscript.timestamp,
        metadata: assistantMetadata,
      },
      greeting_message: greetingMessage
        ? { id: greetingMessage.id, content: greetingMessage.content, timestamp: greetingMessage.timestamp, metadata: greetingMetadata }
        : undefined,
      transfer: transferInfo,
    })
  } catch (error) {
    console.error('Error in test-chat/send:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
