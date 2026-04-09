import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getTelephonyAccount } from '@/lib/actions/telephony'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const [{ count }, telephonyAccount] = await Promise.all([
    supabase
      .from('phone_numbers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('is_active', true),
    getTelephonyAccount(organization.id),
  ])

  const hasPhoneNumbers = (count ?? 0) > 0
  const hasTelephonyAccount = !!telephonyAccount

  return (
    <div className="h-screen overflow-hidden flex bg-neutral-100 dark:bg-neutral-950">
      {/* Sidebar: schwebend mit Abstand oben, unten, links */}
      <div className="p-3 pr-0 flex shrink-0">
        <DashboardSidebar
          organization={organization}
          userRole={membership.role}
          hasPhoneNumbers={hasPhoneNumbers}
          hasTelephonyAccount={hasTelephonyAccount}
        />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={user} organization={organization} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
