'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Bot, Edit, Phone, Plus, Trash2 } from 'lucide-react'
import { deleteAssistant, type AssistantScenarioLink } from '@/lib/actions/assistants'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PhoneNumber } from '@/components/ui/phone-number'
import { VoiceLabel } from '@/components/ui/voice-label'
import { ALL_MODELS } from '@/lib/models'
import { toast } from 'sonner'

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google',
  mistral: 'Mistral',
}

function findModelLabel(model: string | null): string | null {
  if (!model) return null
  return ALL_MODELS.find((m) => m.model === model)?.label ?? model
}

export interface AssistantListItem {
  id: string
  name: string
  description: string | null
  voice_provider: string | null
  voice_id: string | null
  voice_language: string | null
  llm_provider: string | null
  llm_model: string | null
  is_active: boolean | null
  avatar_url: string | null
  scenarioLinks: AssistantScenarioLink[]
}

interface AssistantsListProps {
  assistants: AssistantListItem[]
  organizationId: string
  orgSlug: string
  canManage: boolean
}

export function AssistantsList({
  assistants,
  organizationId: _organizationId,
  orgSlug,
  canManage,
}: AssistantsListProps) {
  const router = useRouter()
  const t = useTranslations('assistants')
  const tCommon = useTranslations('common')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const result = await deleteAssistant(deleteTarget)
    setDeleteTarget(null)
    if (result.error) {
      toast.error(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('delete.title')}</DialogTitle>
            <DialogDescription>{t('delete.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>
              {tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{t('title')}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {t('description')}
          </p>
        </div>
        {canManage && (
          <Link href={`/${orgSlug}/agents/new`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('createNew')}
            </Button>
          </Link>
        )}
      </div>

      {assistants.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Bot className="h-14 w-14 mx-auto text-neutral-400 mb-3" />
            <h3 className="font-medium mb-1">{t('empty.title')}</h3>
            <p className="text-sm text-neutral-500 mb-4">{t('empty.description')}</p>
            {canManage && (
              <Link href={`/${orgSlug}/agents/new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('createNew')}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assistants.map((assistant) => (
            <AssistantCard
              key={assistant.id}
              assistant={assistant}
              orgSlug={orgSlug}
              canManage={canManage}
              onDelete={() => setDeleteTarget(assistant.id)}
              onClick={() => router.push(`/${orgSlug}/agents/${assistant.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AssistantCard({
  assistant,
  orgSlug,
  canManage,
  onDelete,
  onClick,
}: {
  assistant: AssistantListItem
  orgSlug: string
  canManage: boolean
  onDelete: () => void
  onClick: () => void
}) {
  const t = useTranslations('assistants')
  const tCommon = useTranslations('common')

  const llmProvider = assistant.llm_provider
    ? PROVIDER_LABELS[assistant.llm_provider] ?? assistant.llm_provider
    : null
  const modelLabel = findModelLabel(assistant.llm_model)

  return (
    <Card
      className="group cursor-pointer transition-colors duration-[120ms] hover:border-neutral-300 dark:hover:border-neutral-700"
      onClick={onClick}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {assistant.avatar_url ? (
              <img
                src={assistant.avatar_url}
                alt={assistant.name}
                className="h-12 w-12 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-800 flex-shrink-0"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700 flex-shrink-0">
                <Bot className="h-6 w-6 text-neutral-400" />
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-semibold leading-tight truncate">
                {assistant.name}
              </h3>
              {assistant.description && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                  {assistant.description}
                </p>
              )}
            </div>
          </div>
          <Badge variant={assistant.is_active ? 'default' : 'secondary'} className="flex-shrink-0">
            {assistant.is_active ? t('status.active') : t('status.inactive')}
          </Badge>
        </div>

        {assistant.scenarioLinks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {assistant.scenarioLinks.map((link) => (
              <Link
                key={link.scenarioId}
                href={`/${orgSlug}/scenarios/${link.scenarioId}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Badge
                  variant="secondary"
                  className="gap-1.5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {link.phoneNumbers.length > 0 ? (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {link.phoneNumbers.map((number, idx) => (
                        <span key={number}>
                          <PhoneNumber value={number} />
                          {idx < link.phoneNumbers.length - 1 && ', '}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="font-mono">—</span>
                  )}
                  <span className="text-muted-foreground font-normal">
                    · {link.scenarioName}
                  </span>
                </Badge>
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm border-t border-neutral-100 dark:border-neutral-800 pt-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t('card.voice')}
            </p>
            {assistant.voice_id ? (
              <VoiceLabel
                provider={assistant.voice_provider}
                voiceId={assistant.voice_id}
                language={assistant.voice_language}
                variant="stacked"
                showFlag
                className="mt-0.5 block"
              />
            ) : (
              <p className="mt-0.5 text-sm text-neutral-500">{t('card.notSet')}</p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t('card.llm')}
            </p>
            {modelLabel ? (
              <>
                <p className="mt-0.5 text-sm font-medium truncate">{modelLabel}</p>
                {llmProvider && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {llmProvider}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-0.5 text-sm text-neutral-500">{t('card.notSet')}</p>
            )}
          </div>
        </div>

        {canManage && (
          <div
            className="flex items-center gap-2 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Link href={`/${orgSlug}/agents/${assistant.id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                {tCommon('edit')}
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              aria-label={tCommon('delete')}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
