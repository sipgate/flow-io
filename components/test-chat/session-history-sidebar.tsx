'use client'

import { formatDistanceToNow } from 'date-fns'
import { useTranslations } from 'next-intl'
import { History, Trash2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface TestSession {
  id: string
  name: string | null
  assistant_id: string
  last_message_at: string
  assistants?: {
    name: string
  }
}

interface SessionHistorySidebarProps {
  sessions: TestSession[]
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
}

export function SessionHistorySidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
}: SessionHistorySidebarProps) {
  const t = useTranslations('chatSimulator')

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          {t('history')}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>{t('chatHistory')}</SheetTitle>
          <SheetDescription>
            {t('chatHistoryDescription')}
          </SheetDescription>
        </SheetHeader>
        <Separator className="my-4" />
        <ScrollArea className="h-[calc(100vh-8rem)]">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              <MessageSquare className="h-14 w-14 mx-auto mb-3 text-neutral-400" />
              <p>{t('noHistory')}</p>
              <p className="text-sm mt-1">
                {t('noHistoryHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative rounded-lg border p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors ${
                    currentSessionId === session.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {session.name ||
                            t('chatWith', { name: session.assistants?.name || 'Agent' })}
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          {formatDistanceToNow(
                            new Date(session.last_message_at),
                            {
                              addSuffix: true,
                            }
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteSession(session.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </Button>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
