'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateOrganization } from '@/lib/actions/organizations'
import { getToolModelConfig, getToolModelOptions, getToolModelProviders, type ToolModelConfig } from '@/lib/tool-model'
import { getModelLabel } from '@/lib/models'
import type { LLMProviderType } from '@/lib/models'

interface ToolModelSettingsProps {
  organizationId: string
  currentSettings: Record<string, unknown>
  canEdit: boolean
}

export function ToolModelSettings({ organizationId, currentSettings, canEdit }: ToolModelSettingsProps) {
  const t = useTranslations('settingsPage.toolModel')
  const tCommon = useTranslations('common')
  const router = useRouter()

  const toolModelOptions = getToolModelOptions()
  const initialConfig: ToolModelConfig = getToolModelConfig(currentSettings)
  const [provider, setProvider] = useState<LLMProviderType>(initialConfig.tool_provider)
  const [model, setModel] = useState<string>(initialConfig.tool_model)
  const [saving, setSaving] = useState(false)

  const providers = getToolModelProviders()
  const models = toolModelOptions[provider] ?? []

  function handleProviderChange(newProvider: string) {
    const p = newProvider as LLMProviderType
    setProvider(p)
    setModel(toolModelOptions[p]?.[0] ?? '')
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateOrganization(organizationId, {
        settings: { ...currentSettings, tool_provider: provider, tool_model: model },
      })
      toast.success(t('saved'))
      router.refresh()
    } catch {
      toast.error(tCommon('error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('provider')}</Label>
          <Select value={provider} onValueChange={handleProviderChange} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('model')}</Label>
          <Select value={model} onValueChange={setModel} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {getModelLabel(provider, m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {canEdit && (
        <Button onClick={handleSave} disabled={saving}>
          {saving ? tCommon('saving') : tCommon('save')}
        </Button>
      )}
    </div>
  )
}
