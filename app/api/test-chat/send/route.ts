import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  addTestTranscriptMessage,
  getNextSequenceNumber,
  getTestSessionHistory,
} from '@/lib/actions/test-chat'
import { generateLLMResponse } from '@/lib/services/llm-conversation'
import { getScenarioByIdServiceRole } from '@/lib/actions/scenarios'
import {
  startHesitation,
  getHesitationState,
  clearHesitation,
} from '@/lib/services/hesitation-state'
import type { ScenarioTransferNode } from '@/lib/llm/tools/scenario-transfer-tool'
import type { ScenarioNode } from '@/types/scenarios'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { test_session_id, message, organization_id, continue_after_hesitation } = body

    if (!test_session_id || !organization_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // For normal messages, require the message text (DTMF input is allowed as alternative)
    if (!continue_after_hesitation && !message && body.dtmf_input === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (message && message.length > 2000) {
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
          is_active,
          voice_provider,
          voice_id,
          avatar_url
        )
      `)
      .eq('id', test_session_id)
      .eq('organization_id', organization_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const assistant = session.assistants as unknown as { id: string; name: string; is_active: boolean; voice_provider: string | null; voice_id: string | null; avatar_url: string | null } | null
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
            transferInstruction: n.data.transfer_instruction ?? '',
            inheritVoice: n.data.inherit_voice ?? false,
          }))
      }
    }

    // ── DTMF routing (bypasses LLM entirely) ─────────────────────────────────
    const dtmfInput = body.dtmf_input as string | undefined
    if (dtmfInput !== undefined && scenarioId && activeNodeId && scenarioNodes) {
      const currentActiveNode = scenarioNodes.nodes.find((n) => n.id === activeNodeId)

      if (currentActiveNode?.type === 'dtmf_menu' || currentActiveNode?.type === 'dtmf_collect') {
        const supabaseForDtmf = supabase

        // Determine user label and next node
        let userText: string
        let nextNode: ScenarioNode | undefined
        let isInvalidKey = false

        if (currentActiveNode.type === 'dtmf_menu') {
          const digit = dtmfInput[0] || ''
          userText = `[DTMF Menu] Key ${digit}`
          const matchingEdge = scenarioNodes.edges.find(
            (e) => e.source === activeNodeId && String(e.label) === digit
          )
          if (!matchingEdge) {
            isInvalidKey = true
            nextNode = currentActiveNode // stay on same node
          } else {
            nextNode = scenarioNodes.nodes.find((n) => n.id === matchingEdge.target)
          }
        } else {
          // dtmf_collect — full value submitted at once
          userText = `[DTMF] ${dtmfInput}`
          const outboundEdge = scenarioNodes.edges.find((e) => e.source === activeNodeId)
          nextNode = outboundEdge ? scenarioNodes.nodes.find((n) => n.id === outboundEdge.target) : undefined
        }

        // Save user DTMF message
        const { sequenceNumber: dtmfUserSeq } = await getNextSequenceNumber(test_session_id)
        const { transcript: dtmfUserTranscript } = await addTestTranscriptMessage({
          test_session_id,
          organization_id,
          role: 'user',
          content: userText,
          sequence_number: dtmfUserSeq,
          metadata: { dtmf: true },
        })
        const dtmfUser = dtmfUserTranscript as { id: string; content: string; timestamp: string } | null

        // Determine next node response text
        let assistantText: string | null = null
        let nextAssistantId: string | null = null
        let nextAssistantName: string | null = null
        let nextAssistantAvatar: string | null = null

        if (isInvalidKey) {
          assistantText = currentActiveNode.data.error_prompt || currentActiveNode.data.prompt || null
          // isInvalidKey: no agent (DTMF system prompt)
        } else if (nextNode) {
          if (nextNode.data.prompt) {
            // Next node is also a DTMF node — no agent
            assistantText = nextNode.data.prompt
          } else if (nextNode.data.assistant_id) {
            nextAssistantId = nextNode.data.assistant_id
            const { data: nextAssistant } = await supabaseForDtmf
              .from('assistants')
              .select('opening_message, name, avatar_url')
              .eq('id', nextNode.data.assistant_id)
              .single()
            assistantText = nextAssistant?.opening_message ?? null
            nextAssistantName = nextAssistant?.name ?? null
            nextAssistantAvatar = nextAssistant?.avatar_url ?? null
          }
        }

        // Update session metadata to new active node (unless invalid key)
        if (!isInvalidKey && nextNode && nextNode.id !== activeNodeId) {
          await supabaseForDtmf
            .from('test_sessions')
            .update({
              metadata: {
                ...(meta || {}),
                active_node_id: nextNode.id,
                active_node_label: nextNode.data.label,
                ...(nextAssistantId ? { active_assistant_id: nextAssistantId } : {}),
              },
            })
            .eq('id', test_session_id)
        }

        // Save assistant response if any
        let dtmfAssistantMsg: { id: string; content: string; timestamp: string } | null = null
        if (assistantText) {
          const { sequenceNumber: dtmfAssSeq } = await getNextSequenceNumber(test_session_id)
          const { transcript: dtmfAssTranscript } = await addTestTranscriptMessage({
            test_session_id,
            organization_id,
            role: 'assistant',
            content: assistantText,
            sequence_number: dtmfAssSeq,
            metadata: { dtmf_response: true, invalid_key: isInvalidKey || undefined },
          })
          dtmfAssistantMsg = dtmfAssTranscript as { id: string; content: string; timestamp: string } | null
        }

        // Determine voice config for response (nextAssistantId was already loaded above)
        let dtmfVoiceProvider = assistant.voice_provider
        let dtmfVoiceId = assistant.voice_id
        if (nextAssistantId) {
          const { data: nxtAss } = await supabaseForDtmf
            .from('assistants')
            .select('voice_provider, voice_id')
            .eq('id', nextAssistantId)
            .single()
          if (nxtAss) { dtmfVoiceProvider = nxtAss.voice_provider; dtmfVoiceId = nxtAss.voice_id }
        }

        // Agent info: null for DTMF-node prompts, real agent for agent-node responses
        const dtmfResponseAgent = nextAssistantName
          ? { name: nextAssistantName, avatarUrl: nextAssistantAvatar }
          : null

        return NextResponse.json({
          user_message: dtmfUser
            ? { id: dtmfUser.id, content: dtmfUser.content, timestamp: dtmfUser.timestamp }
            : { id: `dtmf-${Date.now()}`, content: userText, timestamp: new Date().toISOString() },
          assistant_message: dtmfAssistantMsg
            ? {
                id: dtmfAssistantMsg.id,
                content: dtmfAssistantMsg.content,
                timestamp: dtmfAssistantMsg.timestamp,
                agent: dtmfResponseAgent,
              }
            : null,
          active_node_type: isInvalidKey ? currentActiveNode.type : (nextNode?.type ?? null),
          active_node_label: isInvalidKey ? currentActiveNode.data.label : (nextNode?.data.label ?? null),
          voice: { provider: dtmfVoiceProvider, voiceId: dtmfVoiceId },
        })
      }
    }

    // Resolve active assistant info (voice, name, avatar)
    let voiceProvider = assistant.voice_provider
    let voiceId = assistant.voice_id
    let activeAssistantName = assistant.name
    let activeAssistantAvatar = assistant.avatar_url
    if (activeAssistantId !== assistant.id) {
      const { data: activeAssistant } = await supabase
        .from('assistants')
        .select('name, avatar_url, voice_provider, voice_id')
        .eq('id', activeAssistantId)
        .single()
      if (activeAssistant) {
        voiceProvider = activeAssistant.voice_provider
        voiceId = activeAssistant.voice_id
        activeAssistantName = activeAssistant.name
        activeAssistantAvatar = activeAssistant.avatar_url
      }
    }

    // ── Path A: follow-up after hesitation ────────────────────────────────────
    // Client sends continue_after_hesitation:true after displaying the hesitation
    // message. We retrieve the stored state and run the real LLM call.
    if (continue_after_hesitation) {
      const hesitationState = getHesitationState(test_session_id)
      if (!hesitationState) {
        return NextResponse.json({ error: 'No pending hesitation' }, { status: 400 })
      }
      clearHesitation(test_session_id)

      const followUpResult = await generateLLMResponse({
        ...hesitationState,
        disableHesitation: true,
        priorHesitationMessage: hesitationState.hesitationMessage,
      })

      // Re-use the shared "save + respond" logic below via finalResult
      const historyForGreeting = hesitationState.conversationHistory
      const handoffAgent = { name: activeAssistantName, avatarUrl: activeAssistantAvatar }

      if (followUpResult.error || !followUpResult.response) {
        const errorMessage = 'I apologize, but I encountered an error. Could you please try again?'
        const { sequenceNumber: errSeqNum } = await getNextSequenceNumber(test_session_id)
        const { transcript: errorTranscriptData } = await addTestTranscriptMessage({
          test_session_id,
          organization_id,
          role: 'assistant',
          content: errorMessage,
          sequence_number: errSeqNum,
          metadata: { error: followUpResult.error },
        })
        const errorTranscript = errorTranscriptData as { id: string; timestamp: string } | null
        return NextResponse.json({
          assistant_message: { id: errorTranscript?.id, content: errorMessage, timestamp: errorTranscript?.timestamp },
          error: followUpResult.error,
        })
      }

      // Handle scenario transfer
      let transferInfo: { label: string; handoffMessage?: string } | null = null
      if (followUpResult.scenarioTransfer && scenarioId && scenarioNodes) {
        const targetNode = scenarioNodes.nodes.find((n) => n.id === followUpResult.scenarioTransfer!.targetNodeId)
        if (targetNode) {
          transferInfo = {
            label: targetNode.data.label,
            handoffMessage: followUpResult.scenarioTransfer.handoffMessage,
          }
          await supabase
            .from('test_sessions')
            .update({
              metadata: {
                ...(meta || {}),
                active_node_id: targetNode.id,
                active_node_label: targetNode.data.label,
              },
            })
            .eq('id', test_session_id)
          if (targetNode.data.assistant_id) {
            const { data: targetAssistant } = await supabase
              .from('assistants')
              .select('name, avatar_url, voice_provider, voice_id')
              .eq('id', targetNode.data.assistant_id)
              .single()
            if (targetAssistant) {
              voiceProvider = targetAssistant.voice_provider
              voiceId = targetAssistant.voice_id
              activeAssistantName = targetAssistant.name
              activeAssistantAvatar = targetAssistant.avatar_url
            }
          }
        }
      }

      // Save assistant response
      const { sequenceNumber: assistantSeqNum } = await getNextSequenceNumber(test_session_id)
      const assistantMetadata: Record<string, unknown> = {}
      if (followUpResult.usage) assistantMetadata.usage = followUpResult.usage
      if (followUpResult.toolCalls) assistantMetadata.toolCalls = followUpResult.toolCalls
      if (followUpResult.performance) assistantMetadata.performance = followUpResult.performance
      if (followUpResult.model) assistantMetadata.model = followUpResult.model

      const { transcript: assistantTranscriptData, error: assistantError } =
        await addTestTranscriptMessage({
          test_session_id,
          organization_id,
          role: 'assistant',
          content: followUpResult.response,
          sequence_number: assistantSeqNum,
          metadata: assistantMetadata,
        })

      const assistantTranscript = assistantTranscriptData as { id: string; content: string; timestamp: string } | null
      if (assistantError || !assistantTranscript) {
        return NextResponse.json({ error: 'Failed to save assistant response' }, { status: 500 })
      }

      // Generate greeting if transfer happened
      let greetingMessage: { id: string; content: string; timestamp: string } | null = null
      let greetingMetadata: Record<string, unknown> = {}
      if (transferInfo && followUpResult.scenarioTransfer && scenarioNodes) {
        const targetNode = scenarioNodes.nodes.find((n) => n.id === followUpResult.scenarioTransfer!.targetNodeId)
        if (targetNode?.data.send_greeting && targetNode.data.assistant_id) {
          const greetingHistory = [
            ...historyForGreeting,
            { role: 'assistant' as const, content: followUpResult.response },
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
        assistant_message: {
          id: assistantTranscript.id,
          content: assistantTranscript.content,
          timestamp: assistantTranscript.timestamp,
          metadata: assistantMetadata,
          agent: { name: handoffAgent.name, avatarUrl: handoffAgent.avatarUrl },
        },
        greeting_message: greetingMessage
          ? {
              id: greetingMessage.id,
              content: greetingMessage.content,
              timestamp: greetingMessage.timestamp,
              metadata: greetingMetadata,
              agent: { name: activeAssistantName, avatarUrl: activeAssistantAvatar },
            }
          : undefined,
        transfer: transferInfo,
        voice: { provider: voiceProvider, voiceId },
      })
    }

    // ── Path B: normal message ────────────────────────────────────────────────

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

    const conversationHistory = history.map((h) => ({
      role: h.role as 'user' | 'assistant' | 'system',
      content: h.content,
    }))

    // Generate LLM response
    const llmResult = await generateLLMResponse({
      assistantId: activeAssistantId,
      organizationId: organization_id,
      conversationHistory,
      sessionId: test_session_id,
      scenarioTransferNodes: scenarioTransferNodes.length > 0 ? scenarioTransferNodes : undefined,
    })

    // ── Hesitation: return early, store state for follow-up ───────────────────
    // The client will display the hesitation message, then automatically send
    // continue_after_hesitation:true to trigger the real tool call.
    if (llmResult.hesitationMessage && !llmResult.error) {
      const { sequenceNumber: hesSeqNum } = await getNextSequenceNumber(test_session_id)
      const { transcript: hesTranscriptData } = await addTestTranscriptMessage({
        test_session_id,
        organization_id,
        role: 'assistant',
        content: llmResult.hesitationMessage,
        sequence_number: hesSeqNum,
        metadata: { hesitation: true },
      })
      const hesitationTranscript = hesTranscriptData as { id: string; content: string; timestamp: string } | null

      // Store state so the follow-up request can resume from here
      startHesitation(test_session_id, {
        assistantId: activeAssistantId,
        organizationId: organization_id,
        // Do NOT include the hesitation message in history — it is injected as a
        // fake tool call in the follow-up so the model knows to proceed to the real tool
        conversationHistory: conversationHistory.filter(
          (h): h is { role: 'user' | 'assistant'; content: string } =>
            h.role === 'user' || h.role === 'assistant'
        ),
        sessionId: test_session_id,
        scenarioTransferNodes: scenarioTransferNodes.length > 0 ? scenarioTransferNodes : undefined,
        hesitationMessage: llmResult.hesitationMessage,
        rawHesitateContent: llmResult.rawHesitateContent,
      })

      return NextResponse.json({
        user_message: {
          id: userTranscript.id,
          content: userTranscript.content,
          timestamp: userTranscript.timestamp,
        },
        hesitation_message: hesitationTranscript
          ? {
              id: hesitationTranscript.id,
              content: hesitationTranscript.content,
              timestamp: hesitationTranscript.timestamp,
            }
          : undefined,
        needs_followup: true,
        voice: { provider: voiceProvider, voiceId },
      })
    }

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
    // Snapshot the pre-transfer agent info for the handoff message
    const handoffAgent = { name: activeAssistantName, avatarUrl: activeAssistantAvatar }

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

        // Update assistant info to the transferred-to assistant
        if (targetNode.data.assistant_id) {
          const { data: targetAssistant } = await supabase
            .from('assistants')
            .select('name, avatar_url, voice_provider, voice_id')
            .eq('id', targetNode.data.assistant_id)
            .single()
          if (targetAssistant) {
            voiceProvider = targetAssistant.voice_provider
            voiceId = targetAssistant.voice_id
            activeAssistantName = targetAssistant.name
            activeAssistantAvatar = targetAssistant.avatar_url
          }
        }
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
          ...conversationHistory,
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
        agent: { name: handoffAgent.name, avatarUrl: handoffAgent.avatarUrl },
      },
      greeting_message: greetingMessage
        ? {
            id: greetingMessage.id,
            content: greetingMessage.content,
            timestamp: greetingMessage.timestamp,
            metadata: greetingMetadata,
            agent: { name: activeAssistantName, avatarUrl: activeAssistantAvatar },
          }
        : undefined,
      transfer: transferInfo,
      voice: { provider: voiceProvider, voiceId },
    })
  } catch (error) {
    console.error('Error in test-chat/send:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
