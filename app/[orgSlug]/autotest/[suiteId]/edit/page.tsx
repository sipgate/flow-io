import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getOrganizationAssistants } from '@/lib/actions/assistants'
import { getTestSuite } from '@/lib/actions/autotest'
import { TestSuiteForm } from '@/components/autotest/test-suite-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function EditTestSuitePage({
  params,
}: {
  params: Promise<{ orgSlug: string; suiteId: string }>
}) {
  const { orgSlug, suiteId } = await params
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const org = organization as { id: string; name: string; slug: string }
  const mem = membership as { role: string }
  const t = await getTranslations('autotest')

  // Only admins/owners can edit test suites
  if (!['owner', 'admin'].includes(mem.role)) {
    redirect(`/${orgSlug}/autotest/${suiteId}`)
  }

  // Fetch suite
  const { suite, error } = await getTestSuite(suiteId)

  if (error || !suite || suite.organization_id !== org.id) {
    notFound()
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
        <Link
          href={`/${orgSlug}/autotest/${suiteId}`}
          className="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('backToTests')}
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">{t('editSuite')}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {t('editSuiteDescription')}
          </p>
        </div>

        <TestSuiteForm
          organizationId={org.id}
          orgSlug={orgSlug}
          assistants={assistants}
          existingSuite={suite}
        />
      </div>
    </div>
  )
}
