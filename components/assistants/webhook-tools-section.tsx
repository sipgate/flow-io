'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Webhook, Plus, X } from 'lucide-react'
import {
  assignWebhookToolToAssistant,
  unassignWebhookToolFromAssistant,
} from '@/lib/actions/webhook-tools'
import type { WebhookTool } from '@/types/webhook-tools'

interface WebhookToolsSectionProps {
  assistantId: string
  assignedTools: WebhookTool[]
  availableTools: WebhookTool[]
  orgSlug: string
}

export function WebhookToolsSection({
  assistantId,
  assignedTools: initialAssigned,
  availableTools: initialAvailable,
  orgSlug,
}: WebhookToolsSectionProps) {
  const t = useTranslations('assistants.form')
  const [assigned, setAssigned] = useState(initialAssigned)
  const [available, setAvailable] = useState(initialAvailable)
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAssign() {
    if (!selected) return
    setLoading(true)
    await assignWebhookToolToAssistant(assistantId, selected)
    const tool = available.find(t => t.id === selected)!
    setAssigned(prev => [...prev, tool])
    setAvailable(prev => prev.filter(t => t.id !== selected))
    setSelected('')
    setLoading(false)
  }

  async function handleUnassign(toolId: string) {
    setLoading(true)
    await unassignWebhookToolFromAssistant(assistantId, toolId)
    const tool = assigned.find(t => t.id === toolId)!
    setAvailable(prev => [...prev, tool].sort((a, b) => a.name.localeCompare(b.name)))
    setAssigned(prev => prev.filter(t => t.id !== toolId))
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      {assigned.length > 0 && (
        <div className="space-y-2">
          {assigned.map(tool => (
            <div
              key={tool.id}
              className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50"
            >
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-neutral-400 shrink-0" />
                <div>
                  <p className="font-mono font-medium text-sm">{tool.name}</p>
                  {tool.description && (
                    <p className="text-xs text-neutral-500">{tool.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{tool.method}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnassign(tool.id)}
                  disabled={loading}
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex gap-2">
          <Select value={selected} onValueChange={setSelected} disabled={loading}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t('selectWebhookTool')} />
            </SelectTrigger>
            <SelectContent>
              {available.map(tool => (
                <SelectItem key={tool.id} value={tool.id}>
                  <span className="font-mono">{tool.name}</span>
                  {tool.description && (
                    <span className="text-neutral-500 ml-2 text-xs">— {tool.description}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={handleAssign}
            disabled={!selected || loading}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('add')}
          </Button>
        </div>
      )}

      {assigned.length === 0 && available.length === 0 && (
        <div className="text-center py-8 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700">
          <Webhook className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
          <p className="text-sm text-neutral-500">{t('noWebhookTools')}</p>
          <p className="text-xs text-neutral-400 mt-1">
            <a href={`/${orgSlug}/knowledge?tab=webhooks`} className="underline hover:text-neutral-600">
              {t('createWebhookToolFirst')}
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
