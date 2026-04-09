'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setLocale } from '@/lib/actions/locale'
import { locales, localeNames, type Locale } from '@/i18n/routing'

export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useTranslations('settings.profile')
  const [isPending, startTransition] = useTransition()

  const handleChange = (newLocale: string) => {
    startTransition(() => {
      setLocale(newLocale as Locale)
    })
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{t('language')}</label>
      <Select value={locale} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {locales.map((loc) => (
            <SelectItem key={loc} value={loc}>
              {localeNames[loc]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-neutral-500">{t('languageHint')}</p>
    </div>
  )
}

// Compact version for header/dropdown
export function LanguageSwitcherCompact() {
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()

  const handleChange = (newLocale: string) => {
    startTransition(() => {
      setLocale(newLocale as Locale)
    })
  }

  return (
    <Select value={locale} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-[120px] h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {localeNames[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
