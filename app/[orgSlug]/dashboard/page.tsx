import { getOrganizationBySlug } from '@/lib/actions/organizations'
import {
  getDashboardStats,
  getRecentCalls,
  getCallVolumeData,
  getTopVariables,
  getSystemStatus,
  getFeatureFlags,
} from '@/lib/actions/dashboard'
import { getOrganizationPhoneNumbers } from '@/lib/actions/phone-numbers'
import { getCriteriaOverview } from '@/lib/actions/call-criteria'
import { getCSATOverview } from '@/lib/actions/analytics'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { RecentCallsCard } from '@/components/dashboard/recent-calls-card'
import { CallVolumeChart } from '@/components/dashboard/call-volume-chart'
import { SystemStatus } from '@/components/dashboard/system-status'
import { TopVariables } from '@/components/dashboard/top-variables'
import { CriteriaOverviewCard } from '@/components/dashboard/criteria-overview-card'
import { CSATOverviewCard } from '@/components/dashboard/csat-overview-card'
import { PhoneNumbersCard } from '@/components/dashboard/phone-numbers-card'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { organization } = await getOrganizationBySlug(orgSlug)
  const t = await getTranslations('dashboard')

  if (!organization) {
    redirect('/dashboard')
  }

  // Fetch base data and feature flags in parallel
  const [stats, recentCalls, callVolumeData, systemStatus, featureFlags, { phoneNumbers }] = await Promise.all([
    getDashboardStats(organization.id),
    getRecentCalls(organization.id, 3),
    getCallVolumeData(organization.id),
    getSystemStatus(organization.id),
    getFeatureFlags(organization.id),
    getOrganizationPhoneNumbers(organization.id),
  ])

  // Fetch optional feature data only if features are enabled
  const [topVariables, criteriaOverviewData, csatOverviewData] = await Promise.all([
    featureFlags.hasVariableDefinitions ? getTopVariables(organization.id, 5) : Promise.resolve([]),
    featureFlags.hasCriteria ? getCriteriaOverview(organization.id, 7) : Promise.resolve(null),
    featureFlags.hasCsatEnabled ? getCSATOverview(organization.id, '7d') : Promise.resolve(null),
  ])

  const hasOptionalFeatures = featureFlags.hasCriteria || featureFlags.hasCsatEnabled || featureFlags.hasVariableDefinitions

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">{t('title')}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {t('welcome')}
            </p>
          </div>
          <SystemStatus
            connectedCount={systemStatus.connectedCount}
            assistantCount={systemStatus.assistantCount}
            allAssistantsHavePhoneNumber={systemStatus.allAssistantsHavePhoneNumber}
            orgSlug={orgSlug}
          />
        </div>

        {/* Stats Cards */}
        <StatsCards stats={stats} organizationId={organization.id} />

        {/* Call Volume + Recent Calls side by side */}
        <div className="grid gap-6 lg:grid-cols-2">
          <CallVolumeChart data={callVolumeData} />
          <RecentCallsCard
            initialCalls={recentCalls}
            organizationId={organization.id}
            orgSlug={orgSlug}
          />
        </div>

        {/* Phone Numbers with Endpoints */}
        <PhoneNumbersCard phoneNumbers={phoneNumbers} orgSlug={orgSlug} />

        {/* Optional feature widgets */}
        {hasOptionalFeatures && (
          <div className="grid gap-6 lg:grid-cols-3">
            {featureFlags.hasCriteria && criteriaOverviewData && (
              <CriteriaOverviewCard
                overview={criteriaOverviewData.overview}
                topFailingCriteria={criteriaOverviewData.topFailingCriteria}
              />
            )}
            {featureFlags.hasCsatEnabled && csatOverviewData && (
              <CSATOverviewCard data={csatOverviewData} />
            )}
            {featureFlags.hasVariableDefinitions && topVariables.length > 0 && (
              <TopVariables variables={topVariables} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
