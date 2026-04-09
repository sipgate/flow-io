import { redirect } from 'next/navigation'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getOrganizationAssistants } from '@/lib/actions/assistants'
import { AssistantsList } from '@/components/assistants/assistants-list'

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

  const { assistants: assistantData } = await getOrganizationAssistants(org.id)
  // Type assertion for assistants (Supabase types don't properly narrow)
  const assistants = assistantData as unknown as Array<{
    id: string
    name: string
    description: string | null
    voice_provider: string | null
    voice_id: string | null
    voice_language: string | null
    llm_provider: string | null
    llm_model: string | null
    llm_temperature: number | null
    system_prompt: string | null
    opening_message: string | null
    is_active: boolean | null
    phone_number: string | null
    avatar_url: string | null
    created_at: string | null
  }>
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
