'use client'

import { useTranslations } from 'next-intl'
import { Target, CheckCircle, XCircle, HelpCircle, TrendingDown } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface CriteriaOverviewCardProps {
  overview: {
    totalEvaluations: number
    passed: number
    failed: number
    inconclusive: number
    passRate: number
  }
  topFailingCriteria: Array<{
    criterion_id: string
    criterion_name: string
    failCount: number
    totalCount: number
    failRate: number
  }>
}

export function CriteriaOverviewCard({ overview, topFailingCriteria }: CriteriaOverviewCardProps) {
  const t = useTranslations('dashboard.criteriaOverview')

  if (overview.totalEvaluations === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('noEvaluations')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pass Rate */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">{t('passRate')}</span>
          <span className={`text-2xl font-bold ${
            overview.passRate >= 80 ? 'text-green-500' :
            overview.passRate >= 50 ? 'text-amber-500' :
            'text-red-500'
          }`}>
            {overview.passRate}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden flex">
          {overview.passed > 0 && (
            <div
              className="h-full bg-lime-500"
              style={{ width: `${(overview.passed / overview.totalEvaluations) * 100}%` }}
            />
          )}
          {overview.inconclusive > 0 && (
            <div
              className="h-full bg-neutral-400"
              style={{ width: `${(overview.inconclusive / overview.totalEvaluations) * 100}%` }}
            />
          )}
          {overview.failed > 0 && (
            <div
              className="h-full bg-red-500"
              style={{ width: `${(overview.failed / overview.totalEvaluations) * 100}%` }}
            />
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-lime-50 dark:bg-lime-950/20">
            <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle className="h-3 w-3" />
              <span className="text-sm font-medium">{overview.passed}</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('passed')}</p>
          </div>
          <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
            <div className="flex items-center justify-center gap-1 text-neutral-500">
              <HelpCircle className="h-3 w-3" />
              <span className="text-sm font-medium">{overview.inconclusive}</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('inconclusive')}</p>
          </div>
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <XCircle className="h-3 w-3" />
              <span className="text-sm font-medium">{overview.failed}</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('failed')}</p>
          </div>
        </div>

        {/* Top Failing Criteria */}
        {topFailingCriteria.length > 0 && (
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-1 mb-2">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                {t('topFailing')}
              </span>
            </div>
            <div className="space-y-1">
              {topFailingCriteria.slice(0, 3).map((criterion) => (
                <div
                  key={criterion.criterion_id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-neutral-600 dark:text-neutral-400 truncate flex-1">
                    {criterion.criterion_name}
                  </span>
                  <span className="text-red-500 font-medium shrink-0">
                    {criterion.failRate}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
