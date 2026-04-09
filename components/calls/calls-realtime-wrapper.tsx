'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CallsTable } from './calls-table'
import { CallsAnalytics } from './calls-analytics'
import { ExportCallsDialog } from './export-calls-dialog'
import { StaleCallsAlert, type StaleCall } from './stale-calls-alert'
import { Button } from '@/components/ui/button'
import { getStaleActiveCalls, markCallAsFailed } from '@/lib/actions/calls'

interface ExtractedVar {
  id: string
  name: string
  label: string
  type: string
  value: string | null
  confidence: number | null
}

interface CallMetadata {
  extraction_status?: 'complete' | 'incomplete'
  missing_required_variables?: string[]
}

interface Call {
  id: string
  session_id: string
  caller_number: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  csat_score: number | null
  metadata: CallMetadata | null
  assistants: {
    id: string
    name: string
  } | null
  phone_numbers: {
    id: string
    phone_number: string
  } | null
  call_scenarios: {
    id: string
    name: string
  } | null
  extracted_variables: ExtractedVar[] | null
  call_notes: { id: string; content: string }[] | null
}

interface CallsRealtimeWrapperProps {
  initialCalls: Call[]
  organizationId: string
}

export function CallsRealtimeWrapper({
  initialCalls,
  organizationId,
}: CallsRealtimeWrapperProps) {
  const t = useTranslations('calls')
  const [calls, setCalls] = useState<Call[]>(initialCalls)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [staleCalls, setStaleCalls] = useState<StaleCall[]>([])
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const markingRef = useRef<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    getStaleActiveCalls(organizationId).then(({ calls: stale }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setStaleCalls(stale as any)
    })
  }, [organizationId])

  function handleDismissStale(id: string) {
    setStaleCalls((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleMarkFailed(id: string) {
    if (markingRef.current.has(id)) return
    markingRef.current.add(id)
    setPendingIds((prev) => new Set([...prev, id]))
    // Optimistic removal — happens synchronously, not inside a transition
    setStaleCalls((prev) => prev.filter((c) => c.id !== id))
    try {
      await markCallAsFailed(id)
    } finally {
      markingRef.current.delete(id)
      setPendingIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  // Helper to refetch a call with all relations
  const refetchCall = async (callId: string) => {
    const { data: updatedCall } = await supabase
      .from('call_sessions')
      .select(`
        *,
        assistants (
          id,
          name
        ),
        phone_numbers (
          id,
          phone_number
        ),
        call_scenarios:scenario_id (
          id,
          name
        ),
        extracted_variables (
          id,
          name,
          label,
          type,
          value,
          confidence
        ),
        call_notes (
          id,
          content
        )
      `)
      .eq('id', callId)
      .single()

    if (updatedCall) {
      const updatedCallTyped = updatedCall as unknown as Call
      setCalls((prev) =>
        prev.map((call) =>
          call.id === updatedCallTyped.id ? updatedCallTyped : call
        )
      )
    }
  }

  useEffect(() => {
    // Subscribe to real-time updates for call_sessions
    const sessionsChannel = supabase
      .channel('call_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_sessions',
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          console.log('[Calls] Real-time session update:', payload.eventType)

          if (payload.eventType === 'INSERT') {
            // Fetch the complete call data with relations
            const { data: newCall } = await supabase
              .from('call_sessions')
              .select(`
                *,
                assistants (
                  id,
                  name
                ),
                phone_numbers (
                  id,
                  phone_number
                ),
                extracted_variables (
                  id,
                  name,
                  label,
                  type,
                  value,
                  confidence
                ),
                call_notes (
                  id,
                  content
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (newCall) {
              setCalls((prev) => [newCall as unknown as Call, ...prev])
            }
          } else if (payload.eventType === 'UPDATE') {
            await refetchCall(payload.new.id)
          } else if (payload.eventType === 'DELETE') {
            setCalls((prev) => prev.filter((call) => call.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    // Subscribe to extracted_variables inserts
    const variablesChannel = supabase
      .channel('extracted_variables_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'extracted_variables',
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          console.log('[Calls] Real-time variable extracted:', payload.new)
          // Refetch the call to get updated variables
          if (payload.new.call_session_id) {
            await refetchCall(payload.new.call_session_id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(sessionsChannel)
      supabase.removeChannel(variablesChannel)
    }
  }, [organizationId, supabase])

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          onClick={() => setShowExportDialog(true)}
        >
          <Download className="h-4 w-4 mr-2" />
          {t('export.button')}
        </Button>
      </div>
      <StaleCallsAlert
        calls={staleCalls}
        isPending={pendingIds.size > 0}
        onMarkFailed={handleMarkFailed}
        onDismiss={handleDismissStale}
      />
      <CallsAnalytics calls={calls} />
      <CallsTable calls={calls} />

      <ExportCallsDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        organizationId={organizationId}
      />
    </>
  )
}
