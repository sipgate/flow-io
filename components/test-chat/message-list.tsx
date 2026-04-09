'use client'

import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'
import { User, Bot, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
}

export function MessageList({ messages, isLoading = false }: MessageListProps) {
  const t = useTranslations('chatSimulator')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
            <Bot className="h-14 w-14 mx-auto mb-3 text-neutral-400" />
            <p>{t('noMessages')}</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-start' : 'justify-end'
                }`}
              >
                <div
                  className={`flex gap-3 max-w-[80%] ${
                    message.role === 'user' ? 'flex-row' : 'flex-row-reverse'
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'bg-green-100 dark:bg-green-900'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Bot className="h-4 w-4 text-green-600 dark:text-green-400" />
                    )}
                  </div>

                  {/* Message bubble */}
                  <div
                    className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-neutral-100 dark:bg-neutral-800'
                        : 'bg-green-50 dark:bg-green-950'
                    }`}
                  >
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                      {message.role === 'user' ? t('you') : t('assistant')}
                      {message.timestamp &&
                        ` · ${format(new Date(message.timestamp), 'HH:mm:ss')}`}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-end">
                <div className="flex gap-3 max-w-[80%] flex-row-reverse">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900">
                    <Bot className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="rounded-lg p-3 bg-green-50 dark:bg-green-950">
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
