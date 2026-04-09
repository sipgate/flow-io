import { Suspense } from 'react'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { redirect } from 'next/navigation'
import { AnalyticsContent } from './analytics-content'

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { organization } = await getOrganizationBySlug(orgSlug)

  if (!organization) {
    redirect('/dashboard')
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Suspense fallback={<AnalyticsLoading />}>
          <AnalyticsContent organizationId={organization.id} orgSlug={orgSlug} />
        </Suspense>
      </div>
    </div>
  )
}

function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-[350px] bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
    </div>
  )
}
