import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getOrganizationAssistants } from '@/lib/actions/assistants'
import { getOrganizationTestSessions } from '@/lib/actions/test-chat'
import { getScenarios } from '@/lib/actions/scenarios'
import { ChatSimulator } from '@/components/test-chat/chat-simulator'

export default async function ChatPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  // Fetch active assistants for dropdown
  const { assistants } = await getOrganizationAssistants(organization.id)
  const activeAssistants =
    (assistants as { id: string; name: string; is_active: boolean }[])?.filter((a) => a.is_active).map((a) => ({
      id: a.id,
      name: a.name,
    })) || []

  // Fetch scenarios for dropdown
  const { scenarios } = await getScenarios(organization.id)
  const scenarioOptions = scenarios.map((s) => ({ id: s.id, name: s.name }))

  // Fetch test sessions for history
  const { sessions } = await getOrganizationTestSessions(organization.id)

  const t = await getTranslations('chatSimulator')

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="border-b px-8 py-6 bg-white dark:bg-neutral-950">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {t('description')}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full">
          <ChatSimulator
            organizationId={organization.id}
            assistants={activeAssistants}
            flows={scenarioOptions}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase joined query type doesn't match the hand-crafted TestSession interface
            initialSessions={(sessions as any) || []}
          />
        </div>
      </div>
    </div>
  )
}
