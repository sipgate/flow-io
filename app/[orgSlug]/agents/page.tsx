import { redirect } from 'next/navigation'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import {
  getOrganizationAssistantsWithLinks,
  type AssistantWithLinks,
} from '@/lib/actions/assistants'
import { AssistantsList, type AssistantListItem } from '@/components/assistants/assistants-list'

export default async function AssistantsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const org = organization as { id: string; name: string; slug: string }
  const mem = membership as { role: string }

  const { assistants: assistantData } = await getOrganizationAssistantsWithLinks(org.id)
  // Narrow Supabase's `unknown` to the exact shape AssistantsList expects.
  const assistants: AssistantListItem[] = (
    assistantData as unknown as Array<AssistantWithLinks & Record<string, unknown>>
  ).map((a) => ({
    id: a.id,
    name: a.name,
    description: (a.description as string | null) ?? null,
    voice_provider: (a.voice_provider as string | null) ?? null,
    voice_id: (a.voice_id as string | null) ?? null,
    voice_language: (a.voice_language as string | null) ?? null,
    llm_provider: (a.llm_provider as string | null) ?? null,
    llm_model: (a.llm_model as string | null) ?? null,
    is_active: (a.is_active as boolean | null) ?? null,
    avatar_url: (a.avatar_url as string | null) ?? null,
    scenarioLinks: a.scenarioLinks,
  }))
  const canManage = ['owner', 'admin'].includes(mem.role)

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <AssistantsList
          assistants={assistants}
          organizationId={org.id}
          orgSlug={orgSlug}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
