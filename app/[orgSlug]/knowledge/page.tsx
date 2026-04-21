import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getOrganizationMCPServers } from '@/lib/actions/mcp-servers'
import { getOrganizationKnowledgeBases, getKBAnalyticsSummary } from '@/lib/actions/knowledge-base'
import { getOrganizationWebhookTools } from '@/lib/actions/webhook-tools'
import { KnowledgeBaseManager } from '@/components/knowledge-base/knowledge-base-manager'
import { MCPServerList } from '@/components/mcp-servers/mcp-server-list'
import { WebhookToolList } from '@/components/webhook-tools/webhook-tool-list'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { orgSlug } = await params
  const { tab } = await searchParams
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const isAdmin = ['owner', 'admin'].includes(membership.role)
  const t = await getTranslations('knowledge')

  const [
    { knowledgeBases },
    { analytics },
    { servers },
    { tools: webhookTools },
  ] = await Promise.all([
    getOrganizationKnowledgeBases(organization.id),
    getKBAnalyticsSummary(organization.id),
    isAdmin ? getOrganizationMCPServers(organization.id) : Promise.resolve({ servers: [] }),
    isAdmin ? getOrganizationWebhookTools(organization.id) : Promise.resolve({ tools: [] }),
  ])

  const validTabs = ['knowledge', isAdmin && 'mcp', isAdmin && 'webhooks'].filter(Boolean) as string[]
  const defaultTab = validTabs.includes(tab ?? '') ? (tab as string) : 'knowledge'

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="knowledge">{t('tabKnowledge')}</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="mcp">{t('tabMcp')}</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="webhooks">{t('tabWebhooks')}</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="knowledge" className="space-y-6">
            <KnowledgeBaseManager
              organizationId={organization.id}
              canManage={isAdmin}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase joined query type doesn't match the component's narrower interface
              knowledgeBases={knowledgeBases as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase result type doesn't match the component's narrower interface
              analytics={analytics as any}
            />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="mcp" className="space-y-6">
              <MCPServerList
                organizationId={organization.id}
                orgSlug={orgSlug}
                servers={servers}
              />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="webhooks" className="space-y-6">
              <WebhookToolList
                organizationId={organization.id}
                tools={webhookTools}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
