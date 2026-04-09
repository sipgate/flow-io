import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`

  const supabase = await createClient()

  // Exchange the code Supabase appends to the redirect URL
  const code = url.searchParams.get('code')
  console.log('sipgate complete: full URL:', url.toString())
  console.log('sipgate complete: code param:', code)
  console.log('sipgate complete: all params:', Object.fromEntries(url.searchParams))

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    console.log('sipgate complete: exchange error:', exchangeError)
    if (exchangeError) {
      return NextResponse.redirect(`${origin}/login?error=session_failed`)
    }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('sipgate complete: user:', user?.id, 'error:', userError)

  if (userError || !user) {
    return NextResponse.redirect(`${origin}/login?error=session_failed`)
  }

  const meta = user.user_metadata ?? {}
  const sipgateTokens = meta._sipgate_tokens as {
    access_token: string
    refresh_token: string
    expires_at: string
  } | undefined
  const sipgateAccountId = meta._sipgate_account_id as string | undefined
  const sipgateAccountName = meta._sipgate_account_name as string | undefined

  if (!sipgateTokens || !sipgateAccountId) {
    // No sipgate tokens — user may have logged in via email/password; just redirect
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  const serviceSupabase = createServiceRoleClient()

  // Find or create organization for this user
  const { data: memberships } = await serviceSupabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])
    .order('organization_id', { ascending: true })
    .limit(1)

  let organizationId: string

  if (memberships && memberships.length > 0) {
    organizationId = memberships[0].organization_id
  } else {
    // New user — create an organization from their sipgate account name / email
    const orgName = sipgateAccountName || user.email?.split('@')[0] || 'My Organization'
    const baseSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)

    // Ensure slug is unique
    let slug = baseSlug
    let attempt = 0
    while (true) {
      const { data: existing } = await serviceSupabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!existing) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    const { data: org, error: orgError } = await serviceSupabase
      .from('organizations')
      .insert({ name: orgName, slug, settings: {}, subscription_tier: 'free' })
      .select('id')
      .single()

    if (orgError || !org) {
      console.error('Failed to create organization:', orgError)
      return NextResponse.redirect(`${origin}/dashboard`)
    }

    organizationId = org.id

    await serviceSupabase.from('organization_members').insert({
      organization_id: organizationId,
      user_id: user.id,
      role: 'owner',
    })
  }

  // Upsert telephony_accounts (one sipgate account per org)
  const { data: telephonyAccount, error: taError } = await serviceSupabase
    .from('telephony_accounts')
    .upsert(
      {
        organization_id: organizationId,
        provider: 'sipgate',
        provider_account_id: sipgateAccountId,
        access_token: sipgateTokens.access_token,
        refresh_token: sipgateTokens.refresh_token,
        token_expires_at: sipgateTokens.expires_at,
        account_info: { name: sipgateAccountName },
        is_active: true,
      },
      { onConflict: 'organization_id,provider' }
    )
    .select('id')
    .single()

  if (taError || !telephonyAccount) {
    console.error('Failed to upsert telephony account:', taError)
  }

  // Remove temporary sipgate tokens from user metadata
  await serviceSupabase.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      _sipgate_tokens: null,
      _sipgate_account_id: null,
      _sipgate_account_name: null,
    },
  })

  return NextResponse.redirect(`${origin}/dashboard`)
}
