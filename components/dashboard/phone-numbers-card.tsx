'use client'

import { useTranslations } from 'next-intl'
import { Phone, GitBranch, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPhoneNumber } from '@/lib/utils/format-phone'

interface PhoneNumberEntry {
  id: string
  phone_number: string
  scenario_id: string | null
  call_scenarios: { id: string; name: string } | null
}

interface PhoneNumbersCardProps {
  phoneNumbers: PhoneNumberEntry[]
  orgSlug: string
}

export function PhoneNumbersCard({ phoneNumbers, orgSlug }: PhoneNumbersCardProps) {
  const t = useTranslations('dashboard.phoneNumbers')

  const assigned = phoneNumbers.filter((pn) => pn.scenario_id)

  if (assigned.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {assigned.map((pn) => {
            const name = pn.call_scenarios?.name ?? ''

            return (
              <div
                key={pn.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                  {formatPhoneNumber(pn.phone_number)}
                </span>
                <Badge variant="secondary" className="flex items-center gap-1.5 font-normal">
                  <GitBranch className="h-3 w-3" />
                  {name}
                </Badge>
              </div>
            )
          })}
        </div>
        <div className="flex justify-end mt-3">
          <Link href={`/${orgSlug}/connect`}>
            <Button variant="ghost" size="sm" className="text-xs">
              {t('manage')}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
