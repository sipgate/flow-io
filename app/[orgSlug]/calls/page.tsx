import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { getOrganizationCalls } from '@/lib/actions/calls'
import { CallsRealtimeWrapper } from '@/components/calls/calls-realtime-wrapper'
import { Skeleton } from '@/components/ui/skeleton'

interface CallsPageProps {
  params: {
    orgSlug: string
  }
}

async function CallsContent({ orgSlug }: { orgSlug: string }) {
  // Get organization ID from slug
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const t = await getTranslations('errors')

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()

  if (!org) {
    return (
      <div className="p-8 text-center">
        <p className="text-neutral-600 dark:text-neutral-400">{t('organizationNotFound')}</p>
      </div>
    )
  }

  const { calls, error } = await getOrganizationCalls(org.id)

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">{t('loadingCallsFailed')}: {error}</p>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase joined query type doesn't match the hand-crafted Call interface
  return <CallsRealtimeWrapper initialCalls={calls as any} organizationId={org.id} />
}

export default async function CallsPage({ params }: CallsPageProps) {
  const { orgSlug } = await params
  const t = await getTranslations('calls')

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>

        <Suspense
          fallback={
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
              <Skeleton className="h-96" />
            </div>
          }
        >
          <CallsContent orgSlug={orgSlug} />
        </Suspense>
      </div>
    </div>
  )
}
