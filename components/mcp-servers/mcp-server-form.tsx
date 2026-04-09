'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import {
  createMCPServer,
  updateMCPServer,
  type MCPServerData,
} from '@/lib/actions/mcp-servers'

interface MCPServerFormProps {
  organizationId: string
  orgSlug: string
  server?: MCPServerData
}

export function MCPServerForm({
  organizationId,
  orgSlug,
  server,
}: MCPServerFormProps) {
  const router = useRouter()
  const t = useTranslations('mcpServers.form')
  const tCommon = useTranslations('common')
  const isEditing = !!server

  // Form state
  const [name, setName] = useState(server?.name || '')
  const [description, setDescription] = useState(server?.description || '')
  const [url, setUrl] = useState(server?.url || '')
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'api_key'>(
    (server?.auth_type as 'none' | 'bearer' | 'api_key') || 'none'
  )
  const [authToken, setAuthToken] = useState(
    (server?.auth_config as { token?: string })?.token || ''
  )
  const [apiKey, setApiKey] = useState(
    (server?.auth_config as { apiKey?: string })?.apiKey || ''
  )
  const [apiKeyHeader, setApiKeyHeader] = useState(
    (server?.auth_config as { headerName?: string })?.headerName || 'X-API-Key'
  )
  const [timeoutMs, setTimeoutMs] = useState(server?.timeout_ms || 30000)
  const [isActive, setIsActive] = useState(server?.is_active ?? true)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Build auth config based on auth type
    const authConfig: Record<string, unknown> = {}
    if (authType === 'bearer' && authToken) {
      authConfig.token = authToken
    } else if (authType === 'api_key' && apiKey) {
      authConfig.apiKey = apiKey
      authConfig.headerName = apiKeyHeader
    }

    const data = {
      name,
      description: description || undefined,
      url,
      authType,
      authConfig,
      timeoutMs,
    }

    let result

    if (isEditing) {
      result = await updateMCPServer(server.id, {
        ...data,
        isActive,
      })
    } else {
      result = await createMCPServer({
        organizationId,
        ...data,
      })
    }

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    // Navigate back to list - use replace to prevent back button issues
    router.replace(`/${orgSlug}/mcp-servers`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-900">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('basicInfo')}</h3>

        <div className="space-y-2">
          <Label htmlFor="name">{t('nameRequired')}</Label>
          <Input
            id="name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('description')}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            rows={2}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="url">{t('urlRequired')}</Label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder={t('urlPlaceholder')}
            required
            disabled={isLoading}
          />
          <p className="text-xs text-neutral-500">
            {t('urlHint')}
          </p>
        </div>
      </div>

      <Separator />

      {/* Authentication */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('authentication')}</h3>

        <div className="space-y-2">
          <Label htmlFor="authType">{t('authType')}</Label>
          <Select
            value={authType}
            onValueChange={value =>
              setAuthType(value as 'none' | 'bearer' | 'api_key')
            }
            disabled={isLoading}
          >
            <SelectTrigger id="authType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('authNone')}</SelectItem>
              <SelectItem value="bearer">{t('authBearer')}</SelectItem>
              <SelectItem value="api_key">{t('authApiKey')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {authType === 'bearer' && (
          <div className="space-y-2">
            <Label htmlFor="authToken">{t('bearerToken')}</Label>
            <Input
              id="authToken"
              type="password"
              value={authToken}
              onChange={e => setAuthToken(e.target.value)}
              placeholder={t('bearerTokenPlaceholder')}
              disabled={isLoading}
            />
          </div>
        )}

        {authType === 'api_key' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="apiKey">{t('apiKey')}</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={t('apiKeyPlaceholder')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKeyHeader">{t('headerName')}</Label>
              <Input
                id="apiKeyHeader"
                value={apiKeyHeader}
                onChange={e => setApiKeyHeader(e.target.value)}
                placeholder="X-API-Key"
                disabled={isLoading}
              />
              <p className="text-xs text-neutral-500">
                {t('headerNameHint')}
              </p>
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Advanced Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('advancedSettings')}</h3>

        <div className="space-y-2">
          <Label htmlFor="timeoutMs">{t('timeout')}</Label>
          <Input
            id="timeoutMs"
            type="number"
            min={1000}
            max={120000}
            value={timeoutMs}
            onChange={e => setTimeoutMs(parseInt(e.target.value) || 30000)}
            disabled={isLoading}
          />
          <p className="text-xs text-neutral-500">
            {t('timeoutHint')}
          </p>
        </div>

        {isEditing && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={checked => setIsActive(checked as boolean)}
              disabled={isLoading}
            />
            <Label htmlFor="isActive" className="font-normal cursor-pointer">
              {t('activeHint')}
            </Label>
          </div>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${orgSlug}/mcp-servers`)}
          disabled={isLoading}
        >
          {tCommon('cancel')}
        </Button>

        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? t('updateServer') : t('createServer')}
        </Button>
      </div>
    </form>
  )
}
