import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getOrganizationAssistants } from '@/lib/actions/assistants'
import { TestSuiteForm } from '@/components/autotest/test-suite-form'

export default async function NewTestSuitePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const org = organization as { id: string; name: string; slug: string }
  const mem = membership as { role: string }
  const t = await getTranslations('autotest')

  // Only admins/owners can create test suites
  if (!['owner', 'admin'].includes(mem.role)) {
    redirect(`/${orgSlug}/autotest`)
  }

  // Get assistants for the dropdown
  const { assistants: assistantData } = await getOrganizationAssistants(org.id)
  const assistants = (assistantData || []).map((a) => ({
    id: (a as { id: string }).id,
    name: (a as { name: string }).name,
  }))

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{t('newSuite')}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {t('newSuiteDescription')}
          </p>
        </div>

        <TestSuiteForm
          organizationId={org.id}
          orgSlug={orgSlug}
          assistants={assistants}
        />
      </div>
    </div>
  )
}
