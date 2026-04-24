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
import {
  getPendingTurn,
  setPendingTurn,
  clearPendingTurn,
  isPendingTurnTimedOut,
} from '@/lib/services/pending-turn-state'
import type { ScenarioTransferNode } from '@/lib/llm/tools/scenario-transfer-tool'
import type { LLMResponseResult } from '@/lib/llm/types'
import type { ScenarioNode } from '@/types/scenarios'
import { renderOpeningMessage } from '@/lib/services/opening-message'

type SessionAssistant = {
  id: string
  name: string
  is_active: boolean
  voice_provider: string | null
  voice_id: string | null
  avatar_url: string | null
}

type TestChatSessionMetadata = {
  scenario_id?: string
  active_node_id?: string
  active_node_label?: string
  active_assistant_id?: string
  caller_number?: string
  called_number?: string
  call_direction?: 'inbound' | 'outbound'
  context_data?: Record<string, unknown>
  scenario_voice_provider?: string | null
  scenario_voice_id?: string | null
  scenario_voice_language?: string | null
}

type TransferOutcome = {
  assistantText: string
  assistantAgent: { name: string; avatarUrl: string | null }
  assistantResult: Pick<LLMResponseResult, 'usage' | 'toolCalls' | 'performance' | 'model'>
  transferInfo: { label: string; handoffMessage?: string } | null
  greeting?: {
    text: string
    agent: { name: string; avatarUrl: string | null }
    result: Pick<LLMResponseResult, 'usage' | 'performance' | 'model'>
  }
  voice: { provider: string | null; voiceId: string | null }
}

const TRANSFER_COMPLETE_PROMPT = '[Transfer complete. Greet the caller briefly and offer your help.]'
const DTMF_GREETING_PROMPT = 'The caller was routed here via the keypad menu.'

function normalizeMetadata(metadata: Record<string, unknown> | null): TestChatSessionMetadata {
  return (metadata ?? {}) as TestChatSessionMetadata
}

function buildConversationHistory(
  history: Array<{ role: string; content: string; metadata?: Record<string, unknown> | null }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history
    .filter((entry) =>
      (entry.role === 'user' || entry.role === 'assistant') &&
      !entry.metadata?.partial_turn &&
      !entry.metadata?.wait_for_turn_filler
    )
    .map((entry) => ({
      role: entry.role === 'user' ? 'user' : 'assistant',
      content: entry.content,
    }))
}

function buildAssistantMetadata(
  result: Pick<LLMResponseResult, 'usage' | 'toolCalls' | 'performance' | 'model'>
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  if (result.usage) metadata.usage = result.usage
  if (result.toolCalls) metadata.toolCalls = result.toolCalls
  if (result.performance) metadata.performance = result.performance
  if (result.model) metadata.model = result.model
  return metadata
}

async function updateTranscriptMetadata(
  supabase: Awaited<ReturnType<typeof createClient>>,
  transcriptId: string,
  metadata: Record<string, unknown>
) {
  await supabase
    .from('test_transcripts')
    .update({ metadata })
    .eq('id', transcriptId)
}

