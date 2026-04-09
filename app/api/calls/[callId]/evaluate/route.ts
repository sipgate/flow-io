import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluateCallCriteria } from '@/lib/services/call-criteria-evaluator'
import { forceEvaluateCallCSAT } from '@/lib/services/csat-evaluator'

type EvaluationType = 'criteria' | 'csat' | 'all'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this call's organization
    const { data: call } = await supabase
      .from('call_sessions')
      .select('organization_id')
      .eq('id', callId)
      .single()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', call.organization_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body for evaluation type and criteria IDs
    let evaluationType: EvaluationType = 'criteria'
    let criteriaIds: string[] | undefined
    try {
      const body = await request.json()
      if (body.type && ['criteria', 'csat', 'all'].includes(body.type)) {
        evaluationType = body.type
      }
      if (body.criteriaIds && Array.isArray(body.criteriaIds)) {
        criteriaIds = body.criteriaIds
      }
    } catch {
      // No body or invalid JSON, evaluate all criteria (default)
    }

    // Start evaluation(s) in background and return immediately
    const evaluations: Promise<unknown>[] = []

    if (evaluationType === 'criteria' || evaluationType === 'all') {
      evaluations.push(
        evaluateCallCriteria({ callSessionId: callId, criteriaIds }).catch(err => {
          console.error('[Call Evaluate API] Criteria evaluation error:', err)
        })
      )
    }

    if (evaluationType === 'csat' || evaluationType === 'all') {
      evaluations.push(
        forceEvaluateCallCSAT(callId).catch(err => {
          console.error('[Call Evaluate API] CSAT evaluation error:', err)
        })
      )
    }

    // Don't await - run in background
    Promise.all(evaluations)

    return NextResponse.json({
      success: true,
      message: `${evaluationType === 'all' ? 'All evaluations' : evaluationType.toUpperCase() + ' evaluation'} started`,
    })
  } catch (error) {
    console.error('[Call Evaluate API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to start evaluation' },
      { status: 500 }
    )
  }
}
