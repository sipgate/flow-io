'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import { Phone, Clock, Variable, ArrowRight, StickyNote } from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { formatPhoneNumber } from '@/lib/utils/format-phone'
import type { RecentCall } from '@/lib/actions/dashboard'

interface RecentCallsCardProps {
  initialCalls: RecentCall[]
  organizationId: string
  orgSlug: string
}

export function RecentCallsCard({ initialCalls, organizationId, orgSlug }: RecentCallsCardProps) {
  const t = useTranslations('dashboard.recentCalls')
  const tCommon = useTranslations('common')
  const tCalls = useTranslations('calls')
  const [calls, setCalls] = useState<RecentCall[]>(initialCalls)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('dashboard_calls')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_sessions',
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch the new call with relations
            const { data: newCall } = await supabase
              .from('call_sessions')
              .select(`
                id,
                session_id,
                caller_number,
                status,
                started_at,
                ended_at,
                duration_seconds,
                assistants (name),
                phone_numbers (phone_number),
                extracted_variables (name, value),
                call_notes (id, content)
              `)
              .eq('id', payload.new.id)
              .single()

            if (newCall) {
              const formatted: RecentCall = {
                id: newCall.id,
                session_id: newCall.session_id,
                caller_number: newCall.caller_number,
                status: newCall.status,
                started_at: newCall.started_at,
                ended_at: newCall.ended_at,
                duration_seconds: newCall.duration_seconds,
                assistant_name: (newCall.assistants as { name?: string } | null)?.name || null,
                phone_number: (newCall.phone_numbers as { phone_number?: string } | null)?.phone_number || null,
                extracted_variables: ((newCall.extracted_variables as { name: string; value: string }[]) || []).map((v) => ({
                  name: v.name,
                  value: v.value,
                })),
                notes: ((newCall.call_notes as { id: string; content: string }[]) || []).map((n) => ({
                  id: n.id,
                  content: n.content,
                })),
              }
              setCalls((prev) => [formatted, ...prev.slice(0, 4)])
            }
          } else if (payload.eventType === 'UPDATE') {
            setCalls((prev) =>
              prev.map((call) =>
                call.id === payload.new.id
                  ? { ...call, status: payload.new.status, duration_seconds: payload.new.duration_seconds, ended_at: payload.new.ended_at }
                  : call
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [organizationId, supabase])

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800 animate-pulse">{tCalls('status.active')}</Badge>
      case 'completed':
        return <Badge variant="secondary">{tCalls('status.completed')}</Badge>
      case 'failed':
        return <Badge variant="destructive">{tCalls('status.failed')}</Badge>
      default:
        return <Badge variant="outline">{tCalls('status.unknown')}</Badge>
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {calls.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t('noCalls')}</p>
            <p className="text-sm">{t('callsAppearHere')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${call.status === 'active' ? 'bg-lime-100 dark:bg-lime-900/30' : 'bg-neutral-200 dark:bg-neutral-700'}`}>
                    <Phone className={`h-4 w-4 ${call.status === 'active' ? 'text-lime-700 dark:text-lime-400' : 'text-neutral-500'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">
                        {formatPhoneNumber(call.caller_number)}
                      </span>
                      {getStatusBadge(call.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {call.assistant_name && (
                        <span>{call.assistant_name}</span>
                      )}
                      {call.started_at && (
                        <span>
                          {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {call.notes.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-amber-500 cursor-pointer">
                          <StickyNote className="h-4 w-4" />
                          <span>{call.notes.length}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs bg-neutral-900 text-neutral-100 p-2">
                        <div className="space-y-1">
                          <p className="font-medium text-xs text-amber-400">{tCalls('notes.title')}</p>
                          {call.notes.map((note) => (
                            <p key={note.id} className="text-xs truncate">
                              {note.content}
                            </p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {call.extracted_variables.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-pink-500 cursor-pointer">
                          <Variable className="h-4 w-4" />
                          <span>{call.extracted_variables.length}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs bg-neutral-900 text-neutral-100 p-2">
                        <div className="space-y-1">
                          <p className="font-medium text-xs text-pink-400">{tCalls('variables.title')}</p>
                          {call.extracted_variables.map((v, i) => (
                            <p key={i} className="text-xs">
                              <span className="text-neutral-400">{v.name}:</span>{' '}
                              <span className="font-mono">{v.value || '-'}</span>
                            </p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <div className="flex items-center gap-1 text-neutral-500">
                    <Clock className="h-4 w-4" />
                    <span className="font-mono">{formatDuration(call.duration_seconds)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {calls.length > 0 && (
          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 mt-2">
            <Link href={`/${orgSlug}/calls`}>
              <Button variant="ghost" size="sm" className="text-sm w-full">
                {tCommon('viewAll')}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
