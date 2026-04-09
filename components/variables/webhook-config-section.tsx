'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Webhook,
  Plus,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Send,
} from 'lucide-react'
import {
  getAssistantWebhook,
  upsertAssistantWebhook,
  deleteAssistantWebhook,
  testWebhook,
} from '@/lib/actions/variable-webhooks'
import type { VariableWebhook } from '@/types/variables'

interface WebhookConfigSectionProps {
  assistantId: string
  organizationId: string
  onSummaryChange?: (summary: string) => void
}

export function WebhookConfigSection({
  assistantId,
  organizationId,
  onSummaryChange,
}: WebhookConfigSectionProps) {
  const t = useTranslations('webhookConfig')
  const [webhook, setWebhook] = useState<VariableWebhook | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    status: number
    statusText: string
  } | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([])

  // Report summary to parent
  useEffect(() => {
    if (!onSummaryChange) return
    if (!url) {
      onSummaryChange('—')
    } else {
      const display = url.length > 50 ? url.substring(0, 50) + '…' : url
      onSummaryChange(enabled ? display : `${display} (deaktiviert)`)
    }
  }, [url, enabled, onSummaryChange])

  // Fetch existing webhook
  useEffect(() => {
    async function fetchWebhook() {
      setLoading(true)
      const { webhook: existing } = await getAssistantWebhook(assistantId)
      if (existing) {
        setWebhook(existing)
        setName(existing.name)
        setUrl(existing.url)
        setEnabled(existing.enabled)
        const headerEntries = Object.entries(existing.headers || {}).map(
          ([key, value]) => ({ key, value: value as string })
        )
        setHeaders(headerEntries.length > 0 ? headerEntries : [])
      }
      setLoading(false)
    }
    fetchWebhook()
  }, [assistantId])

  const handleSave = async () => {
    setSaving(true)
    setTestResult(null)

    // Convert headers array to object
    const headersObj: Record<string, string> = {}
    headers.forEach((h) => {
      if (h.key.trim()) {
        headersObj[h.key.trim()] = h.value
      }
    })

    const { webhook: saved, error } = await upsertAssistantWebhook({
      assistant_id: assistantId,
      organization_id: organizationId,
      name: name || 'Variable Webhook',
      url,
      enabled,
      headers: headersObj,
    })

    if (saved) {
      setWebhook(saved)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    setSaving(true)
    await deleteAssistantWebhook(assistantId)
    setWebhook(null)
    setName('')
    setUrl('')
    setEnabled(true)
    setHeaders([])
    setSaving(false)
  }

  const handleTest = async () => {
    if (!url) return

    setTesting(true)
    setTestResult(null)

    // Convert headers array to object
    const headersObj: Record<string, string> = {}
    headers.forEach((h) => {
      if (h.key.trim()) {
        headersObj[h.key.trim()] = h.value
      }
    })

    const result = await testWebhook(url, headersObj)
    setTestResult(result)
    setTesting(false)
  }

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }])
  }

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index))
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...headers]
    updated[index][field] = value
    setHeaders(updated)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">{t('title')}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {t('description')}
            </p>
          </div>
        </div>
        <div className="text-center py-4 text-neutral-500">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">{t('title')}</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {t('descriptionAfterCall')}
          </p>
        </div>
        {webhook && (
          <Badge variant={webhook.enabled ? 'default' : 'secondary'}>
            {webhook.enabled ? t('enabled') : t('disabled')}
          </Badge>
        )}
      </div>

      <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-name">{t('nameLabel')}</Label>
          <Input
            id="webhook-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            disabled={saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="webhook-url">{t('urlLabel')}</Label>
          <Input
            id="webhook-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('urlPlaceholder')}
            disabled={saving}
          />
          <p className="text-xs text-neutral-500">
            {t('urlHint')}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="webhook-enabled"
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked as boolean)}
            disabled={saving}
          />
          <Label htmlFor="webhook-enabled" className="cursor-pointer font-normal">
            {t('enableLabel')}
          </Label>
        </div>

        {/* Custom Headers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('customHeaders')}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addHeader}
              disabled={saving}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('addHeader')}
            </Button>
          </div>

          {headers.length > 0 && (
            <div className="space-y-2">
              {headers.map((header, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={t('headerNamePlaceholder')}
                    value={header.key}
                    onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    disabled={saving}
                    className="flex-1"
                  />
                  <Input
                    placeholder={t('headerValuePlaceholder')}
                    value={header.value}
                    onChange={(e) => updateHeader(index, 'value', e.target.value)}
                    disabled={saving}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHeader(index)}
                    disabled={saving}
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {headers.length === 0 && (
            <p className="text-xs text-neutral-500">
              {t('noHeaders')}
            </p>
          )}
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              testResult.success
                ? 'bg-lime-50 dark:bg-lime-950/20 text-lime-700 dark:text-lime-400'
                : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="text-sm">
              {testResult.success
                ? t('testSuccess', { status: testResult.status })
                : t('testFailed', { statusText: testResult.statusText })}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            {url && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || saving || !url}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {t('testButton')}
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {webhook && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={saving}
              >
                {t('removeButton')}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || !url}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Webhook className="h-4 w-4 mr-2" />
              )}
              {webhook ? t('updateButton') : t('saveButton')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
