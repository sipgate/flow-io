'use client'

import { useTranslations } from 'next-intl'
import { Bot, Clock, Variable } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { AssistantStats } from '@/lib/actions/analytics'

interface AssistantStatsTableProps {
  data: AssistantStats[]
}

export function AssistantStatsTable({ data }: AssistantStatsTableProps) {
  const t = useTranslations('analytics')

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs}s`
    return `${mins}m ${secs}s`
  }

  const maxCalls = Math.max(...data.map((d) => d.totalCalls), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{t('performanceByAssistant')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="py-8 text-center text-neutral-500">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t('noAssistants')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((assistant) => (
              <div key={assistant.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-indigo-500" />
                    <span className="font-medium">{assistant.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-neutral-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatDuration(assistant.avgDuration)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Variable className="h-3.5 w-3.5" />
                      <span>{assistant.variablesExtracted}</span>
                    </div>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {assistant.totalCalls} {t('calls')}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${(assistant.totalCalls / maxCalls) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
