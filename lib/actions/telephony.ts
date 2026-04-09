'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { revalidatePath } from 'next/cache'

export async function getTelephonyAccount(organizationId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('telephony_accounts')
    .select('id, provider, provider_account_id, account_info, is_active, created_at')
    .eq('organization_id', organizationId)
    .eq('provider', 'sipgate')
    .maybeSingle()
  return data
}

export async function disconnectTelephonyAccount(organizationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner'].includes(membership.role)) {
    return { error: 'Only owners can disconnect a telephony account' }
  }

  const serviceSupabase = createServiceRoleClient()
  const { error } = await serviceSupabase
    .from('telephony_accounts')
    .delete()
    .eq('organization_id', organizationId)
    .eq('provider', 'sipgate')

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
