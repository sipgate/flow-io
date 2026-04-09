import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { signup } from '../actions'
import { SipgateSignInButton } from '@/components/auth/sipgate-sign-in-button'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const params = await searchParams
  const t = await getTranslations('auth.signup')
  const tLogin = await getTranslations('auth.login')

  if (params.success === 'check_email') {
    return (
      <div className="space-y-8">
        {/* Success Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
            {t('checkEmailTitle')}
          </h1>
          <p className="text-[#888] text-sm">
            {t('checkEmailDescription')}
          </p>
        </div>

        {/* Message */}
        <div className="p-6 text-sm text-green-400 bg-green-950/20 rounded-xl border border-green-900/30 text-center">
          {t('checkEmailMessage')}
        </div>

        {/* Back to Login */}
        <Link
          href="/login"
          className="block w-full py-3.5 text-center border border-[#2a2a2a] rounded-xl text-[#999] hover:border-amber-500/50 hover:text-amber-400 transition-all duration-300"
        >
          {t('backToLogin')}
        </Link>
      </div>
    )
  }

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
      <form className="space-y-5">
        {params.error && (
          <div className="p-4 text-sm text-red-400 bg-red-950/30 rounded-xl border border-red-900/50">
            {decodeURIComponent(params.error)}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="fullName" className="block text-sm font-medium text-[#a0a0a0]">
            {t('fullName')}
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            placeholder={t('fullNamePlaceholder')}
            autoComplete="name"
            className="w-full px-4 py-3 bg-[#111] border border-[#2a2a2a] rounded-xl text-[#fafafa] placeholder:text-[#555] focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all duration-300"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-[#a0a0a0]">
            {t('email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@sipgate.de"
            required
            autoComplete="email"
            className="w-full px-4 py-3 bg-[#111] border border-[#2a2a2a] rounded-xl text-[#fafafa] placeholder:text-[#555] focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all duration-300"
          />
          <p className="text-xs text-[#666]">
            {t('emailDomainHint')}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-[#a0a0a0]">
            {t('password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="new-password"
            minLength={8}
            className="w-full px-4 py-3 bg-[#111] border border-[#2a2a2a] rounded-xl text-[#fafafa] placeholder:text-[#555] focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all duration-300"
          />
          <p className="text-xs text-[#666]">
            {t('passwordHint')}
          </p>
        </div>

        <button
          formAction={signup}
          className="w-full py-3.5 bg-[#fafafa] text-[#0a0a0a] rounded-xl font-medium hover:bg-amber-400 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          {t('signUp')}
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#2a2a2a]"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-[#0a0a0a] text-[#666]">{tLogin('orContinueWith')}</span>
          </div>
        </div>

        {/* sipgate Sign Up */}
        <SipgateSignInButton
          label={t('signUpWithSipgate')}
          loadingLabel={tLogin('redirecting')}
        />
      </form>

      {/* Footer */}
      <p className="text-sm text-center text-[#777]">
        {t('hasAccount')}{' '}
        <Link
          href="/login"
          className="text-[#fafafa] hover:text-amber-400 transition-colors duration-300 font-medium"
        >
          {t('signIn')}
        </Link>
      </p>
    </div>
  )
}
