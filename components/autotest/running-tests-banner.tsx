'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, FlaskConical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface RunningTest {
  id: string
  test_case_id: string | null
  test_suite_id: string | null
  status: string
  started_at: string | null
  test_case_name?: string
  test_suite_name?: string
}

interface RunningTestsBannerProps {
  organizationId: string
  suiteId?: string // If provided, only show tests for this suite
}

export function RunningTestsBanner({ organizationId, suiteId }: RunningTestsBannerProps) {
  const t = useTranslations('autotest')
  const [runningTests, setRunningTests] = useState<RunningTest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const fetchRunningTests = async () => {
      // Exclude stale tests (running for more than 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      let query = supabase
        .from('test_runs')
        .select(`
          id,
          test_case_id,
          test_suite_id,
          status,
          started_at,
          test_cases (name),
          test_suites (name)
        `)
        .eq('organization_id', organizationId)
        .in('status', ['pending', 'running'])
        .gte('started_at', fiveMinutesAgo)
        .order('started_at', { ascending: false })

      if (suiteId) {
        query = query.eq('test_suite_id', suiteId)
      }

      const { data, error } = await query

      if (!error && mounted) {
        const tests = (data || []).map((run: Record<string, unknown>) => ({
          id: run.id as string,
          test_case_id: run.test_case_id as string | null,
          test_suite_id: run.test_suite_id as string | null,
          status: run.status as string,
          started_at: run.started_at as string | null,
          test_case_name: (run.test_cases as { name: string } | null)?.name,
          test_suite_name: (run.test_suites as { name: string } | null)?.name,
        }))
        setRunningTests(tests)
      }

      if (mounted) {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchRunningTests()

    // Poll every 2 seconds
    const interval = setInterval(fetchRunningTests, 2000)

    // Also subscribe to realtime updates
    const channel = supabase
      .channel('running-tests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'test_runs',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          fetchRunningTests()
        }
      )
      .subscribe()

    return () => {
      mounted = false
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [organizationId, suiteId])

  if (loading || runningTests.length === 0) {
    return null
  }

  return (
    <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
      <CardContent className="py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900">
            <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100">
              {t('testsRunning', { count: runningTests.length })}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('testsRunningDescription')}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {runningTests.map((test) => (
            <div
              key={test.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-blue-100 dark:border-blue-800"
            >
              <FlaskConical className="h-4 w-4 text-blue-500 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {test.test_case_name || t('unknownTest')}
                </p>
                {!suiteId && test.test_suite_name && (
                  <p className="text-xs text-neutral-500 truncate">
                    {test.test_suite_name}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                {test.status === 'pending' ? t('pending') : t('running')}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
