'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Phone, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPhoneNumber } from '@/lib/utils/format-phone'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export interface StaleCall {
  id: string
  session_id: string
  caller_number: string | null
  started_at: string | null
  assistants: {
    id: string
    name: string
  } | null
}

interface StaleCallsAlertProps {
  calls: StaleCall[]
  isPending: boolean
  onMarkFailed: (id: string) => void
  onDismiss: (id: string) => void
}

export function StaleCallsAlert({ calls, isPending, onMarkFailed, onDismiss }: StaleCallsAlertProps) {
  const t = useTranslations('calls.staleAlert')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(interval)
  }, [])

  if (calls.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-4 mb-4">
      <div className="flex gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-amber-900 dark:text-amber-200 mb-3 text-sm">
            {t('title', { count: calls.length })}
          </p>
          <div className="space-y-3">
            {calls.map((call) => {
              const durationMs = call.started_at
                ? now - new Date(call.started_at).getTime()
                : 0
              const durationSeconds = Math.floor(durationMs / 1000)

              return (
                <div
                  key={call.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md bg-amber-100/60 dark:bg-amber-900/20 px-3 py-2"
                >
                  <div className="flex items-center gap-3 text-sm text-amber-900 dark:text-amber-200 min-w-0">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium">
                      {call.caller_number
                        ? formatPhoneNumber(call.caller_number)
                        : t('unknownCaller')}
                    </span>
                    {call.assistants && (
                      <span className="text-amber-700 dark:text-amber-400 truncate">
                        · {call.assistants.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatDuration(durationSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/40"
                      onClick={() => onDismiss(call.id)}
                      disabled={isPending}
                    >
                      {t('stillRunning')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={() => onMarkFailed(call.id)}
                      disabled={isPending}
                    >
                      {t('markAsFailed')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-amber-600 hover:text-amber-800 dark:text-amber-400"
                      onClick={() => onDismiss(call.id)}
                      disabled={isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
