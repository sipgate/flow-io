import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { updateCallSession } from '@/lib/repositories/calls.repository'
import { extractAndDeliverVariables } from '@/lib/services/variable-extractor'
import { cancelPendingMCP } from '@/lib/services/pending-mcp-state'
import { getVariableCollection, cleanupVariableCollection } from '@/lib/services/variable-collection-state'
import { evaluateCallCriteria } from '@/lib/services/call-criteria-evaluator'
import { evaluateCallCSAT } from '@/lib/services/csat-evaluator'
import { sessionState } from '@/lib/services/session-state'
import type { SessionEndEvent } from './lib/types'

/**
 * Handle SessionEnd event - called when call ends.
 * Updates call session, extracts variables, evaluates criteria, and cleans up state.
 */
export async function handleSessionEnd(event: SessionEndEvent) {
  console.log('📴 Session End:', event)

  const supabase = createServiceRoleClient()

  const { data: sessionData } = await supabase
    .from('call_sessions')
    .select('*')
    .eq('session_id', event.session.id)
    .single()

  const session = sessionData as unknown as {
    id: string
    organization_id: string
    assistant_id: string | null
    started_at: string | null
    metadata: unknown
  } | null

  if (!session) {
    console.error('Call session not found:', event.session.id)
    return NextResponse.json({ success: true })
  }

  const endedAt = new Date()
  const startedAt = new Date(session.started_at || new Date())
  const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)

  await updateCallSession(event.session.id, {
    status: 'completed',
    ended_at: endedAt.toISOString(),
    duration_seconds: durationSeconds,
    metadata: {
      ...(typeof session.metadata === 'object' && session.metadata !== null
        ? (session.metadata as Record<string, unknown>)
        : {}),
      end_event: event,
    },
  })

  cancelPendingMCP(event.session.id)

  // Extract variables asynchronously (non-blocking)
  const varCollection = getVariableCollection(event.session.id)
  if (session.assistant_id && session.organization_id) {
    extractAndDeliverVariables(
      session.id,
      session.assistant_id,
      session.organization_id,
      varCollection ? { preCollected: varCollection.collected } : undefined
    ).catch((error) => {
      console.error('[SessionEnd] Variable extraction failed:', error)
    })
  }

  cleanupVariableCollection(event.session.id)
  sessionState.cleanup(event.session.id)

  evaluateCallCriteria({ callSessionId: session.id }).catch((error) => {
    console.error('[SessionEnd] Criteria evaluation failed:', error)
  })

  evaluateCallCSAT({ callSessionId: session.id }).catch((error) => {
    console.error('[SessionEnd] CSAT evaluation failed:', error)
  })

  return NextResponse.json({ success: true })
}
