'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

/**
 * Handles the final step of sipgate OAuth login.
 *
 * Supabase magic links use implicit flow and append session tokens as
 * URL hash fragments (#access_token=...&refresh_token=...). Since hashes
 * are not sent to the server, this client component reads them and
 * establishes the Supabase session via setSession().
 */
export default function SipgateCompletePage() {
  const router = useRouter()
  const t = useTranslations('sipgateComplete')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=session_failed')
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        console.error('sipgate setSession failed:', error)
        router.replace('/login?error=session_failed')
      } else {
        router.replace('/dashboard')
      }
    })
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">{t('completing')}</p>
    </div>
  )
}
