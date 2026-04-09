'use client'

import { useTranslations } from 'next-intl'
import { Phone, Server } from 'lucide-react'
import Link from 'next/link'

interface SystemStatusProps {
  connectedCount: number
  assistantCount: number
  allAssistantsHavePhoneNumber: boolean
  orgSlug: string
}

export function SystemStatus({ connectedCount, assistantCount, allAssistantsHavePhoneNumber, orgSlug }: SystemStatusProps) {
  const t = useTranslations('dashboard.systemStatus')
  const hasAssistants = assistantCount > 0

  const phoneOk = hasAssistants && allAssistantsHavePhoneNumber
  const phoneWarn = hasAssistants && !allAssistantsHavePhoneNumber

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Phone Numbers Badge */}
      <Link href={`/${orgSlug}/phone-numbers`}>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
          ${phoneOk
            ? 'bg-lime-50 border-lime-200 text-lime-700 hover:bg-lime-100 dark:bg-lime-900/20 dark:border-lime-800 dark:text-lime-400 dark:hover:bg-lime-900/30'
            : phoneWarn
            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/30'
            : 'bg-neutral-100 border-neutral-200 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${phoneOk ? 'bg-lime-500' : phoneWarn ? 'bg-amber-500' : 'bg-neutral-400'}`} />
          <Phone className="h-3 w-3" />
          {!hasAssistants
            ? t('noAssistants')
            : t('connected', { count: connectedCount })}
        </span>
      </Link>

      {/* API Status Badge */}
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-lime-50 border-lime-200 text-lime-700 dark:bg-lime-900/20 dark:border-lime-800 dark:text-lime-400">
        <span className="w-1.5 h-1.5 rounded-full bg-lime-500" />
        <Server className="h-3 w-3" />
        {t('operational')}
      </span>
    </div>
  )
}
