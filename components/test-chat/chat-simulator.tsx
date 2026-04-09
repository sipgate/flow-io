'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Send, GitBranch, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { MessageList } from './message-list'
import { SessionHistorySidebar } from './session-history-sidebar'
import { toast } from 'sonner'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
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

      if (data.session.active_node_label) {
        setActiveAgentLabel(data.session.active_node_label)
      } else {
        setActiveAgentLabel(null)
      }

      const newMessages: Message[] = []
      if (data.opening_message) {
        newMessages.push({
          id: data.opening_message.id,
          role: 'assistant',
          content: data.opening_message.content,
          timestamp: data.opening_message.timestamp,
        })
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
    setInputValue('')
    setIsLoading(true)

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

      const newMessages: Message[] = [
        {
          id: data.user_message.id,
          role: 'user',
          content: data.user_message.content,
          timestamp: data.user_message.timestamp,
        },
        {
          id: data.assistant_message.id,
          role: 'assistant',
          content: data.assistant_message.content,
          timestamp: data.assistant_message.timestamp,
        },
      ]

      // Insert a system transfer notification and optional greeting after the handoff message
      if (data.transfer) {
        newMessages.splice(1, 0, {
          id: `transfer-${data.assistant_message.id}`,
          role: 'system',
          content: `↪ Transferred to ${data.transfer.label}`,
          timestamp: data.assistant_message.timestamp,
        })
        setActiveAgentLabel(data.transfer.label)
      }

      if (data.greeting_message) {
        newMessages.push({
          id: data.greeting_message.id,
          role: 'assistant',
          content: data.greeting_message.content,
          timestamp: data.greeting_message.timestamp,
        })
      }

      setMessages((prev) => [...prev, ...newMessages])

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, last_message_at: data.assistant_message.timestamp }
            : s
        )
      )
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(t('errors.sendMessage'))
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
      setMessages(
        data.history.map((h: { id: string; role: string; content: string; timestamp: string }) => ({
          id: h.id,
          role: h.role,
          content: h.content,
          timestamp: h.timestamp,
        }))
      )
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
      }

      toast.success(t('success.sessionDeleted'))
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error(t('errors.deleteSession'))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
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
      <div className="flex-1 min-h-0">
        {!currentSessionId ? (
          <div className="flex items-center justify-center h-full text-center text-neutral-500 dark:text-neutral-400">
            <div>
              <p className="text-lg font-medium mb-2">{t('welcome')}</p>
              <p className="text-sm">{t('welcomeHint')}</p>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} isLoading={isLoading} />
        )}
      </div>

      {/* Input Area */}
      {currentSessionId && (
        <div className="border-t px-6 py-4">
          <div className="flex gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('inputPlaceholder')}
              className="resize-none"
              rows={3}
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="icon"
              className="h-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
            {t('characters', { count: inputValue.length })}
          </p>
        </div>
      )}
    </div>
  )
}
