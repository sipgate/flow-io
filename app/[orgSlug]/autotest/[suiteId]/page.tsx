import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getTestSuite, getTestCases } from '@/lib/actions/autotest'
import { TestCasesList } from '@/components/autotest/test-cases-list'
import { RunningTestsBanner } from '@/components/autotest/running-tests-banner'
import { Button } from '@/components/ui/button'
import { Plus, ArrowLeft, Pencil } from 'lucide-react'
import Link from 'next/link'

export default async function TestSuiteDetailPage({
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

  // Fetch suite and test cases
  const { suite, error: suiteError } = await getTestSuite(suiteId)

  if (suiteError || !suite) {
    notFound()
  }

  // Verify suite belongs to this organization
  if (suite.organization_id !== org.id) {
    notFound()
  }

  const { cases: testCases } = await getTestCases(suiteId)
  const canManage = ['owner', 'admin'].includes(mem.role)

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/${orgSlug}/autotest`}
            className="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('backToSuites')}
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{suite.name}</h1>
              {suite.assistant && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('assistant')}: {suite.assistant.name}
                </p>
              )}
              {suite.description && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  {suite.description}
                </p>
              )}
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Link href={`/${orgSlug}/autotest/${suiteId}/edit`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('editSuite')}
                  </Button>
                </Link>
                <Link href={`/${orgSlug}/autotest/${suiteId}/new`}>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('addTest')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Running Tests Banner */}
        <RunningTestsBanner organizationId={org.id} suiteId={suiteId} />

        {/* Test Cases List */}
        <TestCasesList
          testCases={testCases}
          suiteId={suiteId}
          assistantId={suite.assistant_id}
          organizationId={org.id}
          orgSlug={orgSlug}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
