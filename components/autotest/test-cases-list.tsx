'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Play,
  Square,
  MoreVertical,
  Pencil,
  Trash,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  AlertTriangle,
  FileText,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteTestCase, getTestRuns, cancelTestRun } from '@/lib/actions/autotest'
import { TestRunModal } from './test-run-modal'
import { GenerateTestsDialog } from './generate-tests-dialog'
import type { TestCaseWithRelations, TestRun, EvaluationResult } from '@/types/autotest'

interface TestCasesListProps {
  testCases: TestCaseWithRelations[]
  suiteId: string
  assistantId: string
  organizationId: string
  orgSlug: string
  canManage: boolean
}

export function TestCasesList({
  testCases: initialTestCases,
  suiteId,
  assistantId,
  organizationId,
  orgSlug,
  canManage,
}: TestCasesListProps) {
  const t = useTranslations('autotest')
  const locale = useLocale()
  const router = useRouter()
  const [testCases, setTestCases] = useState<TestCaseWithRelations[]>(initialTestCases)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null)
  const [showRunModal, setShowRunModal] = useState(false)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)

  // Sync local state when server re-fetches after router.refresh()
  useEffect(() => {
    setTestCases(initialTestCases)
  }, [initialTestCases])

  // Set up real-time subscription for test run updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`test-runs-${suiteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'test_runs',
          filter: `test_suite_id=eq.${suiteId}`,
        },
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [suiteId, router])

  // Check if a test is currently running (either from server state or local state)
  // Tests running for more than 5 minutes are considered stale/cancelled
  const isTestRunning = (testCase: TestCaseWithRelations): boolean => {
    // Check local running state
    if (runningId === testCase.id) return true
    // Check server state from latest_run
    const status = testCase.latest_run?.status
    if (status !== 'pending' && status !== 'running') return false

    // Check if test has been running for too long (stale)
    const startedAt = testCase.latest_run?.started_at
    if (startedAt) {
      const startTime = new Date(startedAt).getTime()
      const now = Date.now()
      const fiveMinutes = 5 * 60 * 1000
      if (now - startTime > fiveMinutes) {
        return false // Stale test, not actually running
      }
    }
    return true
  }

  // Check if a test run is stale (stuck in running state)
  const isTestStale = (testCase: TestCaseWithRelations): boolean => {
    const status = testCase.latest_run?.status
    if (status !== 'pending' && status !== 'running') return false

    const startedAt = testCase.latest_run?.started_at
    if (startedAt) {
      const startTime = new Date(startedAt).getTime()
      const now = Date.now()
      const fiveMinutes = 5 * 60 * 1000
      return now - startTime > fiveMinutes
    }
    return false
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    await deleteTestCase(deleteId)
    setIsDeleting(false)
    setDeleteId(null)
    router.refresh()
  }

  const handleRunTest = async (testCase: TestCaseWithRelations) => {
    // Don't allow running if already running
    if (isTestRunning(testCase)) {
      return
    }

    setRunningId(testCase.id)
    try {
      // Start test in background via API
      const response = await fetch('/api/autotest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCaseId: testCase.id,
          suiteId,
          assistantId,
          organizationId,
          locale,
        }),
      })

      if (response.status === 409) {
        // Test is already running
        setRunningId(null)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to start test')
      }

      // Poll for results
      const pollForResult = async () => {
        for (let i = 0; i < 60; i++) {
          // Poll for up to 60 seconds
          await new Promise((resolve) => setTimeout(resolve, 1000))

          const { runs } = await getTestRuns(testCase.id, 1)
          if (runs.length > 0) {
            const latestRun = runs[0]
            if (latestRun.status !== 'pending' && latestRun.status !== 'running') {
              setSelectedRun(latestRun)
              setShowRunModal(true)
              setRunningId(null)
              return
            }
          }
        }
        // Timeout - stop polling
        setRunningId(null)
      }

      pollForResult()
    } catch (error) {
      console.error('Error running test:', error)
      setRunningId(null)
    }
  }

  const handleCancelTest = async (testCase: TestCaseWithRelations) => {
    try {
      await cancelTestRun(testCase.id)
      setRunningId(null)
      router.refresh()
    } catch (error) {
      console.error('Error cancelling test:', error)
    }
  }

  const handleTestWithPrompt = async (promptOverride: string) => {
    // Find the test case from the selected run
    if (!selectedRun?.test_case_id) return

    const testCase = testCases.find((tc) => tc.id === selectedRun.test_case_id)
    if (!testCase) return

    // Don't allow running if already running
    if (isTestRunning(testCase)) {
      return
    }

    // Close the modal and start the test
    setShowRunModal(false)
    setRunningId(testCase.id)

    try {
      const response = await fetch('/api/autotest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCaseId: testCase.id,
          suiteId,
          assistantId,
          organizationId,
          locale,
          promptOverride,
        }),
      })

      if (response.status === 409) {
        setRunningId(null)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to start test')
      }

      // Poll for results
      const pollForResult = async () => {
        for (let i = 0; i < 60; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000))

          const { runs } = await getTestRuns(testCase.id, 1)
          if (runs.length > 0) {
            const latestRun = runs[0]
            if (latestRun.status !== 'pending' && latestRun.status !== 'running') {
              setSelectedRun(latestRun)
              setShowRunModal(true)
              setRunningId(null)
              return
            }
          }
        }
        setRunningId(null)
      }

      pollForResult()
    } catch (error) {
      console.error('Error running test with prompt override:', error)
      setRunningId(null)
    }
  }

  const viewLastRun = (testCase: TestCaseWithRelations) => {
    if (testCase.latest_run) {
      setSelectedRun(testCase.latest_run)
      setShowRunModal(true)
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

  const getStatusBadge = (status: string | undefined, score?: number | null) => {
    const scoreText = score != null ? ` ${score}%` : ''

    switch (status) {
      case 'passed':
        return (
          <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t('passed')}{scoreText}
          </Badge>
        )
      case 'partial':
        return (
          <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-800 gap-1">
            <AlertTriangle className="h-3 w-3" />
            {t('partial')}{scoreText}
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {t('failed')}{scoreText}
          </Badge>
        )
      case 'error':
        return (
          <Badge className="bg-orange-500/10 text-orange-700 border-orange-200 dark:bg-orange-400/10 dark:text-orange-400 dark:border-orange-800 gap-1">
            <AlertCircle className="h-3 w-3" />
            {t('error')}
          </Badge>
        )
      case 'pending':
      case 'running':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-400/10 dark:text-blue-400 dark:border-blue-800 gap-1">
            <Play className="h-3 w-3 animate-pulse" />
            {t('running')}
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            {t('cancelled')}
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {t('notRun')}
          </Badge>
        )
    }
  }

  if (testCases.length === 0) {
    return (
      <>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-neutral-400 mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              {t('noTestCases')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 text-center max-w-md mb-4">
              {t('noTestCasesDescription')}
            </p>
            <div className="flex gap-3">
              {canManage && (
                <>
                  <Link href={`/${orgSlug}/autotest/${suiteId}/new`}>
                    <Button>{t('createFirstTest')}</Button>
                  </Link>
                  <Button variant="outline" onClick={() => setShowGenerateDialog(true)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('generateWithAI')}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Generate Tests Dialog */}
        <GenerateTestsDialog
          open={showGenerateDialog}
          onOpenChange={setShowGenerateDialog}
          suiteId={suiteId}
          assistantId={assistantId}
          organizationId={organizationId}
          onTestsCreated={() => router.refresh()}
        />
      </>
    )
  }

  return (
    <>
      <Card className="overflow-hidden">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">{t('testName')}</TableHead>
              <TableHead className="text-center">{t('turns')}</TableHead>
              <TableHead className="text-center">{t('lastRun')}</TableHead>
              <TableHead className="text-center">{t('status')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {testCases.map((testCase) => {
              const turnCount = testCase.conversation_flow?.length || 0
              const isRunning = isTestRunning(testCase)

              return (
                <TableRow key={testCase.id}>
                  <TableCell className="max-w-0">
                    <div className="truncate">
                      <p className="font-medium truncate">{testCase.name}</p>
                      {testCase.description && (
                        <p className="text-sm text-neutral-500 truncate">
                          {testCase.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{turnCount}</TableCell>
                  <TableCell className="text-center text-sm text-neutral-500">
                    {isRunning
                      ? formatRelativeTime(testCase.latest_run?.started_at || null)
                      : formatRelativeTime(testCase.latest_run?.completed_at || null)}
                  </TableCell>
                  <TableCell className="text-center">
                    {testCase.latest_run ? (
                      <button onClick={() => viewLastRun(testCase)} className="cursor-pointer inline-flex items-center gap-1">
                        {getStatusBadge(
                          isTestStale(testCase) ? 'cancelled' : testCase.latest_run.status,
                          (testCase.latest_run.evaluation_result as EvaluationResult | null)?.overall_evaluation?.score
                        )}
                        {testCase.latest_run.prompt_override && (
                          <span title={t('customPromptIndicator')} className="text-blue-500">
                            <Sparkles className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </button>
                    ) : (
                      getStatusBadge(undefined)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isRunning ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancelTest(testCase)}
                          title={t('cancelTest')}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRunTest(testCase)}
                          title={t('runTest')}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/${orgSlug}/autotest/${suiteId}/${testCase.id}/edit`}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {t('edit')}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setDeleteId(testCase.id)}
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              {t('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Generate Tests Button */}
      {canManage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => setShowGenerateDialog(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            {t('generateWithAI')}
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTestConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteTestConfirmDescription')}
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

      {/* Test Run Results Modal */}
      <TestRunModal
        run={selectedRun}
        open={showRunModal}
        onOpenChange={setShowRunModal}
        onTestWithPrompt={handleTestWithPrompt}
      />

      {/* Generate Tests Dialog */}
      <GenerateTestsDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
        suiteId={suiteId}
        assistantId={assistantId}
        organizationId={organizationId}
        onTestsCreated={() => router.refresh()}
      />
    </>
  )
}
