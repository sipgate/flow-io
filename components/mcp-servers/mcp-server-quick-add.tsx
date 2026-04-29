'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Plus, Loader2, ExternalLink, Check } from 'lucide-react'
import { createMCPServerForOAuth } from '@/lib/actions/mcp-servers'

interface MCPServerQuickAddProps {
  organizationId: string
  orgSlug: string
  /** Visual variant of the trigger button (defaults to 'default'). */
  variant?: 'default' | 'outline'
  /** Optional class for the trigger button. */
  triggerClassName?: string
}

/**
 * Two-step quick-add popover for MCP servers:
 *  1. URL input → "Connect" creates a minimal OAuth-typed server.
 *  2. Connected → "Login with provider" button starts the OAuth flow.
 *
 * Power users can click "Advanced" to fall through to the full form.
 */
export function MCPServerQuickAdd({
  organizationId,
  orgSlug,
  variant = 'default',
  triggerClassName,
}: MCPServerQuickAddProps) {
  const t = useTranslations('mcpServers')
  const tCommon = useTranslations('common')
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdServerId, setCreatedServerId] = useState<string | null>(null)

  const reset = () => {
    setUrl('')
    setError(null)
    setCreatedServerId(null)
    setCreating(false)
  }

  const handleConnect = async () => {
    setError(null)
    setCreating(true)
    const { server, error: createErr } = await createMCPServerForOAuth({
      organizationId,
      url: url.trim(),
    })
    setCreating(false)
    if (createErr || !server) {
      setError(createErr || 'Failed to create server')
      return
    }
    setCreatedServerId(server.id)
    router.refresh()
  }

  const oauthStartHref = createdServerId
    ? `/api/mcp/oauth/start?serverId=${createdServerId}&returnTo=${encodeURIComponent(`/${orgSlug}/mcp-servers/${createdServerId}/edit`)}`
    : '#'

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <PopoverTrigger asChild>
        <Button variant={variant} className={triggerClassName}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addServer')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        {!createdServerId ? (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm">{t('quickAdd.title')}</h4>
              <p className="text-xs text-neutral-500 mt-1">
                {t('quickAdd.description')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-add-url" className="text-xs">
                {t('form.urlRequired')}
              </Label>
              <Input
                id="quick-add-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('form.urlPlaceholder')}
                disabled={creating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim()) {
                    e.preventDefault()
                    handleConnect()
                  }
                }}
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <Link
                href={`/${orgSlug}/mcp-servers/new`}
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 underline-offset-2 hover:underline"
              >
                {t('quickAdd.advanced')}
              </Link>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={creating}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConnect}
                  disabled={!url.trim() || creating}
                >
                  {creating && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                  {t('quickAdd.connect')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">{t('quickAdd.serverCreated')}</h4>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('quickAdd.loginPrompt')}
                </p>
              </div>
            </div>

            <Button asChild className="w-full">
              <a href={oauthStartHref}>
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('quickAdd.loginButton')}
              </a>
            </Button>

            <Link
              href={`/${orgSlug}/mcp-servers/${createdServerId}/edit`}
              className="block text-center text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 underline-offset-2 hover:underline"
            >
              {t('quickAdd.skipLogin')}
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
