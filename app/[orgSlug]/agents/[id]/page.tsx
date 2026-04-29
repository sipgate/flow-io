import { redirect } from 'next/navigation'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getAssistant, getAssistantOverview } from '@/lib/actions/assistants'
import { AssistantOverviewView } from '@/components/assistants/assistant-overview'

export default async function AssistantOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>
}) {
  const { orgSlug, id } = await params
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const org = organization as { id: string; name: string; slug: string }
  const mem = membership as { role: string }

  const [{ assistant }, overview] = await Promise.all([
    getAssistant(id),
    getAssistantOverview(id),
  ])

  if (!assistant) {
    redirect(`/${orgSlug}/agents`)
  }

  const typedAssistant = assistant as unknown as {
    id: string
    organization_id: string
    name: string
    description: string | null
    voice_provider: string | null
    voice_id: string | null
    voice_language: string | null
    llm_provider: string | null
    llm_model: string | null
    llm_temperature: number | null
    thinking_level: string | null
    system_prompt: string | null
    opening_message: string | null
    is_active: boolean | null
    avatar_url: string | null
    enable_hesitation: boolean | null
    enable_semantic_eot: boolean | null
    stt_provider: string | null
    stt_languages: string[] | null
    deployed_at: string | null
    has_undeployed_changes: boolean | null
  }

  if (typedAssistant.organization_id !== org.id) {
    redirect(`/${orgSlug}/agents`)
  }

  const canManage = ['owner', 'admin'].includes(mem.role)

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <AssistantOverviewView
          assistant={typedAssistant}
          overview={overview}
          organizationId={org.id}
          orgSlug={orgSlug}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
