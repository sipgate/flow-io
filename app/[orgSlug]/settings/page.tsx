import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrganizationSettingsForm } from '@/components/settings/organization-settings-form'
import { MembersManagement } from '@/components/settings/members-management'
import { CriteriaList } from '@/components/calls/call-criteria/criteria-list'
import { PhonemeSetsSection } from '@/components/settings/phoneme-sets-section'
import { ToolModelSettings } from '@/components/settings/tool-model-settings'

export default async function SettingsPage({
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
  const t = await getTranslations('settings')
  const tPage = await getTranslations('settingsPage')

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
            <TabsTrigger value="members">{t('tabs.members')}</TabsTrigger>
            <TabsTrigger value="criteria">{t('tabs.criteria')}</TabsTrigger>
            <TabsTrigger value="phoneme-sets">{tPage('phonemeSets')}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
              <h2 className="text-xl font-semibold mb-4">
                {t('organization.title')}
              </h2>
              <OrganizationSettingsForm
                organization={organization}
                canEdit={canManageOrg}
              />
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
              <h2 className="text-xl font-semibold mb-1">{tPage('toolModel.title')}</h2>
              <p className="text-sm text-neutral-500 mb-4">{tPage('toolModel.description')}</p>
              <ToolModelSettings
                organizationId={organization.id}
                currentSettings={(organization.settings as Record<string, unknown>) ?? {}}
                canEdit={canManageOrg}
              />
            </div>
          </TabsContent>

          <TabsContent value="members" className="space-y-6">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
              <h2 className="text-xl font-semibold mb-4">{t('members.teamMembers')}</h2>
              <MembersManagement
                organizationId={organization.id}
                userRole={membership.role}
              />
            </div>
          </TabsContent>

          <TabsContent value="criteria" className="space-y-6">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
              <CriteriaList
                organizationId={organization.id}
                canEdit={canManageOrg}
              />
            </div>
          </TabsContent>

          <TabsContent value="phoneme-sets" className="space-y-6">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
              <PhonemeSetsSection
                organizationId={organization.id}
                canEdit={canManageOrg}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
