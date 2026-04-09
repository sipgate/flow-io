'use client'

import { useTranslations } from 'next-intl'
import { Star } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { CSATOverview } from '@/lib/actions/analytics'

interface CSATOverviewCardProps {
  data: CSATOverview
}

export function CSATOverviewCard({ data }: CSATOverviewCardProps) {
  const t = useTranslations('dashboard.csatOverview')
  const tCsat = useTranslations('csatScore')

  if (data.totalRatings === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            {tCsat('label')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('noRatings')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          {tCsat('label')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Average Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">{t('averageScore')}</span>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${
              data.averageScore >= 4 ? 'text-green-500' :
              data.averageScore >= 3 ? 'text-amber-500' :
              'text-red-500'
            }`}>
              {data.averageScore}
            </span>
            <span className="text-sm text-neutral-500">{tCsat('outOf5')}</span>
          </div>
        </div>

        {/* Distribution Bar */}
        <div className="space-y-2">
          {data.distribution.map(({ score, count }) => (
            <div key={score} className="flex items-center gap-2 text-xs">
              <span className="w-4 text-neutral-500">{score}</span>
              <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    score >= 4 ? 'bg-lime-500' :
                    score === 3 ? 'bg-amber-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: data.totalRatings > 0 ? `${(count / data.totalRatings) * 100}%` : '0%' }}
                />
              </div>
              <span className="w-6 text-right text-neutral-500">{count}</span>
            </div>
          ))}
        </div>

        {/* Total Ratings */}
        <div className="text-center pt-2 border-t border-neutral-200 dark:border-neutral-700">
          <span className="text-xs text-neutral-500">
            {t('totalRatings', { count: data.totalRatings })}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
