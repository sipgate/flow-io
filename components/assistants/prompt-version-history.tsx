'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { diffLines, Change } from 'diff'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
  History,
  RotateCcw,
  Clock,
  User,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
} from 'lucide-react'
import { getPromptVersions, restorePromptVersion } from '@/lib/actions/prompt-versions'
import type { PromptVersionWithUser } from '@/types/prompt-version'

interface PromptVersionHistoryProps {
  assistantId: string
  currentPrompt: string
  onRestore?: () => void
}

export function PromptVersionHistory({
  assistantId,
  currentPrompt,
  onRestore,
}: PromptVersionHistoryProps) {
  const t = useTranslations('assistants')
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<PromptVersionWithUser[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreId, setRestoreId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadVersions = async () => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional loading state reset at start of async operation
    setLoading(true)
    const { versions: data } = await getPromptVersions(assistantId)
    setVersions(data)
    setLoading(false)
  }

  useEffect(() => {
    if (open) {
      loadVersions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assistantId])

  const handleRestore = async () => {
    if (!restoreId) return
    setRestoring(true)
    const result = await restorePromptVersion(restoreId)
    setRestoring(false)
    setRestoreId(null)

    if (result.success) {
      setOpen(false)
      onRestore?.()
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return t('versionHistory.justNow')
    if (diffMins < 60) return t('versionHistory.minutesAgo', { count: diffMins })
    if (diffHours < 24) return t('versionHistory.hoursAgo', { count: diffHours })
    return t('versionHistory.daysAgo', { count: diffDays })
  }

  const isCurrentVersion = (version: PromptVersionWithUser) => {
    return version.system_prompt === currentPrompt
  }

  // Compute diff between current prompt and a version
  const computeDiff = (versionPrompt: string): Change[] => {
    return diffLines(versionPrompt, currentPrompt)
  }

  // Render diff view
  const renderDiff = (version: PromptVersionWithUser) => {
    const changes = computeDiff(version.system_prompt)
    const hasChanges = changes.some((c) => c.added || c.removed)

    if (!hasChanges) {
      return (
        <div className="text-sm text-neutral-500 italic">
          {t('versionHistory.noChanges')}
        </div>
      )
    }

    return (
      <div className="space-y-0 font-mono text-sm">
        {changes.map((change, i) => {
          if (change.added) {
            return (
              <div
                key={i}
                className="bg-green-100 dark:bg-green-900/30 border-l-2 border-green-500 pl-2 py-0.5"
              >
                <span className="text-green-600 dark:text-green-400 mr-2 select-none">
                  <Plus className="h-3 w-3 inline" />
                </span>
                <span className="whitespace-pre-wrap text-green-800 dark:text-green-200">
                  {change.value}
                </span>
              </div>
            )
          }
          if (change.removed) {
            return (
              <div
                key={i}
                className="bg-red-100 dark:bg-red-900/30 border-l-2 border-red-500 pl-2 py-0.5"
              >
                <span className="text-red-600 dark:text-red-400 mr-2 select-none">
                  <Minus className="h-3 w-3 inline" />
                </span>
                <span className="whitespace-pre-wrap text-red-800 dark:text-red-200">
                  {change.value}
                </span>
              </div>
            )
          }
          // Unchanged lines - show collapsed if too many
          const lines = change.value.split('\n').filter(Boolean)
          if (lines.length > 3) {
            return (
              <div key={i} className="text-neutral-400 dark:text-neutral-600 pl-2 py-0.5">
                <span className="whitespace-pre-wrap">{lines.slice(0, 1).join('\n')}</span>
                <div className="text-xs italic my-1">... {lines.length - 2} {t('versionHistory.unchangedLines')} ...</div>
                <span className="whitespace-pre-wrap">{lines.slice(-1).join('\n')}</span>
              </div>
            )
          }
          return (
            <div key={i} className="text-neutral-600 dark:text-neutral-400 pl-2 py-0.5">
              <span className="whitespace-pre-wrap">{change.value}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" type="button">
            <History className="h-4 w-4 mr-2" />
            {t('versionHistory.title')}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t('versionHistory.title')}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p>{t('versionHistory.noVersions')}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-3">
                {versions.map((version, index) => {
                  const isCurrent = isCurrentVersion(version)
                  const isExpanded = expandedId === version.id

                  return (
                    <div
                      key={version.id}
                      className={`border rounded-lg p-4 ${
                        isCurrent
                          ? 'border-lime-300 bg-lime-50 dark:border-lime-800 dark:bg-lime-950/20'
                          : 'border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {t('versionHistory.version')} {version.version_number}
                            </span>
                            {isCurrent && (
                              <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800 text-xs">
                                {t('versionHistory.current')}
                              </Badge>
                            )}
                            {index === 0 && !isCurrent && (
                              <Badge variant="secondary" className="text-xs">
                                {t('versionHistory.latest')}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-neutral-500 mb-2">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(version.created_at)}
                            </span>
                            {version.user && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {version.user.full_name || version.user.email}
                              </span>
                            )}
                          </div>

                          {version.note && (
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 italic mb-2">
                              {version.note}
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : version.id)}
                            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3 w-3" />
                                {t('versionHistory.hidePrompt')}
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" />
                                {t('versionHistory.viewPrompt')}
                              </>
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded border max-h-[300px] overflow-y-auto">
                              <div className="text-xs text-neutral-500 mb-2 flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                  <Minus className="h-3 w-3 text-red-500" />
                                  {t('versionHistory.inVersion')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Plus className="h-3 w-3 text-green-500" />
                                  {t('versionHistory.inCurrent')}
                                </span>
                              </div>
                              {renderDiff(version)}
                            </div>
                          )}
                        </div>

                        {!isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => setRestoreId(version.id)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            {t('versionHistory.restore')}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreId} onOpenChange={() => setRestoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('versionHistory.restoreConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('versionHistory.restoreConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('versionHistory.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={restoring}
            >
              {restoring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('versionHistory.restoring')}
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('versionHistory.restore')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
