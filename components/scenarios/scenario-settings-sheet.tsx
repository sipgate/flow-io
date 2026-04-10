'use client'

import { useState, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Settings, Plus, GripVertical, Trash2, Pencil, Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { CallCriterion } from '@/types/call-criteria'
import {
  getOrgLevelCriteria,
  getScenarioCriteria,
  createCallCriterion,
  updateCallCriterion,
  deleteCallCriterion,
  reorderCallCriteria,
} from '@/lib/actions/call-criteria'
import { updateScenarioSettings } from '@/lib/actions/scenarios'

interface ScenarioSettingsSheetProps {
  scenarioId: string
  organizationId: string
  enableCsat: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettingsChange: () => void
}

export function ScenarioSettingsSheet({
  scenarioId,
  organizationId,
  enableCsat,
  open,
  onOpenChange,
  onSettingsChange,
}: ScenarioSettingsSheetProps) {
  const t = useTranslations('scenarios.settingsConfig')
  const tCriteria = useTranslations('settings.criteria')
  const tCommon = useTranslations('common')

  // CSAT
  const [csatEnabled, setCsatEnabled] = useState(enableCsat)
  const [csatSaving, startCsatSave] = useTransition()

  // Criteria
  const [orgCriteria, setOrgCriteria] = useState<CallCriterion[]>([])
  const [scenarioCriteria, setScenarioCriteria] = useState<CallCriterion[]>([])
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCriterion, setEditingCriterion] = useState<CallCriterion | null>(null)
  const [deletingCriterion, setDeletingCriterion] = useState<CallCriterion | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Drag state
  const [draggedItem, setDraggedItem] = useState<CallCriterion | null>(null)

  useEffect(() => {
    setCsatEnabled(enableCsat)
  }, [enableCsat])

  useEffect(() => {
    if (!open) return
    loadCriteria()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scenarioId])

  async function loadCriteria() {
    setLoading(true)
    const [orgResult, scenarioResult] = await Promise.all([
      getOrgLevelCriteria(organizationId),
      getScenarioCriteria(scenarioId),
    ])

    if (!orgResult.error) setOrgCriteria(orgResult.criteria)
    if (!scenarioResult.error) setScenarioCriteria(scenarioResult.criteria)
    setLoading(false)
  }

  function handleCsatToggle(checked: boolean) {
    setCsatEnabled(checked)
    startCsatSave(async () => {
      const { error } = await updateScenarioSettings(scenarioId, { enable_csat: checked })
      if (error) {
        toast.error(error)
        setCsatEnabled(!checked)
      } else {
        onSettingsChange()
      }
    })
  }

  function openCreateDialog() {
    setEditingCriterion(null)
    setName('')
    setDescription('')
    setIsActive(true)
    setIsDialogOpen(true)
  }

  function openEditDialog(criterion: CallCriterion) {
    setEditingCriterion(criterion)
    setName(criterion.name)
    setDescription(criterion.description)
    setIsActive(criterion.is_active ?? true)
    setIsDialogOpen(true)
  }

  async function handleSubmit() {
    if (!name.trim() || !description.trim()) {
      toast.error(tCriteria('nameAndDescriptionRequired'))
      return
    }

    startTransition(async () => {
      if (editingCriterion) {
        const { criterion, error } = await updateCallCriterion(editingCriterion.id, {
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
        })
        if (error) {
          toast.error(error)
        } else if (criterion) {
          setScenarioCriteria(prev => prev.map(c => c.id === criterion.id ? criterion : c))
          toast.success(tCriteria('criterionUpdated'))
          setIsDialogOpen(false)
        }
      } else {
        const { criterion, error } = await createCallCriterion({
          organization_id: organizationId,
          scenario_id: scenarioId,
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
        })
        if (error) {
          toast.error(error)
        } else if (criterion) {
          setScenarioCriteria(prev => [...prev, criterion])
          toast.success(tCriteria('criterionCreated'))
          setIsDialogOpen(false)
        }
      }
    })
  }

  async function handleDelete() {
    if (!deletingCriterion) return
    startTransition(async () => {
      const { error } = await deleteCallCriterion(deletingCriterion.id)
      if (error) {
        toast.error(error)
      } else {
        setScenarioCriteria(prev => prev.filter(c => c.id !== deletingCriterion.id))
        toast.success(tCriteria('criterionDeleted'))
      }
      setDeletingCriterion(null)
    })
  }

  async function handleToggleActive(criterion: CallCriterion) {
    startTransition(async () => {
      const { criterion: updated, error } = await updateCallCriterion(criterion.id, {
        is_active: !criterion.is_active,
      })
      if (error) {
        toast.error(error)
      } else if (updated) {
        setScenarioCriteria(prev => prev.map(c => c.id === updated.id ? updated : c))
      }
    })
  }

  function handleDragStart(e: React.DragEvent, criterion: CallCriterion) {
    setDraggedItem(criterion)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, targetCriterion: CallCriterion) {
    e.preventDefault()
    if (!draggedItem || draggedItem.id === targetCriterion.id) return

    const newCriteria = [...scenarioCriteria]
    const draggedIndex = newCriteria.findIndex(c => c.id === draggedItem.id)
    const targetIndex = newCriteria.findIndex(c => c.id === targetCriterion.id)

    const [removed] = newCriteria.splice(draggedIndex, 1)
    newCriteria.splice(targetIndex, 0, removed)

    setScenarioCriteria(newCriteria)
    setDraggedItem(null)

    const { error } = await reorderCallCriteria(newCriteria.map(c => c.id))
    if (error) {
      toast.error(error)
      loadCriteria()
    }
  }

  function handleDragEnd() {
    setDraggedItem(null)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md overflow-y-auto p-6">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t('title')}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('title')}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-8 mt-4">
            {/* CSAT Toggle */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold tracking-tight">{t('csatTitle')}</h3>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="scenario_enable_csat" className="text-sm font-medium cursor-pointer">
                    {t('csatLabel')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('csatDescription')}
                  </p>
                </div>
                <Switch
                  id="scenario_enable_csat"
                  checked={csatEnabled}
                  onCheckedChange={handleCsatToggle}
                  disabled={csatSaving}
                />
              </div>
            </div>

            <Separator />

            {/* Call Criteria */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-tight">{t('criteriaTitle')}</h3>
                <Button variant="outline" size="sm" onClick={openCreateDialog}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {tCriteria('addCriterion')}
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Inherited org-level criteria */}
                  {orgCriteria.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {t('orgCriteria')}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {orgCriteria.map((criterion) => (
                          <div
                            key={criterion.id}
                            className={`p-3 bg-muted/50 border rounded-lg ${!criterion.is_active ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{criterion.name}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Org</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{criterion.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scenario-specific criteria */}
                  {scenarioCriteria.length > 0 && (
                    <div className="space-y-2">
                      {scenarioCriteria.map((criterion) => (
                        <div
                          key={criterion.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                            !criterion.is_active ? 'opacity-50' : ''
                          } ${draggedItem?.id === criterion.id ? 'opacity-30' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, criterion)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, criterion)}
                          onDragEnd={handleDragEnd}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">{criterion.name}</span>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{criterion.description}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Switch
                              checked={criterion.is_active ?? true}
                              onCheckedChange={() => handleToggleActive(criterion)}
                              disabled={isPending}
                              className="scale-75"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(criterion)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-600"
                              onClick={() => setDeletingCriterion(criterion)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {scenarioCriteria.length === 0 && orgCriteria.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        {t('noCriteria')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCriterion ? tCriteria('editCriterion') : tCriteria('createCriterion')}
            </DialogTitle>
            <DialogDescription>
              {t('criterionDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="criterion-name">{tCriteria('name')}</Label>
              <Input
                id="criterion-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tCriteria('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="criterion-description">{tCriteria('criterionDescription')}</Label>
              <Textarea
                id="criterion-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tCriteria('descriptionPlaceholder')}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{tCriteria('descriptionHint')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="criterion-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="criterion-active">{tCriteria('active')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingCriterion ? tCommon('save') : tCriteria('createCriterion')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCriterion} onOpenChange={(o) => { if (!o) setDeletingCriterion(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCriteria('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tCriteria('deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
