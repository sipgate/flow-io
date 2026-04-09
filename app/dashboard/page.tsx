import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserOrganizations } from '@/lib/actions/organizations'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has organizations
  const { organizations } = await getUserOrganizations()

  if (organizations.length === 0) {
    redirect('/onboarding')
  }

  // Redirect to first organization's dashboard
  redirect(`/${organizations[0].slug}/dashboard`)
}
