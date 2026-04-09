import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { SipgateProvider } from '@/lib/telephony/providers/sipgate/oauth'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const host = forwardedHost ?? url.host
  const proto = forwardedProto ?? url.protocol.replace(':', '')
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  // Validate state (stored in cookie)
  const storedState = request.headers.get('cookie')
    ?.split(';')
    .find(c => c.trim().startsWith('sipgate_oauth_state='))
    ?.split('=')[1]
    ?.trim()

  if (state && storedState && state !== storedState) {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`)
  }

  const redirectUri = `${origin}/api/auth/sipgate/callback`

  try {
    const sipgate = new SipgateProvider()
    const serviceSupabase = createServiceRoleClient()

    // Exchange code for tokens
    const tokens = await sipgate.exchangeCode(code, redirectUri)

    // Get user info from sipgate
    const userInfo = await sipgate.getUserInfo(tokens.accessToken)

    if (!userInfo.email) {
      console.error('sipgate userInfo missing email:', JSON.stringify(userInfo))
      return NextResponse.redirect(`${origin}/login?error=no_email`)
    }

    // Find or create Supabase user
    const { data: { users }, error: listError } = await serviceSupabase.auth.admin.listUsers()
    if (listError) throw listError

    let userId: string
    const existing = users.find(u => u.email?.toLowerCase() === userInfo.email.toLowerCase())

    if (existing) {
      userId = existing.id
      await serviceSupabase
        .from('user_profiles')
        .upsert({ id: userId, email: userInfo.email, full_name: userInfo.name }, { onConflict: 'id' })
    } else {
      const { data: created, error: createError } = await serviceSupabase.auth.admin.createUser({
        email: userInfo.email,
        email_confirm: true,
        user_metadata: { full_name: userInfo.name },
      })
      if (createError || !created.user) throw createError ?? new Error('User creation failed')
      userId = created.user.id

      await serviceSupabase
        .from('user_profiles')
        .insert({ id: userId, email: userInfo.email, full_name: userInfo.name })
    }

    // Find or create organization
    const { data: memberships } = await serviceSupabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .in('role', ['owner', 'admin'])
      .limit(1)

    let organizationId: string

    if (memberships && memberships.length > 0) {
      organizationId = memberships[0].organization_id
    } else {
      const orgName = userInfo.name || userInfo.email.split('@')[0] || 'My Organization'
      const baseSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)

      let slug = baseSlug
      let attempt = 0
      while (true) {
        const { data: existing } = await serviceSupabase
          .from('organizations')
          .select('id')
          .eq('slug', slug)
          .maybeSingle()
        if (!existing) break
        slug = `${baseSlug}-${++attempt}`
      }

      const { data: org, error: orgError } = await serviceSupabase
        .from('organizations')
        .insert({ name: orgName, slug, settings: {}, subscription_tier: 'free' })
        .select('id')
        .single()

      if (orgError || !org) throw orgError ?? new Error('Org creation failed')
      organizationId = org.id

      await serviceSupabase.from('organization_members').insert({
        organization_id: organizationId,
        user_id: userId,
        role: 'owner',
      })
    }

    // Upsert telephony account and sync phone numbers
    const { data: telephonyAccount } = await serviceSupabase
      .from('telephony_accounts')
      .upsert(
        {
          organization_id: organizationId,
          provider: 'sipgate',
          provider_account_id: userInfo.id,
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt.toISOString(),
          account_info: { name: userInfo.name },
          is_active: true,
        },
        { onConflict: 'organization_id,provider' }
      )
      .select('id')
      .single()

    // Generate magic link — session is established client-side via hash tokens
    const { data: linkData, error: linkError } = await serviceSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userInfo.email,
      options: {
        redirectTo: `${origin}/auth/sipgate-complete`,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      throw linkError ?? new Error('Magic link generation failed')
    }

    const response = NextResponse.redirect(linkData.properties.action_link)
    response.cookies.delete('sipgate_oauth_state')
    return response
  } catch (err) {
    console.error('sipgate OAuth callback error:', err)
    const message = err instanceof Error ? err.message : 'OAuth failed'
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`)
  }
}
