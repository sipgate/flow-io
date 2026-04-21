'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useTranslations } from 'next-intl'
import { Bot, Phone, Hash, ListTree, Mic, RefreshCw } from 'lucide-react'
import type { ScenarioNode } from '@/types/scenarios'

export const PhoneNumberNodeComponent = memo(function PhoneNumberNodeComponent({
  data,
}: NodeProps) {
  const phoneData = data as { phone_number: string }
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 shadow-sm">
      <Phone className="h-4 w-4 text-neutral-400 flex-shrink-0" />
      <span className="text-xs font-mono text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
        {phoneData.phone_number}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-neutral-400 dark:!bg-neutral-500 !border-2 !border-white dark:!border-neutral-900"
      />
    </div>
  )
})

export const DTMFCollectNodeComponent = memo(function DTMFCollectNodeComponent({
  data,
  selected,
}: NodeProps<ScenarioNode>) {
  const t = useTranslations('scenarios')
  return (
    <div
      className={`
        w-64 rounded-xl border-2 bg-white dark:bg-neutral-900 shadow-sm transition-all
        border-blue-500 dark:border-blue-400
        ${selected ? 'ring-2 ring-offset-1 ring-blue-400' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-neutral-400 dark:!bg-neutral-500 !border-2 !border-white dark:!border-neutral-900"
      />
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-start gap-2">
          <Hash className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 leading-snug line-clamp-2 min-w-0">
            {data.label || t('node.dtmfCollect')}
          </span>
        </div>

        {data.prompt && (
          <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed">
            {data.prompt}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {data.variable_name && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              {`{{${data.variable_name}}}`}
            </span>
          )}
          {data.max_digits && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
              {t('node.maxDigits')}: {data.max_digits}
            </span>
          )}
          {data.timeout_seconds && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
              {data.timeout_seconds}s
            </span>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-neutral-400 dark:!bg-neutral-500 !border-2 !border-white dark:!border-neutral-900"
      />
    </div>
  )
})

export const DTMFMenuNodeComponent = memo(function DTMFMenuNodeComponent({
  data,
  selected,
}: NodeProps<ScenarioNode>) {
  const t = useTranslations('scenarios')
  return (
    <div
      className={`
        w-64 rounded-xl border-2 bg-white dark:bg-neutral-900 shadow-sm transition-all
        border-purple-500 dark:border-purple-400
        ${selected ? 'ring-2 ring-offset-1 ring-purple-400' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-neutral-400 dark:!bg-neutral-500 !border-2 !border-white dark:!border-neutral-900"
      />
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-start gap-2">
          <ListTree className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
          <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 leading-snug line-clamp-2 min-w-0">
            {data.label || t('node.dtmfMenu')}
          </span>
        </div>

        {data.prompt && (
          <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed">
            {data.prompt}
          </p>
        )}

        {(data.max_retries !== undefined && data.max_retries !== null) && (
          <div className="flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3 text-neutral-400" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('node.maxRetries')}: {data.max_retries}
            </span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-neutral-400 dark:!bg-neutral-500 !border-2 !border-white dark:!border-neutral-900"
      />
    </div>
  )
})

export const ScenarioNodeComponent = memo(function ScenarioNodeComponent({
  data,
  selected,
}: NodeProps<ScenarioNode>) {
  const t = useTranslations('scenarios')

  return (
    <div
      className={`
        w-64 rounded-xl border-2 bg-white dark:bg-neutral-900 shadow-sm
        transition-all border-neutral-200 dark:border-neutral-700
        ${selected ? 'ring-2 ring-offset-1 ring-blue-400' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-neutral-400 dark:!bg-neutral-500 !border-2 !border-white dark:!border-neutral-900"
      />

      <div className="px-4 py-3 space-y-2">
        <div className="flex items-start gap-2">
          {data.avatar_url ? (
            <img
              src={data.avatar_url}
              alt={data.label}
              className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5"
            />
          ) : (
            <Bot className="h-4 w-4 text-neutral-400 flex-shrink-0 mt-0.5" />
          )}
          <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 leading-snug line-clamp-2 min-w-0">
            {data.label || t('node.unnamedAgent')}
          </span>
        </div>

        {data.transfer_instruction && (
          <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed">
            {data.transfer_instruction}
          </p>
        )}

        {(data.inherit_voice || data.send_greeting) && (
          <div className="flex flex-wrap gap-1.5">
            {data.inherit_voice && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                <Mic className="h-3 w-3" />
                {t('node.inheritsVoice')}
              </span>
            )}
            {data.send_greeting && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400">
                {t('node.sendGreeting')}
              </span>
            )}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-neutral-400 dark:!bg-neutral-500 !border-2 !border-white dark:!border-neutral-900"
      />
    </div>
  )
})
