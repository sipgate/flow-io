'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Loader2, ChevronDown } from 'lucide-react'
import {
  createVariableDefinition,
  updateVariableDefinition,
} from '@/lib/actions/variables'
import type { VariableDefinition, VariableType } from '@/types/variables'

interface VariableDefinitionFormProps {
  assistantId: string
  organizationId: string
  existingDefinition?: VariableDefinition
  onSuccess: (definition: VariableDefinition) => void
  onCancel: () => void
}

const VARIABLE_TYPES: { value: VariableType; label: string; description: string }[] = [
  { value: 'string', label: 'Text', description: 'Any text value' },
  { value: 'email', label: 'Email', description: 'Email address' },
  { value: 'phone', label: 'Phone', description: 'Phone number' },
  { value: 'number', label: 'Number', description: 'Numeric value' },
  { value: 'date', label: 'Date', description: 'Date or datetime' },
  { value: 'boolean', label: 'Yes/No', description: 'True or false value' },
]

export function VariableDefinitionForm({
  assistantId,
  organizationId,
  existingDefinition,
  onSuccess,
  onCancel,
}: VariableDefinitionFormProps) {
  const t = useTranslations('variableDefinitionForm')
  const isEditing = !!existingDefinition

  // Form state
  const [name, setName] = useState(existingDefinition?.name || '')
  const [label, setLabel] = useState(existingDefinition?.label || '')
  const [description, setDescription] = useState(existingDefinition?.description || '')
  const [type, setType] = useState<VariableType>(existingDefinition?.type || 'string')
  const [required, setRequired] = useState(existingDefinition?.required || false)

  // Validation & Collection state
  const [mandatoryCollection, setMandatoryCollection] = useState(existingDefinition?.mandatory_collection || false)
  const [confirmWithCaller, setConfirmWithCaller] = useState(existingDefinition?.confirm_with_caller || false)
  const [validationRegex, setValidationRegex] = useState(existingDefinition?.validation_regex || '')
  const [validationEndpoint, setValidationEndpoint] = useState(existingDefinition?.validation_endpoint || '')
  const [validationErrorHint, setValidationErrorHint] = useState(existingDefinition?.validation_error_hint || '')

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationOpen, setValidationOpen] = useState(
    !!(existingDefinition?.mandatory_collection || existingDefinition?.confirm_with_caller ||
       existingDefinition?.validation_regex || existingDefinition?.validation_endpoint)
  )

  // Auto-generate name from label
  const handleLabelChange = (value: string) => {
    setLabel(value)
    // Only auto-generate name if it hasn't been manually edited or is empty
    if (!existingDefinition && (!name || name === generateName(label))) {
      setName(generateName(value))
    }
  }

  const generateName = (labelValue: string) => {
    return labelValue
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Validate name format
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      setError(t('nameFormatError'))
      setIsLoading(false)
      return
    }

    // Validate regex if provided
    if (validationRegex) {
      try {
        new RegExp(validationRegex)
      } catch {
        setError(t('invalidRegex'))
        setIsLoading(false)
        return
      }
    }

    // Validate endpoint URL if provided
    if (validationEndpoint) {
      try {
        new URL(validationEndpoint)
      } catch {
        setError(t('invalidWebhookUrl'))
        setIsLoading(false)
        return
      }
    }

    const validationFields = {
      validation_regex: validationRegex || null,
      validation_endpoint: validationEndpoint || null,
      validation_error_hint: validationErrorHint || null,
      mandatory_collection: mandatoryCollection,
      confirm_with_caller: confirmWithCaller,
    }

    if (isEditing && existingDefinition) {
      const { definition, error: updateError } = await updateVariableDefinition(
        existingDefinition.id,
        { name, label, description, type, required, ...validationFields }
      )

      if (updateError || !definition) {
        setError(updateError || t('updateFailed'))
        setIsLoading(false)
        return
      }

      onSuccess(definition)
    } else {
      const { definition, error: createError } = await createVariableDefinition({
        assistant_id: assistantId,
        organization_id: organizationId,
        name,
        label,
        description,
        type,
        required,
        ...validationFields,
      })

      if (createError || !definition) {
        setError(createError || t('createFailed'))
        setIsLoading(false)
        return
      }

      onSuccess(definition)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-900">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="label">{t('labelField')}</Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder={t('labelPlaceholder')}
          required
          disabled={isLoading}
        />
        <p className="text-xs text-neutral-500">
          {t('labelHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">{t('nameField')}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          required
          disabled={isLoading}
          pattern="[a-z][a-z0-9_]*"
        />
        <p className="text-xs text-neutral-500">
          {t('nameHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">{t('typeField')}</Label>
        <Select
          value={type}
          onValueChange={(value) => setType(value as VariableType)}
          disabled={isLoading}
        >
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VARIABLE_TYPES.map((vtype) => (
              <SelectItem key={vtype.value} value={vtype.value}>
                <div className="flex flex-col">
                  <span>{vtype.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-neutral-500">
          {VARIABLE_TYPES.find((vtype) => vtype.value === type)?.description}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('descriptionField')}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
          rows={2}
          required
          disabled={isLoading}
        />
        <p className="text-xs text-neutral-500">
          {t('descriptionHint')}
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="required"
          checked={required}
          onCheckedChange={(checked) => setRequired(checked as boolean)}
          disabled={isLoading}
        />
        <Label htmlFor="required" className="font-normal cursor-pointer">
          {t('requiredField')}
        </Label>
      </div>

      {/* Validation & Collection Section */}
      <Collapsible open={validationOpen} onOpenChange={setValidationOpen} className="rounded-lg border border-neutral-200 dark:border-neutral-700">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-lg transition-colors"
          >
            <span>{t('validationSection')}</span>
            <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${validationOpen ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 px-4 pb-4 pt-1 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mandatoryCollection"
                checked={mandatoryCollection}
                onCheckedChange={(checked) => setMandatoryCollection(checked as boolean)}
                disabled={isLoading}
              />
              <div>
                <Label htmlFor="mandatoryCollection" className="font-normal cursor-pointer">
                  {t('mandatoryCollection')}
                </Label>
                <p className="text-xs text-neutral-500">
                  {t('mandatoryCollectionHint')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="confirmWithCaller"
                checked={confirmWithCaller}
                onCheckedChange={(checked) => setConfirmWithCaller(checked as boolean)}
                disabled={isLoading}
              />
              <div>
                <Label htmlFor="confirmWithCaller" className="font-normal cursor-pointer">
                  {t('confirmWithCaller')}
                </Label>
                <p className="text-xs text-neutral-500">
                  {t('confirmWithCallerHint')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="validationRegex">{t('validationRegex')}</Label>
              <Input
                id="validationRegex"
                value={validationRegex}
                onChange={(e) => setValidationRegex(e.target.value)}
                placeholder="^\d{5}$"
                disabled={isLoading}
                className="font-mono text-sm"
              />
              <p className="text-xs text-neutral-500">
                {t('validationRegexHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="validationEndpoint">{t('validationEndpoint')}</Label>
              <Input
                id="validationEndpoint"
                value={validationEndpoint}
                onChange={(e) => setValidationEndpoint(e.target.value)}
                placeholder="https://api.example.com/validate"
                disabled={isLoading}
              />
              <p className="text-xs text-neutral-500">
                {t('validationEndpointHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="validationErrorHint">{t('validationErrorHint')}</Label>
              <Input
                id="validationErrorHint"
                value={validationErrorHint}
                onChange={(e) => setValidationErrorHint(e.target.value)}
                placeholder="Die PLZ muss 5 Ziffern haben"
                disabled={isLoading}
              />
              <p className="text-xs text-neutral-500">
                {t('validationErrorHintHint')}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? t('update') : t('addVariable')}
        </Button>
      </div>
    </form>
  )
}
