'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bot, X, Sparkles, Loader2, Trash2, PhoneForwarded } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { generateTransferInstruction } from '@/lib/actions/generate-transfer-instruction'
import type { ScenarioNode, ScenarioEdge } from '@/types/scenarios'
import { LLMButtonTooltip } from '@/components/ui/llm-button-tooltip'
import type { ToolModelConfig } from '@/lib/tool-model'
import { getModelLabel } from '@/lib/models'
import { DTMFCollectConfig } from './dtmf-collect-config'
import { DTMFMenuConfig } from './dtmf-menu-config'

interface AssistantOption {
  id: string
  name: string
  avatar_url: string | null
  transfer_instruction: string | null
}

interface ScenarioNodeConfigProps {
  node: ScenarioNode
  assistants: AssistantOption[]
  /** All scenario edges — passed to dtmf_menu config to display routes */
  edges: ScenarioEdge[]
  /** All scenario nodes — passed to dtmf_menu config to resolve target labels */
  nodes: ScenarioNode[]
  onUpdate: (nodeId: string, data: Partial<ScenarioNode['data']>) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
  toolModel: ToolModelConfig
}

export function ScenarioNodeConfig({
  node,
  assistants,
  edges,
  nodes,
  onUpdate,
  onDelete,
  onClose,
  toolModel,
}: ScenarioNodeConfigProps) {
  const t = useTranslations('scenarios')
  const [generating, setGenerating] = useState(false)

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- existing manual memoization that the React Compiler cannot preserve
  const handleGenerate = useCallback(async () => {
    if (!node.data.assistant_id) {
      toast.error(t('node.selectAssistantFirst'))
      return
    }
    setGenerating(true)
    const { instruction, error } = await generateTransferInstruction(node.data.assistant_id)
    setGenerating(false)
    if (error || !instruction) {
      toast.error(error || t('node.generateError'))
      return
    }
    onUpdate(node.id, { transfer_instruction: instruction })
  }, [node.id, node.data.assistant_id, onUpdate])

  // Delegate DTMF node configs to their own components (after all hooks)
  if (node.type === 'dtmf_collect') {
    return <DTMFCollectConfig node={node} onUpdate={onUpdate} onDelete={onDelete} onClose={onClose} />
  }
  if (node.type === 'dtmf_menu') {
    return <DTMFMenuConfig node={node} edges={edges} nodes={nodes} onUpdate={onUpdate} onDelete={onDelete} onClose={onClose} />
  }
  if (node.type === 'phone_transfer') {
    return <PhoneTransferConfig node={node} onUpdate={onUpdate} onDelete={onDelete} onClose={onClose} />
  }

  return (
    <div className="w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-neutral-400" />
          <span className="font-semibold text-sm">{t('node.agentNode')}</span>
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

      {/* Assistant selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.assistant')}</Label>
        <Select
          value={node.data.assistant_id || ''}
          onValueChange={(val) => {
            const assistant = assistants.find((a) => a.id === val)
            onUpdate(node.id, {
              assistant_id: val,
              label: assistant?.name || node.data.label,
              avatar_url: assistant?.avatar_url ?? null,
              // Pre-fill saved transfer instruction if node has none yet
              transfer_instruction: node.data.transfer_instruction || assistant?.transfer_instruction || '',
            })
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={t('node.selectAssistant')} />
          </SelectTrigger>
          <SelectContent>
            {assistants.map((a) => (
              <SelectItem key={a.id} value={a.id} className="text-xs">
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transfer instruction */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t('node.transferInstruction')}</Label>
          <LLMButtonTooltip model={getModelLabel(toolModel.tool_provider, toolModel.tool_model)} side="left">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={handleGenerate}
              disabled={generating || !node.data.assistant_id}
            >
              {generating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {t('node.generate')}
            </Button>
          </LLMButtonTooltip>
        </div>
        <Textarea
          className="text-xs resize-none h-20"
          placeholder={t('node.transferInstructionPlaceholder')}
          value={node.data.transfer_instruction ?? ''}
          onChange={(e) =>
            onUpdate(node.id, { transfer_instruction: e.target.value })
          }
        />
      </div>

      {/* Inherit voice */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs">{t('node.inheritVoice')}</Label>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('node.inheritVoiceDescription')}
          </p>
        </div>
        <Switch
          checked={node.data.inherit_voice ?? false}
          onCheckedChange={(val) => onUpdate(node.id, { inherit_voice: val, ...(val ? { send_greeting: false } : {}) })}
        />
      </div>

      {/* Send greeting */}
      <div className={`flex items-center justify-between ${node.data.inherit_voice ? 'opacity-40' : ''}`}>
        <div>
          <Label className="text-xs">{t('node.sendGreeting')}</Label>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('node.sendGreetingDescription')}
          </p>
        </div>
        <Switch
          checked={node.data.inherit_voice ? false : (node.data.send_greeting ?? false)}
          onCheckedChange={(val) => onUpdate(node.id, { send_greeting: val })}
          disabled={node.data.inherit_voice ?? false}
        />
      </div>
    </div>
  )
}

interface PhoneTransferConfigProps {
  node: ScenarioNode
  onUpdate: (nodeId: string, data: Partial<ScenarioNode['data']>) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
}

function PhoneTransferConfig({ node, onUpdate, onDelete, onClose }: PhoneTransferConfigProps) {
  const t = useTranslations('scenarios')

  return (
    <div className="w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PhoneForwarded className="h-4 w-4 text-emerald-500" />
          <span className="font-semibold text-sm">{t('node.phoneTransfer')}</span>
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
        />
      </div>

      {/* Target phone number */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.targetPhoneNumber')}</Label>
        <Input
          className="h-8 text-xs font-mono"
          placeholder="+4940123456"
          value={node.data.target_phone_number ?? ''}
          onChange={(e) => onUpdate(node.id, { target_phone_number: e.target.value })}
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('node.targetPhoneNumberHint')}</p>
      </div>

      {/* Caller ID name */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.callerIdName')}</Label>
        <Input
          className="h-8 text-xs"
          placeholder={t('node.callerIdNamePlaceholder')}
          value={node.data.caller_id_name ?? ''}
          onChange={(e) => onUpdate(node.id, { caller_id_name: e.target.value })}
        />
      </div>

      {/* Caller ID number */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.callerIdNumber')}</Label>
        <Input
          className="h-8 text-xs font-mono"
          placeholder="+4940573098995"
          value={node.data.caller_id_number ?? ''}
          onChange={(e) => onUpdate(node.id, { caller_id_number: e.target.value })}
        />
      </div>

      {/* Transfer instruction */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('node.transferInstruction')}</Label>
        <Textarea
          className="text-xs resize-none h-20"
          placeholder={t('node.phoneTransferInstructionPlaceholder')}
          value={node.data.transfer_instruction ?? ''}
          onChange={(e) => onUpdate(node.id, { transfer_instruction: e.target.value })}
        />
      </div>
    </div>
  )
}
