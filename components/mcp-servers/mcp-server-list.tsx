'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  Plus,
  Server,
  Settings,
  Trash2,
  TestTube,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { deleteMCPServer, testMCPServer } from '@/lib/actions/mcp-servers'
import { useRouter } from 'next/navigation'

interface MCPServer {
  id: string
  name: string
  description: string | null
  url: string
  auth_type: string
  is_active: boolean
  health_status: 'healthy' | 'unhealthy' | 'unknown'
  last_health_check: string | null
}

interface TestResult {
  success: boolean
  error?: string
  serverInfo?: { name: string; version?: string }
  toolCount?: number
  tools?: Array<{ name: string; description?: string }>
}

interface MCPServerListProps {
  organizationId: string
  orgSlug: string
  servers: MCPServer[]
}

export function MCPServerList({
  organizationId,
  orgSlug,
  servers,
}: MCPServerListProps) {
  const router = useRouter()
  const t = useTranslations('mcpServers')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleTest = async (serverId: string) => {
    setTesting(serverId)
    const result = await testMCPServer(serverId)
    setTestResults(prev => ({ ...prev, [serverId]: result }))
    setTesting(null)
    router.refresh()
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    await deleteMCPServer(deleteId)
    setIsDeleting(false)
    setDeleteId(null)
    router.refresh()
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-lime-600" />
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default' as const
      case 'unhealthy':
        return 'destructive' as const
      default:
        return 'secondary' as const
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{t('title')}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {t('description')}
          </p>
        </div>
        <Link href={`/${orgSlug}/mcp-servers/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('addServer')}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {servers.map(server => (
          <Card key={server.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Server className="h-5 w-5 mt-1 text-neutral-400" />
                  <div>
                    <CardTitle className="text-lg">{server.name}</CardTitle>
                    {server.description && (
                      <CardDescription className="mt-1">
                        {server.description}
                      </CardDescription>
                    )}
                    <p className="text-xs text-neutral-400 mt-2 font-mono">
                      {server.url}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={server.is_active ? 'default' : 'secondary'}>
                    {server.is_active ? t('status.active') : t('status.inactive')}
                  </Badge>
                  <Badge
                    variant={getHealthBadgeVariant(server.health_status)}
                    className="flex items-center gap-1"
                  >
                    {getHealthIcon(server.health_status)}
                    {t(`status.${server.health_status}`)}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {testResults[server.id] && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm ${
                    testResults[server.id].success
                      ? 'bg-lime-50 dark:bg-lime-950/20 text-lime-700 dark:text-lime-400 border border-lime-200 dark:border-lime-800'
                      : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                  }`}
                >
                  {testResults[server.id].success ? (
                    <div className="space-y-1">
                      <p className="font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {t('test.success')}
                      </p>
                      {testResults[server.id].serverInfo && (
                        <p>
                          {t('test.server')}: {testResults[server.id].serverInfo?.name}
                          {testResults[server.id].serverInfo?.version &&
                            ` v${testResults[server.id].serverInfo?.version}`}
                        </p>
                      )}
                      <p>{t('test.toolsDiscovered')}: {testResults[server.id].toolCount}</p>
                      {testResults[server.id].tools &&
                        testResults[server.id].tools!.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium mb-1">{t('test.availableTools')}:</p>
                            <div className="flex flex-wrap gap-1">
                              {testResults[server.id].tools!.slice(0, 10).map(tool => (
                                <Badge
                                  key={tool.name}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {tool.name}
                                </Badge>
                              ))}
                              {testResults[server.id].tools!.length > 10 && (
                                <Badge variant="outline" className="text-xs">
                                  {t('test.more', { count: testResults[server.id].tools!.length - 10 })}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        {t('test.failed')}
                      </p>
                      <p className="mt-1 text-xs">{testResults[server.id].error}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTest(server.id)}
                  disabled={testing === server.id}
                >
                  {testing === server.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4 mr-2" />
                  )}
                  {testing === server.id ? t('test.testing') : t('test.testConnection')}
                </Button>

                <Link href={`/${orgSlug}/mcp-servers/${server.id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    {tCommon('edit')}
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteId(server.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                  {tCommon('delete')}
                </Button>
              </div>

              {server.last_health_check && (
                <p className="text-xs text-neutral-400 mt-3">
                  {t('lastChecked')}: {new Date(server.last_health_check).toLocaleString(locale)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {servers.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Server className="h-14 w-14 mx-auto text-neutral-400 mb-3" />
              <h3 className="font-medium mb-1">{t('empty.title')}</h3>
              <p className="text-sm text-neutral-500 mb-4">
                {t('empty.description')}
              </p>
              <Link href={`/${orgSlug}/mcp-servers/new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('addServer')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
