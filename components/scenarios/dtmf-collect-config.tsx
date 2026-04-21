'use client'

import { useTranslations } from 'next-intl'
import { Hash, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ScenarioNode } from '@/types/scenarios'

interface DTMFCollectConfigProps {
  node: ScenarioNode
  onUpdate: (nodeId: string, data: Partial<ScenarioNode['data']>) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
}

export function DTMFCollectConfig({ node, onUpdate, onDelete, onClose }: DTMFCollectConfigProps) {
  const t = useTranslations('scenarios')

  return (
    <div className="w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-sm">{t('node.dtmfCollect')}</span>
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
          placeholder={t('node.dtmfCollect')}
        />
      </div>

      {/* Prompt / Ansage */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.dtmfPrompt')}</Label>
        <Textarea
          className="text-xs resize-none h-20"
          placeholder={t('node.dtmfPromptPlaceholder')}
          value={node.data.prompt ?? ''}
          onChange={(e) => onUpdate(node.id, { prompt: e.target.value })}
        />
      </div>

      {/* Variable Name */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.variableName')}</Label>
        <Input
          className="h-8 text-xs font-mono"
          value={node.data.variable_name ?? ''}
          onChange={(e) => {
            // Only allow alphanumeric and underscores
            const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '')
            onUpdate(node.id, { variable_name: val })
          }}
          placeholder="callerInput"
        />
        {node.data.variable_name && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
            {`{{${node.data.variable_name}}}`}
          </p>
        )}
      </div>

      {/* Max Digits */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.maxDigits')}</Label>
        <Input
          type="number"
          className="h-8 text-xs"
          min={1}
          max={30}
          value={node.data.max_digits ?? 20}
          onChange={(e) => onUpdate(node.id, { max_digits: Math.min(30, Math.max(1, Number(e.target.value))) })}
        />
      </div>

      {/* Terminator */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.terminator')}</Label>
        <Select
          value={node.data.terminator === '' ? 'none' : (node.data.terminator ?? '#')}
          onValueChange={(val) => onUpdate(node.id, { terminator: val === 'none' ? '' : val })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="#" className="text-xs"># (Hash)</SelectItem>
            <SelectItem value="*" className="text-xs">* (Stern)</SelectItem>
            <SelectItem value="none" className="text-xs">{t('node.terminatorNone')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeout */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.timeoutSeconds')}</Label>
        <Input
          type="number"
          className="h-8 text-xs"
          min={1}
          max={60}
          value={node.data.timeout_seconds ?? 5}
          onChange={(e) => onUpdate(node.id, { timeout_seconds: Math.min(60, Math.max(1, Number(e.target.value))) })}
        />
      </div>
    </div>
  )
}
