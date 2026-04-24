'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Send, GitBranch, Bot, Mic, MicOff, Volume2, VolumeX, TriangleAlert, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MessageList } from './message-list'
import { SessionHistorySidebar } from './session-history-sidebar'
import { useSpeechRecognition } from './use-speech-recognition'
import { toast } from 'sonner'

interface MessageMetadata {
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown>; result: string }>
  toolCallData?: { arguments: Record<string, unknown>; result: string }
  performance?: { ttftMs: number; totalTimeMs: number; tokensPerSecond: number }
  model?: string
  hesitation?: boolean
  partial_turn?: boolean
  combined_from_partial?: boolean
  wait_for_turn_filler?: boolean
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: string
  metadata?: MessageMetadata
  agentLabel?: string
  agentAvatarUrl?: string | null
}

interface Assistant {
  id: string
  name: string
}

interface Flow {
  id: string
  name: string
}

interface TestSession {
  id: string
  name: string | null
  assistant_id: string
  last_message_at: string
  assistants?: {
    name: string
  }
}

interface ChatSimulatorProps {
  organizationId: string
  assistants: Assistant[]
  flows: Flow[]
  initialSessions: TestSession[]
}

export function ChatSimulator({
  organizationId,
  assistants,
  flows,
  initialSessions,
}: ChatSimulatorProps) {
  const t = useTranslations('chatSimulator')
  // Value format: "assistant:<id>" or "flow:<id>"
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessions, setSessions] = useState<TestSession[]>(initialSessions)
  const [activeAgentLabel, setActiveAgentLabel] = useState<string | null>(null)
  const [activeNodeType, setActiveNodeType] = useState<string | null>(null)
  const [dtmfCollectValue, setDtmfCollectValue] = useState('')

  // Voice state
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [ttsWarning, setTtsWarning] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceConfig, setVoiceConfig] = useState<{ provider: string | null; voiceId: string | null }>({ provider: null, voiceId: null })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { isListening, transcript, isSupported: sttSupported, start: startListening, stop: stopListening, reset: resetTranscript } = useSpeechRecognition()

  // Sync speech transcript into input field
  useEffect(() => {
    if (transcript) {
      setInputValue(transcript)
    }
  }, [transcript])

  const speakText = useCallback(async (text: string, voice?: { provider: string | null; voiceId: string | null }) => {
    if (!ttsEnabled) return

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()

    const vc = voice ?? voiceConfig

    setIsSpeaking(true)
    try {
      // ElevenLabs TTS via server route
      if (vc.provider === 'elevenlabs' && vc.voiceId) {
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceId: vc.voiceId }),
          })
          if (res.ok) {
            setTtsWarning(null)
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const audio = new Audio(url)
            audioRef.current = audio
            await new Promise<void>((resolve) => {
              audio.onended = () => { URL.revokeObjectURL(url); resolve() }
              audio.onerror = () => { URL.revokeObjectURL(url); resolve() }
              audio.play()
            })
            return
          }
          const err = await res.json().catch(() => null)
          const msg = err?.error || `ElevenLabs ${res.status}`
          setTtsWarning(msg)
        } catch (e) {
          setTtsWarning(String(e))
        }
      }

      // Browser TTS fallback
      if (window.speechSynthesis) {
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = 'de-DE'
          utterance.onend = () => resolve()
          utterance.onerror = () => resolve()
          window.speechSynthesis.speak(utterance)
        })
      }
    } finally {
      setIsSpeaking(false)
    }
  }, [ttsEnabled, voiceConfig])

  const toggleTts = useCallback(() => {
    setTtsEnabled((prev) => {
      if (prev) {
        // Turning off — stop any playing audio
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }
        window.speechSynthesis?.cancel()
      }
      return !prev
    })
  }, [])

  const toggleMic = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      resetTranscript()
      startListening()
    }
  }, [isListening, stopListening, startListening, resetTranscript])

  const selectedAssistantId = selectedValue?.startsWith('assistant:')
    ? selectedValue.slice('assistant:'.length)
    : null
  const selectedFlowId = selectedValue?.startsWith('flow:')
    ? selectedValue.slice('flow:'.length)
    : null

  const handleSelectionChange = (value: string) => {
    setSelectedValue(value)
    setCurrentSessionId(null)
    setMessages([])
    setInputValue('')
    setActiveAgentLabel(null)
    setActiveNodeType(null)
    setDtmfCollectValue('')
  }

  const handleNewChat = async () => {
    if (!selectedValue) {
      toast.error(t('errors.selectAssistant'))
      return
    }

    try {
      setIsLoading(true)
      const body = selectedFlowId
        ? { organization_id: organizationId, scenario_id: selectedFlowId }
        : { organization_id: organizationId, assistant_id: selectedAssistantId }

      const response = await fetch('/api/test-chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error('Failed to create session')
      }

      const data = await response.json()
      setCurrentSessionId(data.session.id)

      const newVoice = data.voice
        ? { provider: data.voice.provider, voiceId: data.voice.voiceId }
        : null
      if (newVoice) setVoiceConfig(newVoice)

      if (data.session.active_node_label) {
        setActiveAgentLabel(data.session.active_node_label)
      } else {
        setActiveAgentLabel(null)
      }
      setActiveNodeType(data.active_node_type ?? null)
      setDtmfCollectValue('')

      const newMessages: Message[] = []
      if (data.opening_message) {
        newMessages.push({
          id: data.opening_message.id,
          role: 'assistant',
          content: data.opening_message.content,
          timestamp: data.opening_message.timestamp,
          agentLabel: data.agent?.name,
          agentAvatarUrl: data.agent?.avatarUrl,
        })
        speakText(data.opening_message.content, newVoice ?? undefined)
      }
      setMessages(newMessages)

      const label = selectedFlowId
        ? flows.find((f) => f.id === selectedFlowId)?.name
        : assistants.find((a) => a.id === selectedAssistantId)?.name

      setSessions((prev) => [
        {
          id: data.session.id,
          name: data.session.name,
          assistant_id: data.session.assistant_id,
          last_message_at: data.session.started_at,
          assistants: label ? { name: label } : undefined,
        },
        ...prev,
      ])

      toast.success(t('success.chatCreated', { name: label || 'assistant' }))
    } catch (error) {
      console.error('Error creating session:', error)
      toast.error(t('errors.createSession'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!currentSessionId || !inputValue.trim()) return

    if (inputValue.length > 2000) {
      toast.error(t('errors.maxLength'))
      return
    }

    const userMessage = inputValue.trim()
    const optimisticId = `optimistic-${Date.now()}`
    setInputValue('')
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      },
    ])
    setIsLoading(true)

    // Helper: append assistant response data (assistant_message, transfer, greeting) to
    // the message list and speak them. Used for both the normal path and the hesitation
    // follow-up path so the logic is not duplicated.
    const applyAssistantData = async (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      d: any,
      voiceOverride: { provider: string | null; voiceId: string | null } | null,
    ) => {
      const meta: MessageMetadata | undefined = d.assistant_message?.metadata
        ? {
            usage: d.assistant_message.metadata.usage,
            toolCalls: d.assistant_message.metadata.toolCalls,
            performance: d.assistant_message.metadata.performance,
            model: d.assistant_message.metadata.model,
          }
        : undefined

      const msgs: Message[] = []

      if (meta?.toolCalls) {
        for (const tc of meta.toolCalls) {
          msgs.push({
            id: `tool-${d.assistant_message.id}-${tc.name}`,
            role: 'tool',
            content: tc.name,
            timestamp: d.assistant_message.timestamp,
            metadata: { toolCallData: { arguments: tc.arguments, result: tc.result } },
          })
        }
      }

      msgs.push({
        id: d.assistant_message.id,
        role: 'assistant',
        content: d.assistant_message.content,
        timestamp: d.assistant_message.timestamp,
        metadata: meta,
        agentLabel: d.assistant_message.agent?.name,
        agentAvatarUrl: d.assistant_message.agent?.avatarUrl,
      })

      if (d.transfer) {
        msgs.push({
          id: `transfer-${d.assistant_message.id}`,
          role: 'system',
          content: `↪ Transferred to ${d.transfer.label}`,
          timestamp: d.assistant_message.timestamp,
        })
        setActiveAgentLabel(d.transfer.label)
      }

      if (d.greeting_message) {
        msgs.push({
          id: d.greeting_message.id,
          role: 'assistant',
          content: d.greeting_message.content,
          timestamp: d.greeting_message.timestamp,
          metadata: d.greeting_message.metadata as MessageMetadata | undefined,
          agentLabel: d.greeting_message.agent?.name,
          agentAvatarUrl: d.greeting_message.agent?.avatarUrl,
        })
      }

      setMessages((prev) => [...prev, ...msgs])
      setIsLoading(false)

      const newVoice = voiceOverride ?? (d.voice ? { provider: d.voice.provider, voiceId: d.voice.voiceId } : null)
      if (d.transfer && d.greeting_message) {
        await speakText(d.assistant_message.content)
        if (newVoice) setVoiceConfig(newVoice)
        await speakText(d.greeting_message.content, newVoice ?? undefined)
      } else {
        if (newVoice) setVoiceConfig(newVoice)
        await speakText(d.assistant_message.content)
      }

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, last_message_at: d.assistant_message.timestamp }
            : s
        )
      )
    }

    try {
      const response = await fetch('/api/test-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_session_id: currentSessionId,
          message: userMessage,
          organization_id: organizationId,
        }),
      })

      if (!response.ok) throw new Error('Failed to send message')

      const data = await response.json()

      // Replace optimistic user message with the real one from the server
      setMessages((prev) => {
        const base = data.user_message?.metadata?.combined_from_partial
          ? prev.filter((m) => !m.metadata?.partial_turn && !m.metadata?.wait_for_turn_filler)
          : prev

        return base.map((m) =>
          m.id === optimisticId
            ? {
                ...m,
                id: data.user_message.id,
                content: data.user_message.content,
                timestamp: data.user_message.timestamp,
                metadata: data.user_message.metadata as MessageMetadata | undefined,
              }
            : m
        )
      })

      const firstVoice = data.voice
        ? { provider: data.voice.provider, voiceId: data.voice.voiceId }
        : null

      if (data.wait_for_turn) {
        if (data.assistant_message) {
          setMessages((prev) => [
            ...prev,
            {
              id: data.assistant_message.id,
              role: 'assistant' as const,
              content: data.assistant_message.content,
              timestamp: data.assistant_message.timestamp,
              metadata: data.assistant_message.metadata as MessageMetadata | undefined,
              agentLabel: data.assistant_message.agent?.name,
              agentAvatarUrl: data.assistant_message.agent?.avatarUrl,
            },
          ])
          await speakText(data.assistant_message.content, firstVoice ?? undefined)
        }
        setIsLoading(false)
        return
      }

      if (data.needs_followup) {
        // Phase 1: show the hesitation message immediately and speak it
        if (data.hesitation_message) {
          setMessages((prev) => [
            ...prev,
            {
              id: data.hesitation_message.id,
              role: 'assistant' as const,
              content: data.hesitation_message.content,
              timestamp: data.hesitation_message.timestamp,
              metadata: { hesitation: true },
            },
          ])
          await speakText(data.hesitation_message.content)
        }

        // Phase 2: fetch the actual tool response (loading indicator stays active)
        const followUpResponse = await fetch('/api/test-chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            test_session_id: currentSessionId,
            organization_id: organizationId,
            continue_after_hesitation: true,
          }),
        })
        if (!followUpResponse.ok) throw new Error('Failed to get follow-up response')
        const followUpData = await followUpResponse.json()
        await applyAssistantData(followUpData, firstVoice)
        return
      }

      // Normal path (no hesitation)
      await applyAssistantData(data, firstVoice)
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(t('errors.sendMessage'))
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setInputValue(userMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoadSession = async (sessionId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/test-chat/session/${sessionId}/history`)

      if (!response.ok) throw new Error('Failed to load session')

      const data = await response.json()
      const session = sessions.find((s) => s.id === sessionId)

      setCurrentSessionId(sessionId)
      setSelectedValue(session?.assistant_id ? `assistant:${session.assistant_id}` : null)
      setActiveAgentLabel(null)
      setActiveNodeType(null)
      setDtmfCollectValue('')
      const loadedMessages: Message[] = []
      const rawHistory = data.history as Array<{ id: string; role: string; content: string; timestamp: string; metadata?: Record<string, unknown> }>
      const collapsePartialTurns = rawHistory.some((h) => h.metadata?.combined_from_partial)

      for (const h of rawHistory) {
        if (collapsePartialTurns && (h.metadata?.partial_turn || h.metadata?.wait_for_turn_filler)) {
          continue
        }

        // Insert virtual tool messages from metadata before assistant messages
        if (h.role === 'assistant' && h.metadata?.toolCalls) {
          const toolCalls = h.metadata.toolCalls as Array<{ name: string; arguments: Record<string, unknown>; result: string }>
          for (const tc of toolCalls) {
            loadedMessages.push({
              id: `tool-${h.id}-${tc.name}`,
              role: 'tool',
              content: tc.name,
              timestamp: h.timestamp,
              metadata: { toolCallData: { arguments: tc.arguments, result: tc.result } },
            })
          }
        }
        loadedMessages.push({
          id: h.id,
          role: h.role as Message['role'],
          content: h.content,
          timestamp: h.timestamp,
          metadata: h.metadata as MessageMetadata | undefined,
        })
      }
      setMessages(loadedMessages)
      setInputValue('')

      toast.success(t('success.sessionLoaded', { name: session?.assistants?.name || 'assistant' }))
    } catch (error) {
      console.error('Error loading session:', error)
      toast.error(t('errors.loadSession'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/test-chat/session/${sessionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete session')

      setSessions((prev) => prev.filter((s) => s.id !== sessionId))

      if (currentSessionId === sessionId) {
        setCurrentSessionId(null)
        setMessages([])
        setActiveAgentLabel(null)
        setActiveNodeType(null)
        setDtmfCollectValue('')
      }

      toast.success(t('success.sessionDeleted'))
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error(t('errors.deleteSession'))
    }
  }

  const handleDTMFSend = useCallback(async (dtmfValue: string) => {
    if (!currentSessionId || !dtmfValue || isLoading) return

    const optimisticId = `dtmf-opt-${Date.now()}`
    const displayText = activeNodeType === 'dtmf_menu'
      ? `[DTMF Menu] Key ${dtmfValue}`
      : `[DTMF] ${dtmfValue}`

    setMessages((prev) => [...prev, {
      id: optimisticId,
      role: 'user' as const,
      content: displayText,
      timestamp: new Date().toISOString(),
    }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/test-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_session_id: currentSessionId,
          dtmf_input: dtmfValue,
          organization_id: organizationId,
        }),
      })

      if (!response.ok) throw new Error('Failed to send DTMF')
      const data = await response.json()

      // Replace optimistic message with real one
      if (data.user_message) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? { ...m, id: data.user_message.id, timestamp: data.user_message.timestamp }
              : m
          )
        )
      }

      // Add assistant response
      if (data.assistant_message) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.assistant_message.id,
            role: 'assistant' as const,
            content: data.assistant_message.content,
            timestamp: data.assistant_message.timestamp,
            agentLabel: data.assistant_message.agent?.name,
            agentAvatarUrl: data.assistant_message.agent?.avatarUrl,
          },
        ])
        setIsLoading(false)
        await speakText(data.assistant_message.content)
      }

      // Update active node type and label
      if (data.active_node_type !== undefined) setActiveNodeType(data.active_node_type)
      if (data.active_node_label) setActiveAgentLabel(data.active_node_label)
      if (data.voice) setVoiceConfig({ provider: data.voice.provider, voiceId: data.voice.voiceId })
    } catch {
      toast.error(t('errors.sendMessage'))
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
    } finally {
      setIsLoading(false)
    }
  }, [currentSessionId, isLoading, activeNodeType, organizationId, speakText, t])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Select value={selectedValue || ''} onValueChange={handleSelectionChange}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder={t('selectAssistant')} />
              </SelectTrigger>
              <SelectContent>
                {assistants.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5" />
                      {t('assistantsGroup')}
                    </SelectLabel>
                    {assistants.map((a) => (
                      <SelectItem key={a.id} value={`assistant:${a.id}`}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {flows.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5" />
                      {t('flowsGroup')}
                    </SelectLabel>
                    {flows.map((f) => (
                      <SelectItem key={f.id} value={`flow:${f.id}`}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>

            <Button
              onClick={handleNewChat}
              disabled={!selectedValue || isLoading}
              variant="default"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('newChat')}
            </Button>

            {activeAgentLabel && (
              <Badge variant="secondary" className="gap-1.5">
                <GitBranch className="h-3 w-3" />
                {activeAgentLabel}
              </Badge>
            )}

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={ttsEnabled ? 'default' : 'outline'}
                    size="icon"
                    onClick={toggleTts}
                    className={ttsEnabled ? 'bg-lime-500 hover:bg-lime-600 dark:bg-lime-600 dark:hover:bg-lime-500 text-white' : ''}
                  >
                    {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t(ttsEnabled ? 'voice.ttsOn' : 'voice.ttsOff')}</TooltipContent>
              </Tooltip>
              {ttsEnabled && ttsWarning && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/40 cursor-default">
                      <TriangleAlert className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium text-amber-600 dark:text-amber-400">{t('voice.ttsFallback')}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{ttsWarning}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <SessionHistorySidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleLoadSession}
            onDeleteSession={handleDeleteSession}
          />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 bg-white dark:bg-neutral-950">
        {!currentSessionId ? (
          <div className="flex items-center justify-center h-full text-center text-neutral-500 dark:text-neutral-400">
            <div>
              <p className="text-lg font-medium mb-2">{t('welcome')}</p>
              <p className="text-sm">{t('welcomeHint')}</p>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} isLoading={isLoading} isSpeaking={isSpeaking} />
        )}
      </div>

      {/* DTMF Input Area */}
      {currentSessionId && (activeNodeType === 'dtmf_menu' || activeNodeType === 'dtmf_collect') && (
        <div className="border-t px-6 py-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3 flex items-center gap-1.5">
            <Hash className="h-3 w-3" />
            {activeNodeType === 'dtmf_menu' ? t('dtmf.menuMode') : t('dtmf.collectMode')}
          </p>
          {activeNodeType === 'dtmf_menu' ? (
            <div className="grid grid-cols-3 gap-1.5 w-fit">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  className="w-12 h-10 font-mono text-base"
                  disabled={isLoading}
                  onClick={() => handleDTMFSend(key)}
                >
                  {key}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={dtmfCollectValue}
                onChange={(e) => setDtmfCollectValue(e.target.value.replace(/[^0-9*#]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleDTMFSend(dtmfCollectValue)
                    setDtmfCollectValue('')
                  }
                }}
                placeholder={t('dtmf.collectPlaceholder')}
                className="font-mono w-44"
                disabled={isLoading}
              />
              <Button
                onClick={() => { handleDTMFSend(dtmfCollectValue); setDtmfCollectValue('') }}
                disabled={!dtmfCollectValue || isLoading}
                className="bg-lime-500 hover:bg-lime-600 dark:bg-lime-600 dark:hover:bg-lime-500 text-white"
              >
                {t('dtmf.collectSubmit')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Text Input Area (hidden in DTMF mode) */}
      {currentSessionId && activeNodeType !== 'dtmf_menu' && activeNodeType !== 'dtmf_collect' && (
        <div className="border-t px-6 py-4">
          <div className="flex gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? t('voice.listening') : t('inputPlaceholder')}
              className={`resize-none ${isListening ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              rows={3}
              disabled={isLoading}
            />
            <div className="flex flex-col gap-1.5 self-stretch">
              {sttSupported && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isListening ? 'destructive' : 'outline'}
                      size="icon"
                      onClick={toggleMic}
                      disabled={isLoading}
                      className={`h-0 flex-1 w-10 ${isListening ? 'animate-pulse' : ''}`}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t(isListening ? 'voice.stopListening' : 'voice.startListening')}</TooltipContent>
                </Tooltip>
              )}
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="h-0 flex-1 w-10 bg-lime-500 hover:bg-lime-600 dark:bg-lime-600 dark:hover:bg-lime-500 text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
            {t('characters', { count: inputValue.length })}
          </p>
        </div>
      )}
    </div>
    </TooltipProvider>
  )
}
