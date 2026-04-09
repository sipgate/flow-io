'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus, Phone, CheckCircle, Clock, Star, Target } from 'lucide-react'
import type { PeriodComparison } from '@/lib/actions/analytics'

interface PeriodComparisonCardProps {
  data: PeriodComparison
}

export function PeriodComparisonCard({ data }: PeriodComparisonCardProps) {
  const t = useTranslations('analytics.comparison')

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  const getTrendIcon = (change: number | null, inverse: boolean = false) => {
    if (change === null) return <Minus className="h-4 w-4 text-neutral-400" />
    const isPositive = inverse ? change < 0 : change > 0
    if (change === 0) return <Minus className="h-4 w-4 text-neutral-400" />
    return isPositive ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    )
  }

  const getTrendColor = (change: number | null, inverse: boolean = false) => {
    if (change === null || change === 0) return 'text-neutral-500'
    const isPositive = inverse ? change < 0 : change > 0
    return isPositive ? 'text-green-500' : 'text-red-500'
  }

  const formatChange = (change: number | null, suffix: string = '%') => {
    if (change === null) return '-'
    const sign = change > 0 ? '+' : ''
    return `${sign}${change}${suffix}`
  }

  const metrics = [
    {
      label: t('totalCalls'),
      icon: Phone,
      current: data.current.totalCalls,
      previous: data.previous.totalCalls,
      change: data.changes.totalCalls,
      suffix: '%',
    },
    {
      label: t('completedCalls'),
      icon: CheckCircle,
      current: data.current.completedCalls,
      previous: data.previous.completedCalls,
      change: data.changes.completedCalls,
      suffix: '%',
    },
    {
      label: t('avgDuration'),
      icon: Clock,
      current: formatDuration(data.current.avgDuration),
      previous: formatDuration(data.previous.avgDuration),
      change: data.changes.avgDuration,
      suffix: '%',
      isText: true,
    },
    {
      label: t('avgCsat'),
      icon: Star,
      current: data.current.avgCsat !== null ? `${data.current.avgCsat}/5` : '-',
      previous: data.previous.avgCsat !== null ? `${data.previous.avgCsat}/5` : '-',
      change: data.changes.avgCsat,
      suffix: '',
      isText: true,
    },
    {
      label: t('criteriaPassRate'),
      icon: Target,
      current: data.current.criteriaPassRate !== null ? `${data.current.criteriaPassRate}%` : '-',
      previous: data.previous.criteriaPassRate !== null ? `${data.previous.criteriaPassRate}%` : '-',
      change: data.changes.criteriaPassRate,
      suffix: 'pp',
      isText: true,
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t('description')}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white dark:bg-neutral-700">
                  <metric.icon className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                </div>
                <div>
                  <p className="text-sm font-medium">{metric.label}</p>
                  <p className="text-xs text-neutral-500">
                    {t('previousPeriod')}: {metric.previous}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{metric.current}</p>
                <div className={`flex items-center justify-end gap-1 text-sm ${getTrendColor(metric.change)}`}>
                  {getTrendIcon(metric.change)}
                  <span>{formatChange(metric.change, metric.suffix)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
