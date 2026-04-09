'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Webhook, Plus, Trash2, TestTube, Loader2, Check, X, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  getAssistantContextWebhook,
  upsertContextWebhook,
  deleteContextWebhook,
  testContextWebhook,
} from '@/lib/actions/context-webhooks'
import type { ContextWebhook } from '@/types/context-webhook'

interface ContextWebhookSectionProps {
  assistantId: string
  organizationId: string
  onSummaryChange?: (summary: string) => void
}

interface HeaderPair {
  key: string
  value: string
}

export function ContextWebhookSection({
  assistantId,
  organizationId,
  onSummaryChange,
}: ContextWebhookSectionProps) {
  const t = useTranslations('contextWebhook')
  const [webhook, setWebhook] = useState<ContextWebhook | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    response?: Record<string, unknown> | unknown[] | string | number | boolean | null
  } | null>(null)

  // Form state
  const [name, setName] = useState('Context Webhook')
  const [url, setUrl] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [timeoutMs, setTimeoutMs] = useState(5000)
  const [includeCallerNumber, setIncludeCallerNumber] = useState(true)
  const [includeCalledNumber, setIncludeCalledNumber] = useState(true)
  const [includeCallDirection, setIncludeCallDirection] = useState(true)
  const [variablePrefix, setVariablePrefix] = useState('context')
  const [headers, setHeaders] = useState<HeaderPair[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

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

  // Fetch existing webhook config
  useEffect(() => {
    const fetchWebhook = async () => {
      const { webhook: existingWebhook } = await getAssistantContextWebhook(assistantId)
      if (existingWebhook) {
        setWebhook(existingWebhook)
        setName(existingWebhook.name)
        setUrl(existingWebhook.url)
        setEnabled(existingWebhook.enabled)
        setTimeoutMs(existingWebhook.timeout_ms)
        setIncludeCallerNumber(existingWebhook.include_caller_number)
        setIncludeCalledNumber(existingWebhook.include_called_number)
        setIncludeCallDirection(existingWebhook.include_call_direction)
        setVariablePrefix(existingWebhook.response_variable_prefix)
        // Convert headers object to array
        const headerPairs = Object.entries(existingWebhook.headers || {}).map(
          ([key, value]) => ({ key, value: String(value) })
        )
        setHeaders(headerPairs.length > 0 ? headerPairs : [])
      }
      setLoading(false)
    }
    fetchWebhook()
  }, [assistantId])

  const handleSave = async () => {
    if (!url.trim()) return

    setSaving(true)
    setTestResult(null)

    // Convert headers array to object
    const headersObj = headers.reduce(
      (acc, { key, value }) => {
        if (key.trim()) {
          acc[key.trim()] = value
        }
        return acc
      },
      {} as Record<string, string>
    )

    const { webhook: savedWebhook, error } = await upsertContextWebhook({
      assistant_id: assistantId,
      organization_id: organizationId,
      name: name.trim() || 'Context Webhook',
      url: url.trim(),
      enabled,
      headers: headersObj,
      timeout_ms: timeoutMs,
      include_caller_number: includeCallerNumber,
      include_called_number: includeCalledNumber,
      include_call_direction: includeCallDirection,
      response_variable_prefix: variablePrefix.trim() || 'context',
    })

    if (savedWebhook) {
      setWebhook(savedWebhook)
    }

    setSaving(false)
  }

  const handleDelete = async () => {
    if (!webhook) return

    setSaving(true)
    await deleteContextWebhook(assistantId)
    setWebhook(null)
    setUrl('')
    setName('Context Webhook')
    setHeaders([])
    setTestResult(null)
    setSaving(false)
  }

  const handleTest = async () => {
    if (!url.trim()) return

    setTesting(true)
    setTestResult(null)

    // Convert headers array to object
    const headersObj = headers.reduce(
      (acc, { key, value }) => {
        if (key.trim()) {
          acc[key.trim()] = value
        }
        return acc
      },
      {} as Record<string, string>
    )

    const result = await testContextWebhook(url.trim(), headersObj, timeoutMs)

    setTestResult({
      success: result.success,
      message: result.success
        ? t('successMessage', { duration: result.durationMs })
        : result.error || t('unknownError'),
      response: result.response as Record<string, unknown> | unknown[] | string | number | boolean | null | undefined,
    })

    setTesting(false)
  }

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }])
  }

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index))
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers]
    newHeaders[index][field] = value
    setHeaders(newHeaders)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          {t('title')}
        </CardTitle>
        <CardDescription>
          {t('description')} <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-1 rounded">{`{{${variablePrefix}.field_name}}`}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable Toggle */}
        {webhook && (
          <div className="flex items-center justify-between">
            <Label htmlFor="webhook-enabled">{t('enabledLabel')}</Label>
            <Switch
              id="webhook-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        )}

        {/* Webhook URL */}
        <div className="space-y-2">
          <Label htmlFor="webhook-url">{t('urlLabel')}</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder={t('urlPlaceholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-neutral-500">
            {t('urlHint')}
          </p>
        </div>

        {/* Variable Prefix */}
        <div className="space-y-2">
          <Label htmlFor="variable-prefix">{t('prefixLabel')}</Label>
          <Input
            id="variable-prefix"
            placeholder={t('prefixPlaceholder')}
            value={variablePrefix}
            onChange={(e) => setVariablePrefix(e.target.value)}
          />
          <p className="text-xs text-neutral-500">
            {t('prefixHint')} <code className="bg-neutral-100 dark:bg-neutral-800 px-1 rounded">{`{{${variablePrefix || 'context'}.field}}`}</code>
          </p>
        </div>

        {/* Advanced Settings */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
              <Settings2 className="h-4 w-4" />
              {t('advancedSettings')}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="webhook-name">{t('nameLabel')}</Label>
              <Input
                id="webhook-name"
                placeholder={t('namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Timeout */}
            <div className="space-y-2">
              <Label htmlFor="timeout">{t('timeoutLabel')}</Label>
              <Input
                id="timeout"
                type="number"
                min={1000}
                max={30000}
                step={500}
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(parseInt(e.target.value) || 5000)}
              />
              <p className="text-xs text-neutral-500">
                {t('timeoutHint')}
              </p>
            </div>

            {/* Include Options */}
            <div className="space-y-3">
              <Label>{t('includeInRequest')}</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="include-caller"
                    checked={includeCallerNumber}
                    onCheckedChange={setIncludeCallerNumber}
                  />
                  <Label htmlFor="include-caller" className="font-normal">
                    {t('callerNumber')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="include-called"
                    checked={includeCalledNumber}
                    onCheckedChange={setIncludeCalledNumber}
                  />
                  <Label htmlFor="include-called" className="font-normal">
                    {t('calledNumber')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="include-direction"
                    checked={includeCallDirection}
                    onCheckedChange={setIncludeCallDirection}
                  />
                  <Label htmlFor="include-direction" className="font-normal">
                    {t('callDirection')}
                  </Label>
                </div>
              </div>
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
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('addHeader')}
                </Button>
              </div>
              {headers.length > 0 ? (
                <div className="space-y-2">
                  {headers.map((header, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={t('headerNamePlaceholder')}
                        value={header.key}
                        onChange={(e) => updateHeader(index, 'key', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder={t('headerValuePlaceholder')}
                        value={header.value}
                        onChange={(e) => updateHeader(index, 'value', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeHeader(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500">
                  {t('noHeaders')}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Test Result */}
        {testResult && (
          <div
            className={`p-3 rounded-lg text-sm ${
              testResult.success
                ? 'bg-lime-50 dark:bg-lime-950/20 text-lime-700 dark:text-lime-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
              <span className="font-medium">{testResult.message}</span>
            </div>
            {testResult.response && (
              <pre className="mt-2 text-xs overflow-x-auto bg-white/50 dark:bg-black/20 p-2 rounded">
                {JSON.stringify(testResult.response, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={!url.trim() || testing}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            {t('testButton')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!url.trim() || saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            {t('saveButton')}
          </Button>
          {webhook && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('removeButton')}
            </Button>
          )}
        </div>

        {/* Documentation */}
        <div className="pt-4 border-t">
          <p className="text-xs text-neutral-500 mb-2">
            <strong>{t('requestPayload')}</strong>
          </p>
          <pre className="text-xs bg-neutral-100 dark:bg-neutral-800 p-3 rounded overflow-x-auto">
{`{
  "event": "call_start",
  "timestamp": "2025-12-17T15:00:00Z",
  "call": {
    "session_id": "abc123",
    "caller_number": "+4915112345678",
    "called_number": "+4930123456789",
    "direction": "inbound"
  },
  "assistant": {
    "id": "uuid",
    "name": "My Assistant"
  }
}`}
          </pre>
          <p className="text-xs text-neutral-500 mt-3 mb-2">
            <strong>{t('expectedResponse')}</strong> {t('expectedResponseHint')}
          </p>
          <pre className="text-xs bg-neutral-100 dark:bg-neutral-800 p-3 rounded overflow-x-auto">
{`{
  "customer_name": "John Doe",
  "account_status": "premium",
  "last_order": "ORD-12345"
}`}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}
