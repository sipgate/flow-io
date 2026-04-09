'use client'

import { useTransition } from 'react'
import { User } from '@supabase/supabase-js'
import { useTranslations, useLocale } from 'next-intl'
import { Globe, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/(auth)/actions'
import { useRouter } from 'next/navigation'
import { setLocale } from '@/lib/actions/locale'
import { locales, localeNames, type Locale } from '@/i18n/routing'

interface HeaderProps {
  user: User
  organization: {
    name: string
    slug: string
  }
}

export function DashboardHeader({ user, organization }: HeaderProps) {
  const router = useRouter()
  const t = useTranslations('header')
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase()
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const handleLocaleChange = (newLocale: Locale) => {
    startTransition(() => {
      setLocale(newLocale)
    })
  }

  return (
    <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-neutral-100 to-white dark:from-neutral-950 dark:to-neutral-900 shadow-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          {organization.name}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full"
            >
              <Avatar>
                <AvatarFallback className="bg-neutral-200 dark:bg-neutral-700">
                  {getInitials(user.email || '')}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {organization.name}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push(`/${organization.slug}/settings`)}
            >
              {t('settings')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/${organization.slug}/settings/profile`)}
            >
              {t('profile')}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={isPending}>
                <Globe className="mr-2 h-4 w-4" />
                {t('language')}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {locales.map((loc) => (
                    <DropdownMenuItem
                      key={loc}
                      onClick={() => handleLocaleChange(loc)}
                    >
                      {locale === loc && <Check className="mr-2 h-4 w-4" />}
                      <span className={locale !== loc ? 'ml-6' : ''}>
                        {localeNames[loc]}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              {t('signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
