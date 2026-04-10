'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface RunningTestsIndicatorProps {
  organizationId: string
}

type TestStatus = 'running' | 'passed' | 'partial' | 'failed' | 'none'

export function RunningTestsIndicator({ organizationId }: RunningTestsIndicatorProps) {
  const [status, setStatus] = useState<TestStatus>('none')
  const [runningCount, setRunningCount] = useState(0)
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false)
  const fetchingRef = useRef(false)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    const checkStatus = async () => {
      if (fetchingRef.current) return
      fetchingRef.current = true
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

        // Check for running tests
        const { data: runningTests, count: runCount } = await supabase
          .from('test_runs')
          .select('prompt_override', { count: 'exact' })
          .eq('organization_id', organizationId)
          .in('status', ['pending', 'running'])
          .gte('started_at', fiveMinutesAgo)

        if (!mounted) return

        if (runCount && runCount > 0) {
          setStatus('running')
          setRunningCount(runCount)
          setHasCustomPrompt(runningTests?.some((run) => run.prompt_override !== null) || false)
          return
        }

        setRunningCount(0)
        setHasCustomPrompt(false)

        // Get latest run per test case to determine overall status
        const { data: testCases } = await supabase
          .from('test_cases')
          .select(`
            id,
            test_runs (
              status,
              created_at
            )
          `)
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('created_at', { referencedTable: 'test_runs', ascending: false })
          .limit(1, { referencedTable: 'test_runs' })

        if (!mounted) return

        if (!testCases || testCases.length === 0) {
          setStatus('none')
          return
        }

        let hasAnyRuns = false
        let allPassed = true
        let hasPartial = false
        let hasFailed = false

        for (const tc of testCases) {
          const runs = tc.test_runs as Array<{ status: string; created_at: string }> | null
          if (runs && runs.length > 0) {
            hasAnyRuns = true
            const latestRun = runs[0]
            if (latestRun.status === 'partial') {
              hasPartial = true
              allPassed = false
            } else if (latestRun.status === 'failed' || latestRun.status === 'error') {
              hasFailed = true
              allPassed = false
            } else if (latestRun.status !== 'passed') {
              allPassed = false
            }
          }
        }

        if (!hasAnyRuns) {
          setStatus('none')
          return
        }

        if (allPassed) setStatus('passed')
        else if (hasFailed) setStatus('failed')
        else if (hasPartial) setStatus('partial')
        else setStatus('failed')
      } finally {
        fetchingRef.current = false
      }
    }

    // Initial check
    checkStatus()

    // Subscribe to realtime changes instead of polling
    const channel = supabase
      .channel(`test-status-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'test_runs',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          checkStatus()
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [organizationId])

  if (status === 'none') {
    return null
  }

  if (status === 'running') {
    return (
      <span className="ml-auto flex items-center gap-1">
        {hasCustomPrompt && (
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
        )}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-medium text-white animate-pulse">
          {runningCount}
        </span>
      </span>
    )
  }

  if (status === 'passed') {
    return (
      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-lime-500 text-white">
        <CheckCircle2 className="h-3 w-3" />
      </span>
    )
  }

  if (status === 'partial') {
    return (
      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white">
        <AlertTriangle className="h-3 w-3" />
      </span>
    )
  }

  if (status === 'failed') {
    return (
      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
        <XCircle className="h-3 w-3" />
      </span>
    )
  }

  return null
}
