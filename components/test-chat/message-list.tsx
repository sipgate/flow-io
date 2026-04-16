'use client'

import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'
import { User, Bot, Loader2, Wrench, ArrowRightLeft, Info, Hourglass } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface MessageMetadata {
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown>; result: string }>
  performance?: { ttftMs: number; totalTimeMs: number; tokensPerSecond: number }
  model?: string
  hesitation?: boolean
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

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function MessageList({ messages, isLoading = false }: MessageListProps) {
  const t = useTranslations('chatSimulator')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-3 py-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
            <Bot className="h-14 w-14 mx-auto mb-3 text-neutral-400" />
            <p>{t('noMessages')}</p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              // Tool use divider (matching call-details-modal style)
              if (message.role === 'tool') {
                const isTransfer = message.content === 'transfer_to_agent'
                return (
                  <div key={message.id} className="flex items-center gap-2 py-0.5">
                    <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full whitespace-nowrap">
                      {isTransfer ? (
                        <ArrowRightLeft className="h-3 w-3" />
                      ) : (
                        <Wrench className="h-3 w-3" />
                      )}
                      <span>{message.content}</span>
                      {message.timestamp && (
                        <span className="text-neutral-400 dark:text-neutral-500">· {format(new Date(message.timestamp), 'HH:mm:ss')}</span>
                      )}
                    </div>
                    <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                  </div>
                )
              }

              // System messages (transfer notifications)
              if (message.role === 'system') {
                return (
                  <div key={message.id} className="flex items-center gap-2 py-0.5">
                    <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full whitespace-nowrap">
                      <ArrowRightLeft className="h-3 w-3" />
                      <span>{message.content}</span>
                    </div>
                    <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                  </div>
                )
              }

              // User and Assistant messages
              const isUser = message.role === 'user'
              const isHesitation = !isUser && message.metadata?.hesitation === true

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex gap-2 max-w-[85%] ${
                      isUser ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Icon / Avatar */}
                    {!isUser && message.agentAvatarUrl ? (
                      <img
                        src={message.agentAvatarUrl}
                        alt={message.agentLabel || ''}
                        className="flex-shrink-0 w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                          isUser
                            ? 'bg-lime-100 dark:bg-lime-900/30'
                            : isHesitation
                              ? 'bg-amber-100 dark:bg-amber-900/30'
                              : 'bg-blue-100 dark:bg-blue-900'
                        }`}
                      >
                        {isUser ? (
                          <User className="h-3.5 w-3.5 text-lime-700 dark:text-lime-400" />
                        ) : isHesitation ? (
                          <Hourglass className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`rounded-lg px-3 py-2 ${
                        isUser
                          ? 'bg-lime-50 dark:bg-lime-950'
                          : isHesitation
                            ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50'
                            : 'bg-neutral-100 dark:bg-neutral-800'
                      }`}
                    >
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5 flex items-center gap-1">
                        <span>
                          {isUser ? t('you') : (message.agentLabel || t('assistant'))}
                          {message.timestamp &&
                            ` · ${format(new Date(message.timestamp), 'HH:mm:ss')}`}
                        </span>

                        {/* Metrics tooltip for assistant messages */}
                        {!isUser && (message.metadata?.usage || message.metadata?.performance || message.metadata?.model) && (
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 flex-shrink-0">
                                  <Info className="h-2.5 w-2.5 text-neutral-500 dark:text-neutral-400" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs space-y-1 max-w-56">
                                {message.metadata?.model && (
                                  <div className="flex items-center gap-1.5">
                                    <Bot className="h-3 w-3 flex-shrink-0" />
                                    <span className="font-medium">{t('modelLabel')}</span>
                                    <span className="text-neutral-400">·</span>
                                    <span className="truncate">{message.metadata.model}</span>
                                  </div>
                                )}
                                {message.metadata?.usage && (
                                  <div className="pt-0.5 border-t border-neutral-200 dark:border-neutral-700 space-y-0.5">
                                    <div className="flex justify-between gap-3">
                                      <span className="text-neutral-400">{t('promptTokens')}</span>
                                      <span className="font-mono">{message.metadata.usage.promptTokens}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <span className="text-neutral-400">{t('completionTokens')}</span>
                                      <span className="font-mono">{message.metadata.usage.completionTokens}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <span className="text-neutral-400">{t('totalTokens')}</span>
                                      <span className="font-mono">{message.metadata.usage.totalTokens}</span>
                                    </div>
                                  </div>
                                )}
                                {message.metadata?.performance && (
                                  <div className="pt-0.5 border-t border-neutral-200 dark:border-neutral-700 space-y-0.5">
                                    {message.metadata.performance.ttftMs !== undefined && (
                                      <div className="flex justify-between gap-3">
                                        <span className="text-neutral-400">{t('ttft')}</span>
                                        <span className="font-mono">{formatMs(message.metadata.performance.ttftMs)}</span>
                                      </div>
                                    )}
                                    {message.metadata.performance.totalTimeMs !== undefined && (
                                      <div className="flex justify-between gap-3">
                                        <span className="text-neutral-400">{t('totalTime')}</span>
                                        <span className="font-mono">{formatMs(message.metadata.performance.totalTimeMs)}</span>
                                      </div>
                                    )}
                                    {message.metadata.performance.tokensPerSecond !== undefined && (
                                      <div className="flex justify-between gap-3">
                                        <span className="text-neutral-400">{t('tps')}</span>
                                        <span className="font-mono">{message.metadata.performance.tokensPerSecond.toFixed(1)}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div className={`text-sm whitespace-pre-wrap ${isHesitation ? 'italic text-amber-800 dark:text-amber-300' : ''}`}>
                        {message.content}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex gap-2 max-w-[85%] flex-row">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900">
                    <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-neutral-100 dark:bg-neutral-800">
                    <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t('assistantTyping')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </>
        )}
        </div>
      </ScrollArea>
    </div>
  )
}
