import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getAppUrl } from '@/lib/utils/app-url'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  const origin = getAppUrl()

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      )
    }

    // Ensure user profile exists
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existingProfile) {
        // Create profile using service role
        const serviceSupabase = createServiceRoleClient()
        const { error: profileError } = await serviceSupabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email!,
            full_name: user.user_metadata?.full_name || null,
          })

        if (profileError) {
          console.error('Failed to create user profile:', profileError)
        }

        // Auto-add user to organizations based on email domain
        const { autoAddUserToOrganizationsByDomain } = await import(
          '@/lib/actions/organizations'
        )
        await autoAddUserToOrganizationsByDomain(user.id, user.email!)
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}/dashboard`)
}
