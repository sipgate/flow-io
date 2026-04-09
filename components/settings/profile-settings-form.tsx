'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { User } from '@supabase/supabase-js'
import { updateProfile } from '@/lib/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ProfileSettingsFormProps {
  user: User
  profile: {
    full_name?: string | null
    email?: string | null
  } | null
}

export function ProfileSettingsForm({
  user,
  profile,
}: ProfileSettingsFormProps) {
  const t = useTranslations('settings.profile')
  const tCommon = useTranslations('common')
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setIsLoading(true)

    const result = await updateProfile({ full_name: fullName })

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: t('profileUpdated') })
    }

    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div
          className={`p-3 text-sm rounded-md border ${
            message.type === 'success'
              ? 'text-lime-700 bg-lime-50 dark:bg-lime-950/20 border-lime-200 dark:border-lime-900'
              : 'text-red-500 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" value={user.email} disabled />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t('emailHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">{t('fullName')}</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={isLoading}
          placeholder={t('fullNamePlaceholder')}
        />
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? tCommon('saving') : tCommon('saveChanges')}
      </Button>
    </form>
  )
}
