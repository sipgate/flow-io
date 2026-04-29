import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { AISetupWizard } from '@/components/assistants/ai-setup-wizard'
import { getToolModelConfig } from '@/lib/tool-model'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NewAssistantPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const org = organization as { id: string; name: string; slug: string; settings?: Record<string, unknown> }
  const mem = membership as { role: string }
  const toolModel = getToolModelConfig(org.settings ?? {})

  const canManage = ['owner', 'admin'].includes(mem.role)

  if (!canManage) {
    redirect(`/${orgSlug}/agents`)
  }

  const t = await getTranslations('assistants')

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href={`/${orgSlug}/agents`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('backToList')}
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('new.title')}</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            {t('new.aiWizardDescription')}
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
          <AISetupWizard organizationId={org.id} orgSlug={orgSlug} toolModel={toolModel} />
        </div>
      </div>
    </div>
  )
}
