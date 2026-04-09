'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  PhoneCall,
  Clock,
  Variable,
  Activity
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { DashboardStats } from '@/lib/actions/dashboard'

interface StatsCardsProps {
  stats: DashboardStats
  organizationId: string
}

export function StatsCards({ stats, organizationId }: StatsCardsProps) {
  const t = useTranslations('dashboard.stats')
  const [activeCalls, setActiveCalls] = useState(stats.activeCalls)
  const [callsToday, setCallsToday] = useState(stats.callsToday)
  const [variablesToday, setVariablesToday] = useState(stats.variablesExtractedToday)
  const supabase = createClient()

  // Track which calls are currently active (by ID)
  const [activeCallIds, setActiveCallIds] = useState<Set<string>>(new Set())

  // Fetch active call IDs on mount
  useEffect(() => {
    const fetchActiveCallIds = async () => {
      const { data } = await supabase
        .from('call_sessions')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('status', 'active')

      if (data) {
        setActiveCallIds(new Set(data.map((c) => c.id)))
      }
    }
    fetchActiveCallIds()
  }, [organizationId, supabase])

  useEffect(() => {
    // Subscribe to call_sessions changes for active calls
    const callsChannel = supabase
      .channel('dashboard_stats_calls')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_sessions',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newRecord = payload.new as { id: string; status: string } | null
          const oldRecord = payload.old as { id: string; status: string } | null
          const callId = newRecord?.id || oldRecord?.id

          if (payload.eventType === 'INSERT' && newRecord) {
            // New call started
            setCallsToday((prev) => prev + 1)
            if (newRecord.status === 'active') {
              setActiveCallIds((prev) => {
                const next = new Set(prev)
                next.add(callId!)
                return next
              })
              setActiveCalls((prev) => prev + 1)
            }
          } else if (payload.eventType === 'UPDATE' && newRecord) {
            const newStatus = newRecord.status

            if (!callId) return

            setActiveCallIds((prev) => {
              const wasActive = prev.has(callId)
              const isNowActive = newStatus === 'active'

              if (wasActive && !isNowActive) {
                // Call ended
                const next = new Set(prev)
                next.delete(callId)
                setActiveCalls((p) => Math.max(0, p - 1))
                return next
              } else if (!wasActive && isNowActive) {
                // Call became active
                const next = new Set(prev)
                next.add(callId)
                setActiveCalls((p) => p + 1)
                return next
              }
              return prev
            })
          }
        }
      )
      .subscribe()

    // Subscribe to extracted_variables for today's count
    const variablesChannel = supabase
      .channel('dashboard_stats_variables')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'extracted_variables',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          setVariablesToday((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(callsChannel)
      supabase.removeChannel(variablesChannel)
    }
  }, [organizationId, supabase])

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs}s`
    return `${mins}m ${secs}s`
  }

  const cards = [
    {
      title: t('activeCalls'),
      value: activeCalls,
      icon: Activity,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      highlight: activeCalls > 0,
    },
    {
      title: t('callsToday'),
      value: callsToday,
      icon: PhoneCall,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: t('avgDuration'),
      value: formatDuration(stats.avgCallDuration),
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      isText: true,
    },
    {
      title: t('variablesToday'),
      value: variablesToday,
      icon: Variable,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
  ]

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={`p-4 ${card.highlight ? 'ring-2 ring-green-500 ring-offset-2 dark:ring-offset-neutral-950' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {card.title}
              </p>
              <p className={`text-2xl font-bold ${card.highlight ? 'text-green-500' : ''}`}>
                {card.value}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
