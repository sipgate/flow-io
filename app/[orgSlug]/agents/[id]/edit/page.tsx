import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOrganizationBySlug } from '@/lib/actions/organizations'
import { getAssistant, getAssistantScenarioLinks } from '@/lib/actions/assistants'
import { AssistantForm } from '@/components/assistants/assistant-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowLeft, Phone } from 'lucide-react'

export default async function EditAssistantPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>
}) {
  const { orgSlug, id } = await params
  const { organization, membership } = await getOrganizationBySlug(orgSlug)

  if (!organization || !membership) {
    redirect('/dashboard')
  }

  // Type guard - TypeScript now knows organization and membership are defined
  const org = organization as { id: string; name: string; slug: string }
  const mem = membership as { role: string }

  const canManage = ['owner', 'admin'].includes(mem.role)

  if (!canManage) {
    redirect(`/${orgSlug}/agents`)
  }

  const { assistant } = await getAssistant(id)

  if (!assistant) {
    redirect(`/${orgSlug}/agents`)
  }

  const [t, scenarioLinks] = await Promise.all([
    getTranslations('assistants'),
    getAssistantScenarioLinks(id),
  ])

  // Type assertion for assistant
  const typedAssistant = assistant as unknown as {
    id: string
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
    updated_at: string
    has_undeployed_changes: boolean
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href={`/${orgSlug}/agents`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('backToList')}
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-bold">{t('edit.title')}</h1>
            {scenarioLinks.map((link) => (
              <Link key={link.scenarioId} href={`/${orgSlug}/scenarios/${link.scenarioId}`}>
                <Badge variant="secondary" className="text-sm gap-1.5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700">
                  <Phone className="h-3.5 w-3.5" />
                  <span className="font-mono">{link.phoneNumbers.join(', ') || '—'}</span>
                  <span className="text-muted-foreground font-normal">· {link.scenarioName}</span>
                </Badge>
              </Link>
            ))}
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            {t('edit.description')}
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
          <AssistantForm
            organizationId={org.id}
            orgSlug={orgSlug}
            assistant={typedAssistant}
          />
        </div>
      </div>
    </div>
  )
}
