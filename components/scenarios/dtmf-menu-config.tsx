'use client'

import { useTranslations } from 'next-intl'
import { ListTree, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ScenarioNode, ScenarioEdge } from '@/types/scenarios'

interface DTMFMenuConfigProps {
  node: ScenarioNode
  /** All edges in the scenario — used to display connected routes */
  edges: ScenarioEdge[]
  /** All nodes — used to resolve target node labels */
  nodes: ScenarioNode[]
  onUpdate: (nodeId: string, data: Partial<ScenarioNode['data']>) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
}

export function DTMFMenuConfig({ node, edges, nodes, onUpdate, onDelete, onClose }: DTMFMenuConfigProps) {
  const t = useTranslations('scenarios')

  const outboundEdges = edges.filter((e) => e.source === node.id)

  return (
    <div className="w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTree className="h-4 w-4 text-purple-500" />
          <span className="font-semibold text-sm">{t('node.dtmfMenu')}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => { onDelete(node.id); onClose() }}
            title={t('node.deleteNode')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.label')}</Label>
        <Input
          className="h-8 text-xs"
          value={node.data.label}
          onChange={(e) => onUpdate(node.id, { label: e.target.value })}
          placeholder={t('node.dtmfMenu')}
        />
      </div>

      {/* Prompt / Ansage */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.dtmfPrompt')}</Label>
        <Textarea
          className="text-xs resize-none h-20"
          placeholder={t('node.dtmfMenuPromptPlaceholder')}
          value={node.data.prompt ?? ''}
          onChange={(e) => onUpdate(node.id, { prompt: e.target.value })}
        />
      </div>

      {/* Error prompt */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.errorPrompt')}</Label>
        <Textarea
          className="text-xs resize-none h-16"
          placeholder={t('node.errorPromptPlaceholder')}
          value={node.data.error_prompt ?? ''}
          onChange={(e) => onUpdate(node.id, { error_prompt: e.target.value })}
        />
      </div>

      {/* Max retries */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.maxRetries')}</Label>
        <Input
          type="number"
          className="h-8 text-xs"
          min={0}
          max={5}
          value={node.data.max_retries ?? 2}
          onChange={(e) => onUpdate(node.id, { max_retries: Math.min(5, Math.max(0, Number(e.target.value))) })}
        />
      </div>

      {/* Timeout */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.timeoutSeconds')}</Label>
        <Input
          type="number"
          className="h-8 text-xs"
          min={1}
          max={60}
          value={node.data.timeout_seconds ?? 10}
          onChange={(e) => onUpdate(node.id, { timeout_seconds: Math.min(60, Math.max(1, Number(e.target.value))) })}
        />
      </div>

      {/* Connected routes (readonly) */}
      {outboundEdges.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t('node.routes')}</Label>
          <div className="space-y-1">
            {outboundEdges.map((edge) => {
              const targetNode = nodes.find((n) => n.id === edge.target)
              return (
                <div
                  key={edge.id}
                  className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-neutral-50 dark:bg-neutral-800"
                >
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400 w-4 text-center">
                    {edge.label ?? '?'}
                  </span>
                  <span className="text-neutral-600 dark:text-neutral-300 truncate">
                    {targetNode?.data.label ?? edge.target}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {t('node.routesHint')}
          </p>
        </div>
      )}

      {outboundEdges.length === 0 && (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          {t('node.noRoutesYet')}
        </p>
      )}
    </div>
  )
}
