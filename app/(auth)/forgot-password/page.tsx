import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { resetPassword } from '../actions'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const params = await searchParams
  const t = await getTranslations('auth.forgotPassword')

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
        <div className="w-16 h-16 mx-auto rounded-full bg-[#111] border border-[#2a2a2a] flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          {t('title')}
        </h1>
        <p className="text-[#888] text-sm max-w-sm mx-auto">
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

        <button
          formAction={resetPassword}
          className="w-full py-3.5 bg-[#fafafa] text-[#0a0a0a] rounded-xl font-medium hover:bg-amber-400 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          {t('sendResetLink')}
        </button>
      </form>

      {/* Back to Login */}
      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-[#777] hover:text-amber-400 transition-colors duration-300"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('backToLogin')}
        </Link>
      </div>
    </div>
  )
}
