import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getOrganizationPhoneNumbers } from '@/lib/actions/phone-numbers'
import { getTelephonyAccount } from '@/lib/actions/telephony'
import { WebhookUrlCard } from '@/components/connect/webhook-url-card'
import { PhoneNumbersList } from '@/components/phone-numbers/phone-numbers-list'
import { TelephonySection } from '@/components/settings/telephony-section'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

function OnboardingStep({
  step,
  tooltip,
  isLast = false,
  children,
}: {
  step: number
  tooltip?: string
  isLast?: boolean
  children: React.ReactNode
}) {
  const circle = (
    <div className="w-8 h-8 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center text-sm font-semibold shrink-0 cursor-default">
      {step}
    </div>
  )

  return (
    <div className="flex gap-6">
      {/* Linke Spalte: Schritt-Indikator */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>{circle}</TooltipTrigger>
            <TooltipContent side="right" className="max-w-56 text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        ) : (
          circle
        )}
        {!isLast && (
          <div className="w-px flex-1 mt-2 mb-0 bg-neutral-200 dark:bg-neutral-700 min-h-8" />
        )}
      </div>

      {/* Rechte Spalte: Inhalt */}
      <div className={`flex-1 ${!isLast ? 'pb-8' : ''}`}>
        {children}
      </div>
    </div>
  )
}

export default async function ConnectPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const canManageOrg = ['owner', 'admin'].includes(membership.role)
  const t = await getTranslations('connect')
  const [{ phoneNumbers, error }, telephonyAccount] = await Promise.all([
    getOrganizationPhoneNumbers(organization.id),
    getTelephonyAccount(organization.id),
  ])

  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const wsScheme = host.startsWith('localhost') ? 'ws' : 'wss'
  const webhookUrl = `${wsScheme}://${host}/ws/${organization.id}`

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {t('description')}
          </p>
        </div>

        <TooltipProvider delayDuration={200}>
          {/* Schritt 1: Telephony Account */}
          <OnboardingStep step={1} tooltip={t('step1Tooltip')}>
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{t('telephonyAccount')}</h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  {t('telephonyAccountDescription')}
                </p>
              </div>
              <TelephonySection
                organizationId={organization.id}
                account={telephonyAccount as Parameters<typeof TelephonySection>[0]['account']}
                canEdit={canManageOrg}
              />
            </div>
          </OnboardingStep>

          {/* Schritt 2: Phone Numbers (vorher Schritt 3) */}
          <OnboardingStep step={2} tooltip={t('step2Tooltip')}>
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{t('phoneNumbers')}</h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  {t('phoneNumbersDescription')}
                </p>
              </div>

              {error && (
                <div className="p-4 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-900">
                  {error}
                </div>
              )}

              <PhoneNumbersList
                phoneNumbers={phoneNumbers}
                organizationId={organization.id}
                orgSlug={orgSlug}
                hasTelephonyAccount={!!telephonyAccount}
              />
            </div>
          </OnboardingStep>

          {/* Schritt 3: Webhook URL (vorher Schritt 2) */}
          <OnboardingStep step={3} isLast tooltip={t('step3Tooltip')}>
            <WebhookUrlCard url={webhookUrl} />
          </OnboardingStep>
        </TooltipProvider>
      </div>
    </div>
  )
}
