'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { History, RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
import type { ScenarioEdge, ScenarioNode, ScenarioVersion } from '@/types/scenarios'

interface ScenarioHistorySheetProps {
  scenarioId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestore: (restored: { nodes: ScenarioNode[]; edges: ScenarioEdge[] }) => void
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

  function changeLabel(change: ScenarioVersion['change_summary'][number]) {
    switch (change) {
      case 'assistant':
        return t('changeLabels.assistant')
      case 'instructions':
        return t('changeLabels.instructions')
      case 'routing':
        return t('changeLabels.routing')
      case 'nodes':
        return t('changeLabels.nodes')
      case 'voice':
        return t('changeLabels.voice')
      case 'settings':
        return t('changeLabels.settings')
      case 'initial':
        return t('changeLabels.initial')
    }
  }

  function renderVersionContext(version: ScenarioVersion) {
    const changedLabels = version.change_summary
      .filter((change) => change !== 'initial')
      .map(changeLabel)

    return (
      <div className="mt-1 space-y-0.5 text-xs text-neutral-500">
        {version.change_summary.includes('initial') && <p>{t('initialApply')}</p>}
        {version.restored_from_version && (
          <p>{t('restoredFrom', { version: version.restored_from_version })}</p>
        )}
        {changedLabels.length > 0 && (
          <p>{t('changedFields', { fields: changedLabels.join(', ') })}</p>
        )}
      </div>
    )
  }

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
      const result = await restoreScenarioVersion(scenarioId, versionToRestore.id)
      if (result.error || !result.nodes || !result.edges) {
        toast.error(t('restoreError'))
      } else {
        toast.success(t('restoreSuccess'))
        onRestore({ nodes: result.nodes, edges: result.edges })
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
              <p className="py-8 text-center text-sm text-neutral-500">{t('historyEmpty')}</p>
            )}

            {!loading &&
              versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {t('versionLabel', { version: v.version })}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {new Date(v.published_at).toLocaleString()}
                    </p>
                    {renderVersionContext(v)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmVersion(v)}
                    disabled={restoring}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {t('restoreVersion')}
                  </Button>
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!confirmVersion}
        onOpenChange={(o) => {
          if (!o) setConfirmVersion(null)
        }}
      >
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
