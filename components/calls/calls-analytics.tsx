'use client'

import { useTranslations } from 'next-intl'
import { Phone, Clock, TrendingUp, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Call {
  id: string
  status: string | null
  duration_seconds: number | null
  started_at: string | null
}

interface CallsAnalyticsProps {
  calls: Call[]
}

export function CallsAnalytics({ calls }: CallsAnalyticsProps) {
  const t = useTranslations('calls.analytics')

  // Calculate metrics
  const totalCalls = calls.length
  const completedCalls = calls.filter((c) => c.status === 'completed').length
  const activeCalls = calls.filter((c) => c.status === 'active').length
  const avgDuration =
    completedCalls > 0
      ? Math.round(
          calls
            .filter((c) => c.duration_seconds !== null)
            .reduce((sum, c) => sum + (c.duration_seconds || 0), 0) /
            completedCalls
        )
      : 0

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('totalCalls')}</CardTitle>
          <Phone className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCalls}</div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            {t('allTime')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('completed')}</CardTitle>
          <CheckCircle className="h-4 w-4 text-lime-700 dark:text-lime-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completedCalls}</div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            {totalCalls > 0
              ? t('successRate', { rate: Math.round((completedCalls / totalCalls) * 100) })
              : t('noCallsYet')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('activeNow')}</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeCalls}</div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            {t('liveCalls')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('avgDuration')}</CardTitle>
          <Clock className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {avgDuration > 0 ? formatDuration(avgDuration) : '0s'}
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            {t('perCompletedCall')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
