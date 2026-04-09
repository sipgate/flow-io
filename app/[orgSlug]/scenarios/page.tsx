import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getScenarios } from '@/lib/actions/scenarios'
import { ScenariosList } from '@/components/scenarios/scenarios-list'

export default async function ScenariosPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const t = await getTranslations('scenarios')
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const { scenarios, error } = await getScenarios(organization.id)

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="p-4 mb-6 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        <ScenariosList
          scenarios={scenarios}
          organizationId={organization.id}
          orgSlug={orgSlug}
        />
      </div>
    </div>
  )
}
