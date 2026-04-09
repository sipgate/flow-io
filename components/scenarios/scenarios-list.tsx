'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { GitBranch, Plus, Pencil, Trash2, CheckCircle, Circle, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { toast } from 'sonner'
import type { ScenarioSummary } from '@/types/scenarios'
import { deleteScenario, createScenario } from '@/lib/actions/scenarios'

interface ScenariosListProps {
  scenarios: ScenarioSummary[]
  organizationId: string
  orgSlug: string
}

export function ScenariosList({ scenarios, organizationId, orgSlug }: ScenariosListProps) {
  const router = useRouter()
  const t = useTranslations('scenarios')
  const locale = useLocale()
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [, startTransition] = useTransition()

  const handleCreate = async () => {
    setCreating(true)
    const { scenario, error, noPhoneNumbers } = await createScenario(organizationId, { name: t('newScenario') })
    setCreating(false)
    if (noPhoneNumbers) {
      toast.error(t('noPhoneNumbersError'), {
        description: t('noPhoneNumbersErrorDescription'),
        action: {
          label: t('managePhoneNumbers'),
          onClick: () => router.push(`/${orgSlug}/phone-numbers`),
        },
        duration: 8000,
      })
      return
    }
    if (error || !scenario) {
      toast.error(error || t('createError'))
      return
    }
    router.push(`/${orgSlug}/scenarios/${scenario.id}`)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setDeleteTarget(null)
    setDeletingId(id)
    const { error } = await deleteScenario(id)
    setDeletingId(null)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(t('deleteSuccess'))
    startTransition(() => router.refresh())
  }

  return (
    <>
    <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteDialog.description', { name: deleteTarget?.name ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={confirmDelete}
          >
            {t('deleteDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{t('page.title')}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {t('page.description')}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="h-4 w-4 mr-2" />
          {t('newScenario')}
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <GitBranch className="h-14 w-14 mx-auto text-neutral-400 mb-3" />
            <h3 className="font-medium mb-1">{t('empty.title')}</h3>
            <p className="text-sm text-neutral-500 mb-4">{t('empty.description')}</p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('newScenario')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('phoneNumber')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('agents')}</TableHead>
              <TableHead>{t('lastUpdated')}</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
              {scenarios.map((scenario) => (
                <TableRow key={scenario.id}>
                  <TableCell>
                    <span className="font-medium">{scenario.name}</span>
                    {scenario.description && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate max-w-[240px]">
                        {scenario.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {scenario.phone_number ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                        <span className="font-mono text-sm">{scenario.phone_number}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {scenario.is_published ? (
                      <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('published')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Circle className="h-3 w-3 mr-1" />
                        {t('draft')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      {scenario.node_count}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-500">
                      {new Date(scenario.updated_at).toLocaleDateString(locale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => router.push(`/${orgSlug}/scenarios/${scenario.id}`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600"
                        disabled={deletingId === scenario.id}
                        onClick={() => setDeleteTarget({ id: scenario.id, name: scenario.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        </Card>
      )}
    </div>
    </>
  )
}
