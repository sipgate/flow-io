import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { login } from '../actions'
import { SipgateSignInButton } from '@/components/auth/sipgate-sign-in-button'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const params = await searchParams
  const t = await getTranslations('auth.login')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          {t('title')}
        </h1>
        <p className="text-[#888] text-sm">
          {t('description')}
        </p>
      </div>

      {/* Form */}
      <form className="space-y-6">
        {params.error && (
          <div className="p-4 text-sm text-red-400 bg-red-950/30 rounded-xl border border-red-900/50">
            {decodeURIComponent(params.error)}
          </div>
        )}
        {params.message && (
          <div className="p-4 text-sm text-amber-400 bg-amber-950/30 rounded-xl border border-amber-900/50">
            {decodeURIComponent(params.message)}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-[#a0a0a0]">
            {t('email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder={t('emailPlaceholder')}
            required
            autoComplete="email"
            className="w-full px-4 py-3 bg-[#111] border border-[#2a2a2a] rounded-xl text-[#fafafa] placeholder:text-[#555] focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all duration-300"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-[#a0a0a0]">
              {t('password')}
            </label>
            <Link
              href="/forgot-password"
              tabIndex={-1}
              className="text-xs text-[#777] hover:text-amber-400 transition-colors duration-300"
            >
              {t('forgotPassword')}
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="w-full px-4 py-3 bg-[#111] border border-[#2a2a2a] rounded-xl text-[#fafafa] placeholder:text-[#555] focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all duration-300"
          />
        </div>

        <button
          formAction={login}
          className="w-full py-3.5 bg-[#fafafa] text-[#0a0a0a] rounded-xl font-medium hover:bg-amber-400 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          {t('signIn')}
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#2a2a2a]"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-[#0a0a0a] text-[#666]">{t('orContinueWith')}</span>
          </div>
        </div>

        {/* sipgate Sign In */}
        <SipgateSignInButton
          label={t('continueWithSipgate')}
          loadingLabel={t('redirecting')}
        />
      </form>

      {/* Footer */}
      <p className="text-sm text-center text-[#777]">
        {t('noAccount')}{' '}
        <Link
          href="/signup"
          className="text-[#fafafa] hover:text-amber-400 transition-colors duration-300 font-medium"
        >
          {t('signUp')}
        </Link>
      </p>
    </div>
  )
}
