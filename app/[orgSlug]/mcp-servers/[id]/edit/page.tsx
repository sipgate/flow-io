import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getMCPServer } from '@/lib/actions/mcp-servers'
import { MCPServerForm } from '@/components/mcp-servers/mcp-server-form'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function EditMCPServerPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>
}) {
  const { orgSlug, id } = await params
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const canManage = ['owner', 'admin'].includes(membership.role)

  if (!canManage) {
    redirect(`/${orgSlug}/mcp-servers`)
  }

  const { server } = await getMCPServer(id)

  if (!server) {
    redirect(`/${orgSlug}/mcp-servers`)
  }

  const t = await getTranslations('mcpServers')

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href={`/${orgSlug}/mcp-servers`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('backToList')}
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('edit.title')}</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            {t('edit.description')}
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
          <MCPServerForm
            organizationId={organization.id}
            orgSlug={orgSlug}
            server={server}
          />
        </div>
      </div>
    </div>
  )
}
