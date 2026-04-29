'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Loader2, ExternalLink, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  createMCPServer,
  updateMCPServer,
  type MCPServerData,
} from '@/lib/actions/mcp-servers'

type AuthType = 'none' | 'bearer' | 'api_key' | 'oauth2'

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
  const searchParams = useSearchParams()
  const t = useTranslations('mcpServers.form')
  const tCommon = useTranslations('common')
  const isEditing = !!server

  // Form state
  const [name, setName] = useState(server?.name || '')
  const [description, setDescription] = useState(server?.description || '')
  const [url, setUrl] = useState(server?.url || '')
  const [authType, setAuthType] = useState<AuthType>(
    (server?.auth_type as AuthType) || 'none'
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

  // OAuth status from server record
  const oauthAccessToken =
    (server?.auth_config as { accessToken?: string } | undefined)?.accessToken
  const oauthConnectedAt = (server as unknown as { oauth_connected_at?: string | null } | undefined)?.oauth_connected_at

  // Surface success/error from OAuth callback redirect
  useEffect(() => {
    const success = searchParams.get('mcp_oauth')
    const error = searchParams.get('mcp_oauth_error')
    if (success === 'success') {
      toast.success(t('oauth2Success'))
    } else if (error) {
      toast.error(t('oauth2Error', { code: error }))
    }
  }, [searchParams, t])

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Build auth config based on auth type
    const existingConfig = (server?.auth_config as Record<string, unknown> | undefined) || {}
    const authConfig: Record<string, unknown> = {}
    if (authType === 'bearer' && authToken) {
      authConfig.token = authToken
    } else if (authType === 'api_key' && apiKey) {
      authConfig.apiKey = apiKey
      authConfig.headerName = apiKeyHeader
    } else if (authType === 'oauth2') {
      // Preserve existing OAuth tokens/credentials when editing — they live in the same JSONB
      Object.assign(authConfig, existingConfig)
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
            onValueChange={value => setAuthType(value as AuthType)}
            disabled={isLoading}
          >
            <SelectTrigger id="authType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('authNone')}</SelectItem>
              <SelectItem value="bearer">{t('authBearer')}</SelectItem>
              <SelectItem value="api_key">{t('authApiKey')}</SelectItem>
              <SelectItem value="oauth2">{t('authOauth2')}</SelectItem>
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

        {authType === 'oauth2' && (
          <div className="space-y-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 p-4">
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {t('oauth2Hint')}
            </p>

            {isEditing && oauthAccessToken ? (
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                <span className="font-medium">{t('oauth2Connected')}</span>
                {oauthConnectedAt && (
                  <span className="text-xs text-neutral-500">
                    · {t('oauth2ConnectedSince', { date: new Date(oauthConnectedAt).toLocaleDateString() })}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">{t('oauth2NotConnected')}</p>
            )}

            <div className="flex gap-2">
              {isEditing ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={`/api/mcp/oauth/start?serverId=${server.id}&returnTo=/${orgSlug}/mcp-servers/${server.id}/edit`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {oauthAccessToken ? t('oauth2Reconnect') : t('oauth2Connect')}
                  </a>
                </Button>
              ) : (
                <p className="text-xs text-neutral-500 italic">{t('oauth2SaveFirst')}</p>
              )}
            </div>
          </div>
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
