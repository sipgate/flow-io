'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { deleteAssistant } from '@/lib/actions/assistants'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPhoneNumber } from '@/lib/utils/format-phone'
import { toast } from 'sonner'

interface Assistant {
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
}

interface AssistantsListProps {
  assistants: Assistant[]
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
          <Link href={`/${orgSlug}/assistants/new`}>
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
              <Link href={`/${orgSlug}/assistants/new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('createNew')}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assistants.map((assistant) => (
            <Card
              key={assistant.id}
              className="cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors duration-[120ms]"
              onClick={() => router.push(`/${orgSlug}/assistants/${assistant.id}/edit`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {assistant.avatar_url ? (
                      <img
                        src={assistant.avatar_url}
                        alt={assistant.name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="h-5 w-5 text-neutral-400" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{assistant.name}</CardTitle>
                      {assistant.description && (
                        <CardDescription className="mt-1">
                          {assistant.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge variant={assistant.is_active ? 'default' : 'secondary'}>
                    {assistant.is_active ? t('status.active') : t('status.inactive')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-500 dark:text-neutral-400 w-16 shrink-0">{t('card.voice')}</span>
                    <span className="font-medium capitalize">
                      {assistant.voice_provider || t('card.notSet')} •{' '}
                      {assistant.voice_id || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-500 dark:text-neutral-400 w-16 shrink-0">{t('card.llm')}</span>
                    <span className="font-medium capitalize">
                      {assistant.llm_provider || t('card.notSet')} •{' '}
                      {assistant.llm_model || 'N/A'}
                    </span>
                  </div>
                  {assistant.phone_number && (
                    <div className="flex items-center gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                      <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 w-16 shrink-0">
                        <Phone className="h-3 w-3" />
                        {t('card.phone')}
                      </span>
                      <span className="font-mono text-sm font-medium">
                        {formatPhoneNumber(assistant.phone_number)}
                      </span>
                    </div>
                  )}
                </div>
                {canManage && (
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={`/${orgSlug}/assistants/${assistant.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        {tCommon('edit')}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(assistant.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                      {tCommon('delete')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
