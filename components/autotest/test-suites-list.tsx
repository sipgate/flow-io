'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FlaskConical, Play, Plus, Pencil, Trash2, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react'
import { deleteTestSuite } from '@/lib/actions/autotest'
import { createClient } from '@/lib/supabase/client'
import { runTestSuite } from '@/lib/services/autotest-runner'
import type { TestSuiteWithRelations } from '@/types/autotest'

interface TestSuitesListProps {
  suites: TestSuiteWithRelations[]
  organizationId: string
  orgSlug: string
  canManage: boolean
}

export function TestSuitesList({ suites, organizationId, orgSlug, canManage }: TestSuitesListProps) {
  const t = useTranslations('autotest')
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runningSuiteIds, setRunningSuiteIds] = useState<string[]>([])

  // Subscribe to running suite IDs via realtime instead of polling
  useEffect(() => {
    const supabase = createClient()

    const fetchRunningSuites = async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('test_runs')
        .select('test_suite_id')
        .eq('organization_id', organizationId)
        .in('status', ['pending', 'running'])
        .gte('started_at', fiveMinutesAgo)
        .not('test_suite_id', 'is', null)

      const suiteIds = [...new Set(data?.map((r) => r.test_suite_id).filter(Boolean) as string[])]
      setRunningSuiteIds(suiteIds)
    }

    fetchRunningSuites()

    const channel = supabase
      .channel(`running-suites-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'test_runs',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          fetchRunningSuites()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [organizationId])

  const isSuiteRunning = (suiteId: string): boolean => {
    return runningId === suiteId || runningSuiteIds.includes(suiteId)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    await deleteTestSuite(deleteId)
    setIsDeleting(false)
    setDeleteId(null)
    router.refresh()
  }

  const handleRunSuite = async (suiteId: string) => {
    if (isSuiteRunning(suiteId)) return
    setRunningId(suiteId)
    try {
      await runTestSuite({ suiteId, organizationId })
      router.refresh()
    } catch (error) {
      console.error('Error running suite:', error)
    } finally {
      setRunningId(null)
    }
  }

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return t('never')
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return t('justNow')
    if (diffMins < 60) return t('minutesAgo', { count: diffMins })
    if (diffHours < 24) return t('hoursAgo', { count: diffHours })
    return t('daysAgo', { count: diffDays })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{t('title')}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {t('description')}
          </p>
        </div>
        {canManage && (
          <Link href={`/${orgSlug}/autotest/new`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('createSuite')}
            </Button>
          </Link>
        )}
      </div>

      {suites.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FlaskConical className="h-14 w-14 mx-auto text-neutral-400 mb-3" />
            <h3 className="font-medium mb-1">{t('noSuites')}</h3>
            <p className="text-sm text-neutral-500 mb-4">{t('noSuitesDescription')}</p>
            {canManage && (
              <Link href={`/${orgSlug}/autotest/new`}>
                <Button>{t('createFirstSuite')}</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {suites.map((suite) => {
            const averageScore = suite.stats?.average_score
            const isRunning = isSuiteRunning(suite.id)

            return (
              <Card key={suite.id} className="hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors duration-[120ms]">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <FlaskConical className="h-5 w-5 mt-1 text-blue-500" />
                      <div>
                        <CardTitle className="text-lg">{suite.name}</CardTitle>
                        {suite.assistant && (
                          <CardDescription className="mt-1">
                            {t('assistant')}: {suite.assistant.name}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {suite.stats?.total_cases || 0} {t('testCases')}
                      </Badge>
                      {suite.stats && suite.stats.total_cases > 0 && averageScore != null && (
                        <Badge
                          className={`gap-1 ${
                            suite.stats.failed > 0
                              ? 'bg-red-500/10 text-red-600 border-red-200 dark:bg-red-400/10 dark:text-red-400 dark:border-red-800'
                              : suite.stats.partial > 0
                                ? 'bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-800'
                                : 'bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800'
                          }`}
                        >
                          {suite.stats.failed > 0 ? (
                            <XCircle className="h-3 w-3" />
                          ) : suite.stats.partial > 0 ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {averageScore}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {suite.description && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 line-clamp-2">
                      {suite.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="text-neutral-500">{t('lastRun')}</span>
                    <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-400">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(suite.stats?.last_run_at || null)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunSuite(suite.id)}
                      disabled={isRunning || (suite.stats?.total_cases || 0) === 0}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {isRunning ? t('running') : t('runAll')}
                    </Button>
                    <Link href={`/${orgSlug}/autotest/${suite.id}`}>
                      <Button size="sm">{t('viewTests')}</Button>
                    </Link>
                    {canManage && (
                      <>
                        <Link href={`/${orgSlug}/autotest/${suite.id}/edit`}>
                          <Button variant="outline" size="sm">
                            <Pencil className="h-4 w-4 mr-2" />
                            {t('edit')}
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(suite.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                          {t('delete')}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? t('deleting') : t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
