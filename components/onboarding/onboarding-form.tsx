'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createOrganization } from '@/lib/actions/organizations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function OnboardingForm() {
  const t = useTranslations('onboarding')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value))
    }
  }

  const handleSubmit = async (formData: FormData) => {
    setError('')
    setIsLoading(true)

    const result = await createOrganization(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <form action={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t('orgName')}</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder={t('orgNamePlaceholder')}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">{t('orgUrl')}</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">{t('urlPrefix')}</span>
              <Input
                id="slug"
                name="slug"
                type="text"
                placeholder="acme-inc"
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                required
                disabled={isLoading}
                pattern="[a-z0-9-]+"
                title="Only lowercase letters, numbers, and hyphens"
              />
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('orgUrlHint')}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('creating') : t('create')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
