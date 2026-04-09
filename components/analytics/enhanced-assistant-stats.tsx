'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Star, Target, Variable, Clock } from 'lucide-react'
import type { EnhancedAssistantStats } from '@/lib/actions/analytics'

interface EnhancedAssistantStatsTableProps {
  data: EnhancedAssistantStats[]
  onAssistantClick?: (assistantId: string) => void
}

export function EnhancedAssistantStatsTable({
  data,
  onAssistantClick,
}: EnhancedAssistantStatsTableProps) {
  const t = useTranslations('analytics.assistantStats')

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const getCsatColor = (score: number | null) => {
    if (score === null) return 'text-neutral-400'
    if (score >= 4) return 'text-lime-600'
    if (score >= 3) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getCriteriaColor = (rate: number | null) => {
    if (rate === null) return 'text-neutral-400'
    if (rate >= 80) return 'text-lime-600'
    if (rate >= 60) return 'text-yellow-500'
    return 'text-red-500'
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500 text-center py-4">{t('noData')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-medium">{t('assistant')}</th>
                <th className="text-center py-3 px-2 font-medium">{t('calls')}</th>
                <th className="text-center py-3 px-2 font-medium">{t('completion')}</th>
                <th className="text-center py-3 px-2 font-medium">{t('avgDuration')}</th>
                <th className="text-center py-3 px-2 font-medium">{t('csat')}</th>
                <th className="text-center py-3 px-2 font-medium">{t('criteria')}</th>
                <th className="text-center py-3 px-2 font-medium">{t('variables')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((assistant) => (
                <tr
                  key={assistant.id}
                  onClick={() => onAssistantClick?.(assistant.id)}
                  className="border-b hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer"
                >
                  <td className="py-3 px-2">
                    <div>
                      <p className="font-medium">{assistant.name}</p>
                      <p className="text-xs text-neutral-500">
                        {formatTotalDuration(assistant.totalDuration)} {t('totalTime')}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-bold text-lg">{assistant.totalCalls}</span>
                      <div className="flex gap-1 text-xs">
                        <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800 text-xs">
                          {assistant.completedCalls}
                        </Badge>
                        {assistant.failedCalls > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {assistant.failedCalls}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-medium">{assistant.completionRate}%</span>
                      <Progress value={assistant.completionRate} className="h-1.5 w-16" />
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3 text-neutral-400" />
                      <span className="font-mono text-xs">{formatDuration(assistant.avgDuration)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {assistant.avgCsat !== null ? (
                      <div className="flex items-center justify-center gap-1">
                        <Star className={`h-4 w-4 ${getCsatColor(assistant.avgCsat)}`} />
                        <span className={`font-medium ${getCsatColor(assistant.avgCsat)}`}>
                          {assistant.avgCsat}
                        </span>
                        <span className="text-xs text-neutral-400">({assistant.csatCount})</span>
                      </div>
                    ) : (
                      <span className="text-neutral-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {assistant.criteriaPassRate !== null ? (
                      <div className="flex items-center justify-center gap-1">
                        <Target className={`h-4 w-4 ${getCriteriaColor(assistant.criteriaPassRate)}`} />
                        <span className={`font-medium ${getCriteriaColor(assistant.criteriaPassRate)}`}>
                          {assistant.criteriaPassRate}%
                        </span>
                        <span className="text-xs text-neutral-400">({assistant.criteriaCount})</span>
                      </div>
                    ) : (
                      <span className="text-neutral-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Variable className="h-3 w-3 text-neutral-400" />
                      <span>{assistant.variablesExtracted}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
