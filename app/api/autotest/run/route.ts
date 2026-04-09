import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runTestCase } from '@/lib/services/autotest-runner'
import type { TestCase } from '@/types/autotest'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes max

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { testCaseId, suiteId, assistantId, organizationId, locale, promptOverride } = body

    if (!testCaseId || !assistantId || !organizationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch the test case
    const { data: testCase, error: testCaseError } = await supabase
      .from('test_cases')
      .select('*')
      .eq('id', testCaseId)
      .single()

    if (testCaseError || !testCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 })
    }

    // Check if there's already a running test for this test case
    // Exclude stale tests (running for more than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: existingRun } = await supabase
      .from('test_runs')
      .select('id, status')
      .eq('test_case_id', testCaseId)
      .in('status', ['pending', 'running'])
      .gte('started_at', fiveMinutesAgo)
      .limit(1)
      .single()

    if (existingRun) {
      return NextResponse.json(
        { error: 'Test is already running', alreadyRunning: true },
        { status: 409 }
      )
    }

    // Start the test run in the background using waitUntil pattern
    // The response is sent immediately, but the test continues running
    const runPromise = runTestCase({
      testCase: testCase as unknown as TestCase,
      assistantId,
      organizationId,
      testSuiteId: suiteId,
      locale: locale || 'en',
      promptOverride: promptOverride || undefined,
    })

    // For Edge runtime we'd use waitUntil, but for Node.js we just don't await
    // and let it run in the background
    runPromise.catch((error) => {
      console.error('[Autotest API] Background test run failed:', error)
    })

    return NextResponse.json({
      success: true,
      message: 'Test started',
      testCaseId,
    })
  } catch (error) {
    console.error('[Autotest API] Error starting test:', error)
    return NextResponse.json({ error: 'Failed to start test' }, { status: 500 })
  }
}
