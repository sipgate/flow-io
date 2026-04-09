import { redirect } from 'next/navigation'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getScenario } from '@/lib/actions/scenarios'
import { getOrganizationAssistants } from '@/lib/actions/assistants'
import { ScenarioBuilder } from '@/components/scenarios/scenario-builder'
import { getToolModelConfig } from '@/lib/tool-model'

export default async function ScenarioBuilderPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>
}) {
  const { orgSlug, id } = await params
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  const [{ scenario, error: scenarioError }, { assistants }] = await Promise.all([
    getScenario(id),
    getOrganizationAssistants(organization.id),
  ])

  if (scenarioError || !scenario) {
    redirect(`/${orgSlug}/scenarios`)
  }

  const assistantOptions = (assistants as Array<{ id: string; name: string; avatar_url?: string | null; transfer_instruction?: string | null }>).map((a) => ({
    id: a.id,
    name: a.name,
    avatar_url: a.avatar_url ?? null,
    transfer_instruction: a.transfer_instruction ?? null,
  }))

  const toolModel = getToolModelConfig(
    (organization.settings as Record<string, unknown>) ?? {}
  )

  return (
    <div className="h-screen flex flex-col">
      <ScenarioBuilder scenario={scenario} assistants={assistantOptions} orgSlug={orgSlug} toolModel={toolModel} />
    </div>
  )
}
