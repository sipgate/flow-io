'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X, Variable, GripVertical, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VariableDefinitionForm } from './variable-definition-form'
import {
  getAssistantVariableDefinitions,
  deleteVariableDefinition,
} from '@/lib/actions/variables'
import type { VariableDefinition } from '@/types/variables'

interface VariableDefinitionsSectionProps {
  assistantId: string
  organizationId: string
  onSummaryChange?: (summary: string) => void
}

export function VariableDefinitionsSection({
  assistantId,
  organizationId,
  onSummaryChange,
}: VariableDefinitionsSectionProps) {
  const t = useTranslations('variableDefinitions')
  const [definitions, setDefinitions] = useState<VariableDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingDefinition, setEditingDefinition] = useState<VariableDefinition | null>(null)

  // Report summary to parent
  useEffect(() => {
    if (!onSummaryChange) return
    if (definitions.length === 0) {
      onSummaryChange('—')
    } else {
      onSummaryChange(definitions.map((d) => d.label).join(', '))
    }
  }, [definitions, onSummaryChange])

  // Fetch variable definitions
  useEffect(() => {
    async function fetchDefinitions() {
      setLoading(true)
      const { definitions: defs } = await getAssistantVariableDefinitions(assistantId)
      setDefinitions(defs)
      setLoading(false)
    }
    fetchDefinitions()
  }, [assistantId])

  const handleDelete = async (definitionId: string) => {
    const { success } = await deleteVariableDefinition(definitionId)
    if (success) {
      setDefinitions((prev) => prev.filter((d) => d.id !== definitionId))
    }
  }

  const handleDefinitionCreated = (definition: VariableDefinition) => {
    setDefinitions((prev) => [...prev, definition])
    setIsAddDialogOpen(false)
  }

  const handleDefinitionUpdated = (definition: VariableDefinition) => {
    setDefinitions((prev) =>
      prev.map((d) => (d.id === definition.id ? definition : d))
    )
    setEditingDefinition(null)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'phone':
        return 'bg-lime-500/10 text-lime-700 dark:bg-lime-400/10 dark:text-lime-400'
      case 'date':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'number':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'boolean':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">{t('title')}</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {t('description')}
          </p>
        </div>
        {definitions.length > 0 && (
          <Badge variant="secondary">{t('defined', { count: definitions.length })}</Badge>
        )}
      </div>

      {/* Existing Definitions */}
      {definitions.length > 0 && (
        <div className="space-y-2">
          {definitions.map((def) => (
            <div
              key={def.id}
              className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-neutral-300 cursor-grab" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{def.label}</p>
                    <Badge variant="outline" className={`text-xs ${getTypeColor(def.type)}`}>
                      {def.type}
                    </Badge>
                    {def.required && (
                      <Badge variant="destructive" className="text-xs">
                        {t('requiredBadge')}
                      </Badge>
                    )}
                    {def.mandatory_collection && (
                      <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100">
                        {t('mandatoryBadge')}
                      </Badge>
                    )}
                    {def.confirm_with_caller && (
                      <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-100">
                        {t('confirmBadge')}
                      </Badge>
                    )}
                    {def.validation_regex && (
                      <Badge className="text-xs bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200 hover:bg-neutral-100">
                        {t('regexBadge')}
                      </Badge>
                    )}
                    {def.validation_endpoint && (
                      <Badge className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-100">
                        {t('webhookBadge')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">
                      {def.name}
                    </code>
                    {def.description && ` - ${def.description}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingDefinition(def)}
                >
                  <Pencil className="h-4 w-4 text-neutral-500" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(def.id)}
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setIsAddDialogOpen(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        {t('addButton')}
      </Button>

      {/* Empty State */}
      {definitions.length === 0 && !loading && (
        <div className="text-center py-6 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700">
          <Variable className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
          <p className="text-sm text-neutral-500">{t('noVariables')}</p>
          <p className="text-xs text-neutral-400 mt-1">
            {t('noVariablesHint')}
          </p>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('addDialogTitle')}</DialogTitle>
          </DialogHeader>
          <VariableDefinitionForm
            assistantId={assistantId}
            organizationId={organizationId}
            onSuccess={handleDefinitionCreated}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingDefinition}
        onOpenChange={(open) => !open && setEditingDefinition(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('editDialogTitle')}</DialogTitle>
          </DialogHeader>
          {editingDefinition && (
            <VariableDefinitionForm
              assistantId={assistantId}
              organizationId={organizationId}
              existingDefinition={editingDefinition}
              onSuccess={handleDefinitionUpdated}
              onCancel={() => setEditingDefinition(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
