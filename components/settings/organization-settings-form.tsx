'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { updateOrganization } from '@/lib/actions/organizations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface OrganizationSettingsFormProps {
  organization: {
    id: string
    name: string
    slug: string
    subscription_tier?: string | null
    domain?: string | null
    auto_add_domain_members?: boolean | null
  }
  canEdit: boolean
}

export function OrganizationSettingsForm({
  organization,
  canEdit,
}: OrganizationSettingsFormProps) {
  const t = useTranslations('settings.organization')
  const tCommon = useTranslations('common')
  const [name, setName] = useState(organization.name)
  const [domain, setDomain] = useState(organization.domain || '')
  const [autoAddDomainMembers, setAutoAddDomainMembers] = useState(
    organization.auto_add_domain_members || false
  )
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setIsLoading(true)

    const result = await updateOrganization(organization.id, {
      name,
      domain: domain || null,
      auto_add_domain_members: autoAddDomainMembers,
    })

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: t('organizationUpdated') })
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
        <Label htmlFor="name">{t('name')}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit || isLoading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">{t('slug')}</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">{t('urlPrefix')}</span>
          <Input id="slug" value={organization.slug} disabled />
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t('slugHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label>{t('subscriptionTier')}</Label>
        <div className="text-sm text-neutral-600 dark:text-neutral-400 capitalize">
          {organization.subscription_tier || 'free'}
        </div>
      </div>

      <div className="border-t pt-4 mt-6">
        <h3 className="text-sm font-medium mb-4">{t('autoAddMembers')}</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">{t('emailDomain')}</Label>
            <Input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={!canEdit || isLoading}
              placeholder={t('domainPlaceholder')}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('domainHint')}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="auto-add"
              checked={autoAddDomainMembers}
              onCheckedChange={(checked) =>
                setAutoAddDomainMembers(checked as boolean)
              }
              disabled={!canEdit || isLoading || !domain}
            />
            <Label
              htmlFor="auto-add"
              className="text-sm font-normal cursor-pointer"
            >
              {t('autoAddCheckbox')}
            </Label>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('autoAddDescription')}
          </p>
        </div>
      </div>

      {canEdit && (
        <Button type="submit" disabled={isLoading}>
          {isLoading ? tCommon('saving') : tCommon('saveChanges')}
        </Button>
      )}

      {!canEdit && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t('noPermission')}
        </p>
      )}
    </form>
  )
}
