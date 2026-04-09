'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Variable, CheckCircle, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import type { ExtractedVariable } from '@/types/variables'

interface ExtractedVariablesDisplayProps {
  variables: ExtractedVariable[]
  onReExtract?: () => void
  isReExtracting?: boolean
  reExtractLabel?: string
}

export function ExtractedVariablesDisplay({
  variables,
  onReExtract,
  isReExtracting,
  reExtractLabel = 'Re-extract',
}: ExtractedVariablesDisplayProps) {
  const t = useTranslations('extractedVariables')
  if (variables.length === 0 && !onReExtract) {
    return null
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'phone':
        return 'bg-lime-500/10 text-lime-700 dark:bg-lime-400/10 dark:text-lime-400'
      case 'date':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'number':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'boolean':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
    }
  }

  const getConfidenceColor = (confidence: number | null) => {
    if (confidence === null) return 'text-neutral-400'
    if (confidence >= 0.9) return 'text-lime-600'
    if (confidence >= 0.7) return 'text-yellow-500'
    return 'text-red-500'
  }

  const formatConfidence = (confidence: number | null) => {
    if (confidence === null) return '-'
    return `${Math.round(confidence * 100)}%`
  }

  const formatValue = (value: string | null, type: string) => {
    if (value === null || value === '') return <span className="text-neutral-400 italic">{t('notFound')}</span>

    if (type === 'boolean') {
      const boolVal = value.toLowerCase()
      if (boolVal === 'true' || boolVal === 'yes') {
        return <CheckCircle className="h-4 w-4 text-lime-600" />
      }
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }

    return value
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Variable className="h-4 w-4 text-neutral-400" />
        <h3 className="font-semibold">{t('title')}</h3>
        {variables.length > 0 && (
          <Badge variant="secondary">
            {t('found', { found: variables.filter(v => v.value).length, total: variables.length })}
          </Badge>
        )}
        {onReExtract && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReExtract}
            disabled={isReExtracting}
            className="ml-auto"
          >
            {isReExtracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1">{reExtractLabel}</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {variables.map((variable) => (
          <div
            key={variable.id}
            className="flex items-start justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50"
          >
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{variable.label}</span>
                <Badge variant="outline" className={`text-xs shrink-0 ${getTypeColor(variable.type)}`}>
                  {variable.type}
                </Badge>
              </div>
              <div className="text-sm truncate">
                {formatValue(variable.value, variable.type)}
              </div>
            </div>
            {variable.confidence !== null && (
              <div className={`text-xs shrink-0 ml-2 ${getConfidenceColor(variable.confidence)}`}>
                {formatConfidence(variable.confidence)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
