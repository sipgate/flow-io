import { redirect } from 'next/navigation'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getTestSuites } from '@/lib/actions/autotest'
import { TestSuitesList } from '@/components/autotest/test-suites-list'
import { RunningTestsBanner } from '@/components/autotest/running-tests-banner'

export default async function AutotestPage({
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
  const { suites } = await getTestSuites(org.id)
  const canManage = ['owner', 'admin'].includes(mem.role)

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <RunningTestsBanner organizationId={org.id} />

        <TestSuitesList
          suites={suites}
          organizationId={org.id}
          orgSlug={orgSlug}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
