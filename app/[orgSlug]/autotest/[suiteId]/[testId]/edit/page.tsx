import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getTestSuite, getTestCase } from '@/lib/actions/autotest'
import { TestCaseForm } from '@/components/autotest/test-case-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function EditTestCasePage({
  params,
}: {
  params: Promise<{ orgSlug: string; suiteId: string; testId: string }>
}) {
  const { orgSlug, suiteId, testId } = await params
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const org = organization as { id: string; name: string; slug: string }
  const mem = membership as { role: string }
  const t = await getTranslations('autotest')

  // Only admins/owners can edit test cases
  if (!['owner', 'admin'].includes(mem.role)) {
    redirect(`/${orgSlug}/autotest/${suiteId}`)
  }

  // Fetch suite to verify it exists
  const { suite, error: suiteError } = await getTestSuite(suiteId)

  if (suiteError || !suite || suite.organization_id !== org.id) {
    notFound()
  }

  // Fetch test case
  const { testCase, error: testError } = await getTestCase(testId)

  if (testError || !testCase || testCase.test_suite_id !== suiteId) {
    notFound()
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href={`/${orgSlug}/autotest/${suiteId}`}
          className="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('backToTests')}
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">{t('editTestCase')}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {t('editTestCaseDescription')}
          </p>
        </div>

        <TestCaseForm
          suiteId={suiteId}
          organizationId={org.id}
          orgSlug={orgSlug}
          existingTestCase={testCase}
        />
      </div>
    </div>
  )
}
