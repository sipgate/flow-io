'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { History, RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
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
import { getScenarioVersions, restoreScenarioVersion } from '@/lib/actions/scenarios'
import type { ScenarioVersion } from '@/types/scenarios'

interface ScenarioHistorySheetProps {
  scenarioId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestore: () => void
}

export function ScenarioHistorySheet({
  scenarioId,
  open,
  onOpenChange,
  onRestore,
}: ScenarioHistorySheetProps) {
  const t = useTranslations('scenarios')
  const [versions, setVersions] = useState<ScenarioVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, startRestore] = useTransition()
  const [confirmVersion, setConfirmVersion] = useState<ScenarioVersion | null>(null)

  useEffect(() => {
    if (!open) return
    async function loadVersions() {
      setLoading(true)
      const { versions: v } = await getScenarioVersions(scenarioId)
      setVersions(v)
      setLoading(false)
    }
    loadVersions()
  }, [open, scenarioId])

  function handleRestoreConfirm() {
    if (!confirmVersion) return
    const versionToRestore = confirmVersion
    setConfirmVersion(null)
    startRestore(async () => {
      const { error } = await restoreScenarioVersion(scenarioId, versionToRestore.id)
      if (error) {
        toast.error(t('restoreError'))
      } else {
        toast.success(t('restoreSuccess'))
        onRestore()
        onOpenChange(false)
      }
    })
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t('historyTitle')}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-8 text-neutral-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}

            {!loading && versions.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-8">
                {t('historyEmpty')}
              </p>
            )}

            {!loading && versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {t('versionLabel', { version: v.version })}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {new Date(v.published_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmVersion(v)}
                  disabled={restoring}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  {t('restoreVersion')}
                </Button>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmVersion} onOpenChange={(o) => { if (!o) setConfirmVersion(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('restoreVersion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmVersion && t('versionLabel', { version: confirmVersion.version })}
              {' — '}
              {t('revertConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm}>
              {t('restoreVersion')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
