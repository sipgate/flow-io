'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bot, Star, X, Sparkles, Loader2, Trash2 } from 'lucide-react'
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
import { toast } from 'sonner'
import { generateTransferInstruction } from '@/lib/actions/generate-transfer-instruction'
import type { ScenarioNode, ScenarioNodeType } from '@/types/scenarios'
import { LLMButtonTooltip } from '@/components/ui/llm-button-tooltip'
import type { ToolModelConfig } from '@/lib/tool-model'
import { getModelLabel } from '@/lib/models'

interface AssistantOption {
  id: string
  name: string
  avatar_url: string | null
  transfer_instruction: string | null
}

interface ScenarioNodeConfigProps {
  node: ScenarioNode
  assistants: AssistantOption[]
  hasEntryNode: boolean
  onUpdate: (nodeId: string, data: Partial<ScenarioNode['data']> & { type?: ScenarioNodeType }) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
  toolModel: ToolModelConfig
}

export function ScenarioNodeConfig({
  node,
  assistants,
  hasEntryNode,
  onUpdate,
  onDelete,
  onClose,
  toolModel,
}: ScenarioNodeConfigProps) {
  const t = useTranslations('scenarios')
  const isEntry = node.type === 'entry_agent'
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

  const handleTypeToggle = useCallback(
    (makeEntry: boolean) => {
      const newType: ScenarioNodeType = makeEntry ? 'entry_agent' : 'agent'
      onUpdate(node.id, { type: newType })
    },
    [node.id, onUpdate]
  )

  return (
    <div className="w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEntry ? (
            <Star className="h-4 w-4 text-violet-500" />
          ) : (
            <Bot className="h-4 w-4 text-neutral-400" />
          )}
          <span className="font-semibold text-sm">
            {isEntry ? t('node.entryAgent') : t('node.agentNode')}
          </span>
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

      {/* Node type toggle — only show if either not entry or becoming entry is allowed */}
      {(!hasEntryNode || isEntry) && (
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t('node.entryAgent')}</Label>
          <Switch
            checked={isEntry}
            onCheckedChange={handleTypeToggle}
          />
        </div>
      )}

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

      {/* Transfer instruction — only for non-entry nodes */}
      {!isEntry && (
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
            value={node.data.transfer_instruction}
            onChange={(e) =>
              onUpdate(node.id, { transfer_instruction: e.target.value })
            }
          />
        </div>
      )}

      {/* Inherit voice — only for non-entry nodes */}
      {!isEntry && (
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">{t('node.inheritVoice')}</Label>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('node.inheritVoiceDescription')}
            </p>
          </div>
          <Switch
            checked={node.data.inherit_voice}
            onCheckedChange={(val) => onUpdate(node.id, { inherit_voice: val, ...(val ? { send_greeting: false } : {}) })}
          />
        </div>
      )}

      {/* Send greeting — only for non-entry nodes */}
      {!isEntry && (
        <div className={`flex items-center justify-between ${node.data.inherit_voice ? 'opacity-40' : ''}`}>
          <div>
            <Label className="text-xs">{t('node.sendGreeting')}</Label>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('node.sendGreetingDescription')}
            </p>
          </div>
          <Switch
            checked={node.data.inherit_voice ? false : node.data.send_greeting}
            onCheckedChange={(val) => onUpdate(node.id, { send_greeting: val })}
            disabled={node.data.inherit_voice}
          />
        </div>
      )}
    </div>
  )
}
