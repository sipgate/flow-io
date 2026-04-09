'use client'

import { useState, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, GripVertical, Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
import { toast } from 'sonner'
import type { CallCriterion } from '@/types/call-criteria'
import {
  getOrgLevelCriteria,
  createCallCriterion,
  updateCallCriterion,
  deleteCallCriterion,
  reorderCallCriteria,
} from '@/lib/actions/call-criteria'

interface CriteriaListProps {
  organizationId: string
  canEdit: boolean
}

export function CriteriaList({ organizationId, canEdit }: CriteriaListProps) {
  const t = useTranslations('settings.criteria')
  const tCommon = useTranslations('common')
  const [criteria, setCriteria] = useState<CallCriterion[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCriterion, setEditingCriterion] = useState<CallCriterion | null>(null)
  const [deletingCriterion, setDeletingCriterion] = useState<CallCriterion | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Drag state
  const [draggedItem, setDraggedItem] = useState<CallCriterion | null>(null)

  async function loadCriteria() {
    setLoading(true)
    const { criteria: data, error } = await getOrgLevelCriteria(organizationId)
    if (error) {
      toast.error(error)
    } else {
      setCriteria(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCriteria()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

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
      toast.error(t('nameAndDescriptionRequired'))
      return
    }

    startTransition(async () => {
      if (editingCriterion) {
        // Update existing
        const { criterion, error } = await updateCallCriterion(editingCriterion.id, {
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
        })
        if (error) {
          toast.error(error)
        } else if (criterion) {
          setCriteria(prev => prev.map(c => c.id === criterion.id ? criterion : c))
          toast.success(t('criterionUpdated'))
          setIsDialogOpen(false)
        }
      } else {
        // Create new
        const { criterion, error } = await createCallCriterion({
          organization_id: organizationId,
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
        })
        if (error) {
          toast.error(error)
        } else if (criterion) {
          setCriteria(prev => [...prev, criterion])
          toast.success(t('criterionCreated'))
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
        setCriteria(prev => prev.filter(c => c.id !== deletingCriterion.id))
        toast.success(t('criterionDeleted'))
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
        setCriteria(prev => prev.map(c => c.id === updated.id ? updated : c))
      }
    })
  }

  // Drag and drop handlers
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

    const newCriteria = [...criteria]
    const draggedIndex = newCriteria.findIndex(c => c.id === draggedItem.id)
    const targetIndex = newCriteria.findIndex(c => c.id === targetCriterion.id)

    // Remove dragged item and insert at target position
    const [removed] = newCriteria.splice(draggedIndex, 1)
    newCriteria.splice(targetIndex, 0, removed)

    setCriteria(newCriteria)
    setDraggedItem(null)

    // Save new order
    const { error } = await reorderCallCriteria(newCriteria.map(c => c.id))
    if (error) {
      toast.error(error)
      loadCriteria() // Reload on error
    }
  }

  function handleDragEnd() {
    setDraggedItem(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">{tCommon('loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{t('title')}</h3>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        {canEdit && (
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t('addCriterion')}
          </Button>
        )}
      </div>

      {criteria.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <p>{t('noCriteria')}</p>
          {canEdit && (
            <Button variant="link" onClick={openCreateDialog} className="mt-2">
              {t('addFirstCriterion')}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {criteria.map((criterion) => (
            <div
              key={criterion.id}
              className={`flex items-center gap-3 p-3 bg-card border rounded-lg transition-opacity ${
                draggedItem?.id === criterion.id ? 'opacity-50' : ''
              } ${!criterion.is_active ? 'opacity-60' : ''}`}
              draggable={canEdit}
              onDragStart={(e) => handleDragStart(e, criterion)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, criterion)}
              onDragEnd={handleDragEnd}
            >
              {canEdit && (
                <div className="cursor-grab text-muted-foreground hover:text-foreground">
                  <GripVertical className="h-5 w-5" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{criterion.name}</span>
                  {!criterion.is_active && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">
                      {t('inactive')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {criterion.description}
                </p>
              </div>

              {canEdit && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={criterion.is_active ?? false}
                    onCheckedChange={() => handleToggleActive(criterion)}
                    disabled={isPending}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(criterion)}
                    disabled={isPending}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingCriterion(criterion)}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCriterion ? t('editCriterion') : t('createCriterion')}
            </DialogTitle>
            <DialogDescription>
              {editingCriterion ? t('editCriterionDescription') : t('createCriterionDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('criterionDescription')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {t('descriptionHint')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="active">{t('active')}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? tCommon('saving') : (editingCriterion ? tCommon('save') : tCommon('create'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCriterion} onOpenChange={() => setDeletingCriterion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
