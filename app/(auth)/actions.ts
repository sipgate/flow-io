'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  if (host) {
    return `${proto}://${host}`
  }
  return 'http://localhost:3000'
}

type ActionResult = {
  error?: string
  success?: boolean
}

export async function login(formData: FormData): Promise<never> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/login?error=missing_credentials')
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData): Promise<never> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  if (!email || !password) {
    redirect('/signup?error=missing_credentials')
  }

  // Optionally restrict signup to a specific email domain.
  // Set SIGNUP_ALLOWED_EMAIL_DOMAIN=company.com in your environment to enable.
  const allowedDomain = process.env.SIGNUP_ALLOWED_EMAIL_DOMAIN
  if (allowedDomain && !email.toLowerCase().endsWith(`@${allowedDomain}`)) {
    redirect(
      `/signup?error=${encodeURIComponent(`Only @${allowedDomain} email addresses are allowed`)}`
    )
  }

  const baseUrl = await getBaseUrl()

  // Sign up the user
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${baseUrl}/api/auth/callback`,
      data: {
        full_name: fullName,
      },
    },
  })

  if (signUpError) {
    redirect(`/signup?error=${encodeURIComponent(signUpError.message)}`)
  }

  if (!authData.user) {
    redirect('/signup?error=signup_failed')
  }

  // Create user profile using service role to bypass RLS
  const { createServiceRoleClient } = await import(
    '@/lib/supabase/service-role'
  )
  const serviceSupabase = createServiceRoleClient()

  const { error: profileError } = await serviceSupabase
    .from('user_profiles')
    .insert({
      id: authData.user.id,
      email: authData.user.email!,
      full_name: fullName || null,
    })

  if (profileError) {
    console.error('Failed to create user profile:', profileError)
    // This is a critical error - user won't be able to use the app
    redirect(`/signup?error=${encodeURIComponent('Failed to create profile')}`)
  }

  // Auto-add user to organizations based on email domain
  const { autoAddUserToOrganizationsByDomain } = await import(
    '@/lib/actions/organizations'
  )
  await autoAddUserToOrganizationsByDomain(
    authData.user.id,
    authData.user.email!
  )

  revalidatePath('/', 'layout')
  redirect('/signup?success=check_email')
}

export async function resetPassword(formData: FormData): Promise<never> {
  const supabase = await createClient()

  const email = formData.get('email') as string

  if (!email) {
    redirect('/forgot-password?error=missing_email')
  }

  const baseUrl = await getBaseUrl()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/reset-password`,
  })

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/forgot-password?success=check_email')
}

export async function signOut(): Promise<never> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    redirect('/?error=sign_out_failed')
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function signInWithSipgate(): Promise<never> {
  const { SipgateProvider } = await import('@/lib/telephony/providers/sipgate/oauth')
  const baseUrl = await getBaseUrl()

  const state = crypto.randomUUID()
  const redirectUri = `${baseUrl}/api/auth/sipgate/callback`
  const sipgate = new SipgateProvider()
  const authUrl = sipgate.getAuthorizationUrl(state, redirectUri)

  // Store state in a short-lived cookie for CSRF protection
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  cookieStore.set('sipgate_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  redirect(authUrl)
}