async function resolveTransferOutcome(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  testSessionId: string
  organizationId: string
  metadata: TestChatSessionMetadata
  scenarioNodes: NonNullable<Awaited<ReturnType<typeof getScenarioByIdServiceRole>>['scenario']>
  scenarioTransfer: NonNullable<LLMResponseResult['scenarioTransfer']>
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  baseResult: Pick<LLMResponseResult, 'response' | 'usage' | 'toolCalls' | 'performance' | 'model'>
  currentAgent: { name: string; avatarUrl: string | null }
  currentVoice: { provider: string | null; voiceId: string | null }
  callerNumber?: string
  callDirection?: 'inbound' | 'outbound'
  contextData?: Record<string, unknown> | null
}): Promise<TransferOutcome | null> {
  const {
    supabase,
    testSessionId,
    organizationId,
    metadata,
    scenarioNodes,
    scenarioTransfer,
    conversationHistory,
    baseResult,
    currentAgent,
    currentVoice,
    callerNumber,
    callDirection,
    contextData,
  } = params

  const targetNode = scenarioNodes.nodes.find((node) => node.id === scenarioTransfer.targetNodeId)
  if (!targetNode) return null

  const nextMetadata: Record<string, unknown> = {
    ...metadata,
    active_node_id: targetNode.id,
    active_node_label: targetNode.data.label,
    ...(targetNode.data.assistant_id ? { active_assistant_id: targetNode.data.assistant_id } : {}),
  }

  await supabase
    .from('test_sessions')
    .update({ metadata: nextMetadata })
    .eq('id', testSessionId)

  if (targetNode.data.inherit_voice && targetNode.data.assistant_id) {
    const { data: targetAssistant } = await supabase
      .from('assistants')
      .select('name, avatar_url')
      .eq('id', targetNode.data.assistant_id)
      .single()

    const assistantAgent = {
      name: targetAssistant?.name || targetNode.data.label || 'Assistant',
      avatarUrl: targetAssistant?.avatar_url || null,
    }
    const seamlessVoice = {
      provider: metadata.scenario_voice_provider ?? currentVoice.provider,
      voiceId: metadata.scenario_voice_id ?? currentVoice.voiceId,
    }
    const seamlessHistory = conversationHistory.filter(
      (entry): entry is { role: 'user'; content: string } => entry.role === 'user'
    )

    const seamlessResult = await generateLLMResponse({
      assistantId: targetNode.data.assistant_id,
      organizationId,
      conversationHistory: seamlessHistory,
      testSessionId,
      variableContext: {
        callerNumber,
        callDirection,
      },
      contextData,
      seamlessTransfer: true,
    }).catch(() => null)

    return {
      assistantText: seamlessResult?.response || baseResult.response,
      assistantAgent,
      assistantResult: seamlessResult ?? {},
      transferInfo: null,
      voice: seamlessVoice,
    }
  }

  let voice = currentVoice
  let greeting: TransferOutcome['greeting']

  if (targetNode.data.assistant_id) {
    const { data: targetAssistant } = await supabase
      .from('assistants')
      .select('name, avatar_url, voice_provider, voice_id')
      .eq('id', targetNode.data.assistant_id)
      .single()

    if (targetAssistant) {
      voice = {
        provider: targetAssistant.voice_provider,
        voiceId: targetAssistant.voice_id,
      }

      if (targetNode.data.send_greeting) {
        const greetingHistory = [
          ...conversationHistory,
          { role: 'assistant' as const, content: baseResult.response },
          { role: 'user' as const, content: TRANSFER_COMPLETE_PROMPT },
        ]

        const greetingResult = await generateLLMResponse({
          assistantId: targetNode.data.assistant_id,
          organizationId,
          conversationHistory: greetingHistory,
          testSessionId,
          variableContext: {
            callerNumber,
            callDirection,
          },
          contextData,
        })

        if (greetingResult.response) {
          greeting = {
            text: greetingResult.response,
            agent: {
              name: targetAssistant.name,
              avatarUrl: targetAssistant.avatar_url,
            },
            result: greetingResult,
          }
        }
      }
    }
  }

  return {
    assistantText: baseResult.response,
    assistantAgent: currentAgent,
    assistantResult: baseResult,
    transferInfo: {
      label: targetNode.data.label,
      handoffMessage: scenarioTransfer.handoffMessage,
    },
    greeting,
    voice,
  }
}

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

    const assistant = session.assistants as unknown as SessionAssistant | null
    if (!assistant || !assistant.is_active) {
      return NextResponse.json(
        { error: 'Assistant not found or inactive' },
        { status: 400 }
      )
    }

    const metadata = normalizeMetadata(session.metadata as Record<string, unknown> | null)
    const scenarioId = metadata.scenario_id || null
    const activeNodeId = metadata.active_node_id || null
    const callerNumber = metadata.caller_number
    const callDirection = metadata.call_direction || 'inbound'
    const contextData = metadata.context_data || null

    let activeAssistantId = assistant.id
    let scenarioTransferNodes: ScenarioTransferNode[] = []
    let scenarioNodes = null as Awaited<ReturnType<typeof getScenarioByIdServiceRole>>['scenario'] | null

    if (scenarioId && activeNodeId) {
      const { scenario } = await getScenarioByIdServiceRole(scenarioId)
      if (scenario) {
        scenarioNodes = scenario
        const activeNode = scenario.nodes.find((node) => node.id === activeNodeId)
        if (activeNode?.data.assistant_id) {
          activeAssistantId = activeNode.data.assistant_id
        }

        const reachableNodeIds = scenario.edges
          .filter((edge) => edge.source === activeNodeId)
          .map((edge) => edge.target)

        scenarioTransferNodes = scenario.nodes
          .filter((node) => reachableNodeIds.includes(node.id) && node.data.assistant_id)
          .map((node) => ({
            nodeId: node.id,
            assistantId: node.data.assistant_id!,
            label: node.data.label,
            transferInstruction: node.data.transfer_instruction ?? '',
            inheritVoice: node.data.inherit_voice ?? false,
          }))
      }
    }

    // ── DTMF routing (bypasses LLM entirely) ────────────────────────────────
    const dtmfInput = body.dtmf_input as string | undefined
    if (dtmfInput !== undefined && scenarioId && activeNodeId && scenarioNodes) {
      const currentActiveNode = scenarioNodes.nodes.find((node) => node.id === activeNodeId)
      if (currentActiveNode?.type === 'dtmf_menu' || currentActiveNode?.type === 'dtmf_collect') {
        let userText: string
        let nextNode: ScenarioNode | undefined
        let isInvalidKey = false

        if (currentActiveNode.type === 'dtmf_menu') {
          const digit = dtmfInput[0] || ''
          userText = `[DTMF Menu] Key ${digit}`
          const matchingEdge = scenarioNodes.edges.find(
            (edge) => edge.source === activeNodeId && String(edge.label) === digit
          )
          if (!matchingEdge) {
            isInvalidKey = true
            nextNode = currentActiveNode
          } else {
            nextNode = scenarioNodes.nodes.find((node) => node.id === matchingEdge.target)
          }
        } else {
          userText = `[DTMF] ${dtmfInput}`
          const outboundEdge = scenarioNodes.edges.find((edge) => edge.source === activeNodeId)
          nextNode = outboundEdge
            ? scenarioNodes.nodes.find((node) => node.id === outboundEdge.target)
            : undefined
        }

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

        const scenarioVoice = {
          provider: metadata.scenario_voice_provider ?? assistant.voice_provider,
          voiceId: metadata.scenario_voice_id ?? assistant.voice_id,
        }

        let assistantText: string | null = null
        let nextAssistantName: string | null = null
        let nextAssistantAvatar: string | null = null
        let dtmfVoice = scenarioVoice

        if (isInvalidKey) {
          assistantText = currentActiveNode.data.error_prompt || currentActiveNode.data.prompt || null
        } else if (nextNode) {
          if (nextNode.data.prompt) {
            assistantText = nextNode.data.prompt
          } else if (nextNode.data.assistant_id) {
            const { data: nextAssistant } = await supabase
              .from('assistants')
              .select('opening_message, name, avatar_url, voice_provider, voice_id')
              .eq('id', nextNode.data.assistant_id)
              .single()

            assistantText = renderOpeningMessage({
              template: nextAssistant?.opening_message,
              assistantName: nextAssistant?.name || nextNode.data.label || 'Assistant',
              callerNumber,
              callDirection,
              contextData,
            })

            if (!assistantText && nextNode.data.send_greeting) {
              const greetingResult = await generateLLMResponse({
                assistantId: nextNode.data.assistant_id,
                organizationId: organization_id,
                conversationHistory: [
                  { role: 'assistant', content: DTMF_GREETING_PROMPT },
                  { role: 'user', content: TRANSFER_COMPLETE_PROMPT },
                ],
                testSessionId: test_session_id,
                variableContext: {
                  callerNumber,
                  callDirection,
                },
                contextData,
              })
              assistantText = greetingResult.response || null
            }

            nextAssistantName = nextAssistant?.name ?? null
            nextAssistantAvatar = nextAssistant?.avatar_url ?? null
            dtmfVoice = {
              provider: nextAssistant?.voice_provider ?? dtmfVoice.provider,
              voiceId: nextAssistant?.voice_id ?? dtmfVoice.voiceId,
            }
          }
        }

        if (!isInvalidKey && nextNode && nextNode.id !== activeNodeId) {
          await supabase
            .from('test_sessions')
            .update({
              metadata: {
                ...metadata,
                active_node_id: nextNode.id,
                active_node_label: nextNode.data.label,
                ...(nextNode.data.assistant_id ? { active_assistant_id: nextNode.data.assistant_id } : {}),
              },
            })
            .eq('id', test_session_id)
        }

        let dtmfAssistantMsg: { id: string; content: string; timestamp: string } | null = null
        if (assistantText) {
          const { sequenceNumber: dtmfAssistantSeq } = await getNextSequenceNumber(test_session_id)
          const { transcript: dtmfAssistantTranscript } = await addTestTranscriptMessage({
            test_session_id,
            organization_id,
            role: 'assistant',
            content: assistantText,
            sequence_number: dtmfAssistantSeq,
            metadata: { dtmf_response: true, invalid_key: isInvalidKey || undefined },
          })
          dtmfAssistantMsg = dtmfAssistantTranscript as { id: string; content: string; timestamp: string } | null
        }

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
          voice: dtmfVoice,
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

    // ── Path A: follow-up after hesitation ──────────────────────────────────
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
          assistant_message: {
            id: errorTranscript?.id,
            content: errorMessage,
            timestamp: errorTranscript?.timestamp,
          },
          error: followUpResult.error,
        })
      }

      const transferOutcome = followUpResult.scenarioTransfer && scenarioId && scenarioNodes
        ? await resolveTransferOutcome({
            supabase,
            testSessionId: test_session_id,
            organizationId: organization_id,
            metadata,
            scenarioNodes,
            scenarioTransfer: followUpResult.scenarioTransfer,
            conversationHistory: hesitationState.conversationHistory,
            baseResult: followUpResult,
            currentAgent: { name: activeAssistantName, avatarUrl: activeAssistantAvatar },
            currentVoice: { provider: voiceProvider, voiceId },
            callerNumber: hesitationState.variableContext?.callerNumber,
            callDirection: hesitationState.variableContext?.callDirection,
            contextData: hesitationState.contextData,
          })
        : null

      const assistantPayload = transferOutcome ?? {
        assistantText: followUpResult.response,
        assistantAgent: { name: activeAssistantName, avatarUrl: activeAssistantAvatar },
        assistantResult: followUpResult,
        transferInfo: null,
        greeting: undefined,
        voice: { provider: voiceProvider, voiceId },
      }

      const assistantMetadata = buildAssistantMetadata(assistantPayload.assistantResult)
      const { sequenceNumber: assistantSeqNum } = await getNextSequenceNumber(test_session_id)
      const { transcript: assistantTranscriptData, error: assistantError } =
        await addTestTranscriptMessage({
          test_session_id,
          organization_id,
          role: 'assistant',
          content: assistantPayload.assistantText,
          sequence_number: assistantSeqNum,
          metadata: assistantMetadata,
        })

      const assistantTranscript = assistantTranscriptData as { id: string; content: string; timestamp: string } | null
      if (assistantError || !assistantTranscript) {
        return NextResponse.json({ error: 'Failed to save assistant response' }, { status: 500 })
      }

      let greetingMessage: { id: string; content: string; timestamp: string } | null = null
      let greetingMetadata: Record<string, unknown> = {}

      if (assistantPayload.greeting) {
        greetingMetadata = buildAssistantMetadata(assistantPayload.greeting.result)
        const { sequenceNumber: greetingSeqNum } = await getNextSequenceNumber(test_session_id)
        const { transcript: greetingTranscriptData } = await addTestTranscriptMessage({
          test_session_id,
          organization_id,
          role: 'assistant',
          content: assistantPayload.greeting.text,
          sequence_number: greetingSeqNum,
          metadata: greetingMetadata,
        })
        greetingMessage = greetingTranscriptData as { id: string; content: string; timestamp: string } | null
      }

      return NextResponse.json({
        assistant_message: {
          id: assistantTranscript.id,
          content: assistantTranscript.content,
          timestamp: assistantTranscript.timestamp,
          metadata: assistantMetadata,
          agent: assistantPayload.assistantAgent,
        },
        greeting_message: greetingMessage
          ? {
              id: greetingMessage.id,
              content: greetingMessage.content,
              timestamp: greetingMessage.timestamp,
              metadata: greetingMetadata,
              agent: assistantPayload.greeting?.agent,
            }
          : undefined,
        transfer: assistantPayload.transferInfo,
        voice: assistantPayload.voice,
      })
    }

    // ── Path B: normal message ───────────────────────────────────────────────
    const pendingPartial = getPendingTurn(test_session_id)
    const effectiveMessage = pendingPartial ? `${pendingPartial} ${message}`.trim() : message
    clearPendingTurn(test_session_id)

    const userMetadata: Record<string, unknown> = {
      ...(pendingPartial ? { combined_from_partial: true } : {}),
    }

    const { sequenceNumber: userSeqNum } = await getNextSequenceNumber(test_session_id)
    const { transcript: userTranscriptData, error: userError } =
      await addTestTranscriptMessage({
        test_session_id,
        organization_id,
        role: 'user',
        content: effectiveMessage,
        sequence_number: userSeqNum,
        metadata: userMetadata,
      })

    const userTranscript = userTranscriptData as { id: string; content: string; timestamp: string } | null
    if (userError || !userTranscript) {
      return NextResponse.json({ error: 'Failed to save user message' }, { status: 500 })
    }

    const { history, error: historyError } = await getTestSessionHistory(test_session_id)
    if (historyError) {
      return NextResponse.json({ error: 'Failed to fetch conversation history' }, { status: 500 })
    }

    const conversationHistory = buildConversationHistory(history)

    const llmResult = await generateLLMResponse({
      assistantId: activeAssistantId,
      organizationId: organization_id,
      conversationHistory,
      testSessionId: test_session_id,
      variableContext: {
        callerNumber,
        callDirection,
      },
      contextData,
      scenarioTransferNodes: scenarioTransferNodes.length > 0 ? scenarioTransferNodes : undefined,
      disableWaitForTurn: isPendingTurnTimedOut(test_session_id),
    })

    if (llmResult.waitForTurn) {
      const partialMetadata = {
        ...userMetadata,
        partial_turn: true,
      }

      await updateTranscriptMetadata(supabase, userTranscript.id, partialMetadata)
      setPendingTurn(test_session_id, effectiveMessage)

      let waitTranscript: { id: string; content: string; timestamp: string } | null = null
      if (llmResult.waitForTurnFiller) {
        const { sequenceNumber: waitSeqNum } = await getNextSequenceNumber(test_session_id)
        const { transcript: waitTranscriptData } = await addTestTranscriptMessage({
          test_session_id,
          organization_id,
          role: 'assistant',
          content: llmResult.waitForTurnFiller,
          sequence_number: waitSeqNum,
          metadata: { wait_for_turn_filler: true },
        })
        waitTranscript = waitTranscriptData as { id: string; content: string; timestamp: string } | null
      }

      return NextResponse.json({
        user_message: {
          id: userTranscript.id,
          content: userTranscript.content,
          timestamp: userTranscript.timestamp,
          metadata: partialMetadata,
        },
        assistant_message: waitTranscript
          ? {
              id: waitTranscript.id,
              content: waitTranscript.content,
              timestamp: waitTranscript.timestamp,
              metadata: { wait_for_turn_filler: true },
              agent: { name: activeAssistantName, avatarUrl: activeAssistantAvatar },
            }
          : undefined,
        wait_for_turn: true,
        voice: { provider: voiceProvider, voiceId },
      })
    }

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

      startHesitation(test_session_id, {
        assistantId: activeAssistantId,
        organizationId: organization_id,
        conversationHistory,
        testSessionId: test_session_id,
        variableContext: {
          callerNumber,
          callDirection,
        },
        contextData,
        scenarioTransferNodes: scenarioTransferNodes.length > 0 ? scenarioTransferNodes : undefined,
        hesitationMessage: llmResult.hesitationMessage,
        rawHesitateContent: llmResult.rawHesitateContent,
      })

      return NextResponse.json({
        user_message: {
          id: userTranscript.id,
          content: userTranscript.content,
          timestamp: userTranscript.timestamp,
          metadata: userMetadata,
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
        user_message: {
          id: userTranscript.id,
          content: userTranscript.content,
          timestamp: userTranscript.timestamp,
          metadata: userMetadata,
        },
        assistant_message: {
          id: errorTranscript?.id,
          content: errorMessage,
          timestamp: errorTranscript?.timestamp,
        },
        error: llmResult.error,
      })
    }

    const transferOutcome = llmResult.scenarioTransfer && scenarioId && scenarioNodes
      ? await resolveTransferOutcome({
          supabase,
          testSessionId: test_session_id,
          organizationId: organization_id,
          metadata,
          scenarioNodes,
          scenarioTransfer: llmResult.scenarioTransfer,
          conversationHistory,
          baseResult: llmResult,
          currentAgent: { name: activeAssistantName, avatarUrl: activeAssistantAvatar },
          currentVoice: { provider: voiceProvider, voiceId },
          callerNumber,
          callDirection,
          contextData,
        })
      : null

    const assistantPayload = transferOutcome ?? {
      assistantText: llmResult.response,
      assistantAgent: { name: activeAssistantName, avatarUrl: activeAssistantAvatar },
      assistantResult: llmResult,
      transferInfo: null,
      greeting: undefined,
      voice: { provider: voiceProvider, voiceId },
    }

    const assistantMetadata = buildAssistantMetadata(assistantPayload.assistantResult)
    const { sequenceNumber: assistantSeqNum } = await getNextSequenceNumber(test_session_id)
    const { transcript: assistantTranscriptData, error: assistantError } =
      await addTestTranscriptMessage({
        test_session_id,
        organization_id,
        role: 'assistant',
        content: assistantPayload.assistantText,
        sequence_number: assistantSeqNum,
        metadata: assistantMetadata,
      })

    const assistantTranscript = assistantTranscriptData as { id: string; content: string; timestamp: string } | null
    if (assistantError || !assistantTranscript) {
      return NextResponse.json({ error: 'Failed to save assistant response' }, { status: 500 })
    }

    let greetingMessage: { id: string; content: string; timestamp: string } | null = null
    let greetingMetadata: Record<string, unknown> = {}

    if (assistantPayload.greeting) {
      greetingMetadata = buildAssistantMetadata(assistantPayload.greeting.result)
      const { sequenceNumber: greetingSeqNum } = await getNextSequenceNumber(test_session_id)
      const { transcript: greetingTranscriptData } = await addTestTranscriptMessage({
        test_session_id,
        organization_id,
        role: 'assistant',
        content: assistantPayload.greeting.text,
        sequence_number: greetingSeqNum,
        metadata: greetingMetadata,
      })
      greetingMessage = greetingTranscriptData as { id: string; content: string; timestamp: string } | null
    }

    return NextResponse.json({
      user_message: {
        id: userTranscript.id,
        content: userTranscript.content,
        timestamp: userTranscript.timestamp,
        metadata: userMetadata,
      },
      assistant_message: {
        id: assistantTranscript.id,
        content: assistantTranscript.content,
        timestamp: assistantTranscript.timestamp,
        metadata: assistantMetadata,
        agent: assistantPayload.assistantAgent,
      },
      greeting_message: greetingMessage
        ? {
            id: greetingMessage.id,
            content: greetingMessage.content,
            timestamp: greetingMessage.timestamp,
            metadata: greetingMetadata,
            agent: assistantPayload.greeting?.agent,
          }
        : undefined,
      transfer: assistantPayload.transferInfo,
      voice: assistantPayload.voice,
    })
  } catch (error) {
    console.error('Error in test-chat/send:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
