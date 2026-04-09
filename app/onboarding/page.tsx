import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getUserOrganizations } from '@/lib/actions/organizations'
import { OnboardingForm } from '@/components/onboarding/onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user already has organizations
  const { organizations } = await getUserOrganizations()
  if (organizations.length > 0) {
    redirect(`/${organizations[0].slug}/dashboard`)
  }

  const t = await getTranslations('onboarding')

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('welcome')}</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            {t('welcomeDescription')}
          </p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  )
}
