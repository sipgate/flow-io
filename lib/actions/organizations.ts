'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Helper function to auto-add user to organizations based on email domain
export async function autoAddUserToOrganizationsByDomain(
  userId: string,
  email: string
) {
  const { createServiceRoleClient } = await import(
    '@/lib/supabase/service-role'
  )
  const serviceSupabase = createServiceRoleClient()

  // Extract domain from email
  const domain = email.split('@')[1]
  if (!domain) return

  // Find organizations with matching domain and auto-add enabled
  const { data: orgs } = await serviceSupabase
    .from('organizations')
    .select('id, name, domain')
    .eq('domain', domain)
    .eq('auto_add_domain_members', true)

  if (!orgs || orgs.length === 0) return

  // Add user to each matching organization
  for (const org of orgs) {
    // Check if user is already a member
    const { data: existing } = await serviceSupabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', userId)
      .single()

    if (!existing) {
      // Add as member (default role)
      await serviceSupabase.from('organization_members').insert({
        organization_id: org.id,
        user_id: userId,
        role: 'member',
      })

      console.log(
        `Auto-added user ${email} to organization ${org.name} (${org.id})`
      )
    }
  }
}

export async function createOrganization(formData: FormData) {
  const supabase = await createClient()
  const name = formData.get('name') as string
  const slug = formData.get('slug') as string

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Use service role for organization creation
  const { createServiceRoleClient } = await import(
    '@/lib/supabase/service-role'
  )
  const serviceSupabase = createServiceRoleClient()

  // Ensure user profile exists
  const { data: existingProfile } = await serviceSupabase
    .from('user_profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!existingProfile) {
    // Create the user profile first
    const { error: profileError } = await serviceSupabase
      .from('user_profiles')
      .insert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || null,
      })

    if (profileError) {
      console.error('Failed to create user profile:', profileError)
      return { error: 'Failed to create user profile. Please try again.' }
    }
  }

  // Check if slug is already taken
  const { data: existingOrg } = await serviceSupabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existingOrg) {
    return { error: 'This organization URL is already taken' }
  }

  // Create organization
  const { data: org, error: orgError } = await serviceSupabase
    .from('organizations')
    .insert({
      name,
      slug,
      settings: {},
      subscription_tier: 'free',
    })
    .select()
    .single()

  if (orgError || !org) {
    return { error: orgError?.message || 'Failed to create organization' }
  }

  const typedOrg = org as unknown as { id: string; slug: string }

  // Add user as owner
  const { error: memberError } = await serviceSupabase
    .from('organization_members')
    .insert({
      organization_id: typedOrg.id,
      user_id: user.id,
      role: 'owner',
    })

  if (memberError) {
    return { error: memberError.message }
  }

  revalidatePath('/', 'layout')
  redirect(`/${slug}/connect`)
}

export async function getUserOrganizations() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { organizations: [] }
  }

  // Get user's organization memberships
  const { data: memberships, error: memberError } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)

  // For new users with no memberships, this is expected, not an error
  if (memberError || !memberships || memberships.length === 0) {
    return { organizations: [] }
  }

  // Get organization details
  const orgIds = memberships.map((m) => m.organization_id)
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, subscription_tier, created_at')
    .in('id', orgIds)

  if (orgError) {
    console.error('Error fetching organizations:', orgError)
    return { organizations: [] }
  }

  // Combine data
  const organizations = orgs.map((org) => {
    const membership = memberships.find((m) => m.organization_id === org.id)
    return {
      ...org,
      role: membership?.role || 'member',
    }
  })

  return { organizations }
}

interface Organization {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  domain: string | null
  auto_add_domain_members: boolean
  created_at: string
  updated_at: string
}

interface Membership {
  role: string
}

export async function getOrganizationBySlug(slug: string): Promise<{
  organization: Organization | null
  membership: Membership | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { organization: null, membership: null }
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !org) {
    return { organization: null, membership: null }
  }

  const typedOrg = org as unknown as Organization

  // Check user membership
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', typedOrg.id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return { organization: null, membership: null }
  }

  return { organization: typedOrg, membership: membership as unknown as Membership }
}

export async function updateOrganization(
  orgId: string,
  data: {
    name?: string
    settings?: Record<string, unknown>
    domain?: string | null
    auto_add_domain_members?: boolean
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('organizations')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getOrganizationMembers(orgId: string) {
  const supabase = await createClient()

  // First check if current user is a member of this organization
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { members: [] }
  }

  const { data: userMembership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!userMembership) {
    // User is not a member of this organization
    return { members: [] }
  }

  // Use service role to fetch all members (bypasses RLS)
  const { createServiceRoleClient } = await import(
    '@/lib/supabase/service-role'
  )
  const serviceSupabase = createServiceRoleClient()

  // Get memberships
  const { data: memberships, error: memberError } = await serviceSupabase
    .from('organization_members')
    .select('id, user_id, role, joined_at')
    .eq('organization_id', orgId)
    .order('joined_at', { ascending: false })

  if (memberError) {
    console.error('Error fetching members:', memberError)
    return { members: [] }
  }

  if (!memberships || memberships.length === 0) {
    return { members: [] }
  }

  // Get user profiles
  const userIds = memberships.map((m) => m.user_id)
  const { data: profiles, error: profileError } = await serviceSupabase
    .from('user_profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  if (profileError) {
    console.error('Error fetching profiles:', profileError)
    return { members: [] }
  }

  // Combine data
  const members = memberships.map((m) => {
    const profile = profiles.find((p) => p.id === m.user_id)
    return {
      id: m.id,
      role: m.role,
      joined_at: m.joined_at,
      user_profiles: profile || { id: m.user_id, full_name: null, email: null },
    }
  })

  return { members }
}

export async function inviteMember(
  orgId: string,
  email: string,
  role: 'admin' | 'member' | 'viewer'
) {
  const supabase = await createClient()

  // Verify current user is admin/owner
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: currentUserMembership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (
    !currentUserMembership ||
    !['owner', 'admin'].includes(currentUserMembership.role)
  ) {
    return { error: 'You do not have permission to invite members' }
  }

  // Use service role for member operations
  const { createServiceRoleClient } = await import(
    '@/lib/supabase/service-role'
  )
  const serviceSupabase = createServiceRoleClient()

  // Check if user exists
  const { data: profile } = await serviceSupabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!profile) {
    return { error: 'User not found. They need to sign up first.' }
  }

  // Check if already a member
  const { data: existing } = await serviceSupabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', profile.id)
    .single()

  if (existing) {
    return { error: 'User is already a member of this organization' }
  }

  // Add member
  const { error } = await serviceSupabase.from('organization_members').insert({
    organization_id: orgId,
    user_id: profile.id,
    role,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function removeMember(membershipId: string) {
  const { createServiceRoleClient } = await import(
    '@/lib/supabase/service-role'
  )
  const serviceSupabase = createServiceRoleClient()

  const { error } = await serviceSupabase
    .from('organization_members')
    .delete()
    .eq('id', membershipId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateMemberRole(
  membershipId: string,
  role: 'admin' | 'member' | 'viewer'
) {
  const { createServiceRoleClient } = await import(
    '@/lib/supabase/service-role'
  )
  const serviceSupabase = createServiceRoleClient()

  const { error } = await serviceSupabase
    .from('organization_members')
    .update({ role })
    .eq('id', membershipId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
