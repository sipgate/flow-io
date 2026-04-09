'use client'

import { useTranslations } from 'next-intl'
import { Star } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { CSATOverview, CSATByDay } from '@/lib/actions/analytics'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

interface CSATAnalyticsSectionProps {
  overview: CSATOverview
  byDay: CSATByDay[]
}

export function CSATAnalyticsSection({ overview, byDay }: CSATAnalyticsSectionProps) {
  const t = useTranslations('analytics.csat')

  if (overview.totalRatings === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('noData')}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Filter to days with ratings for the chart
  const chartData = byDay.filter(d => d.count > 0).map(d => ({
    date: d.date,
    score: d.averageScore,
    count: d.count,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Average Score */}
          <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div className={`text-3xl font-bold ${
              overview.averageScore >= 4 ? 'text-green-500' :
              overview.averageScore >= 3 ? 'text-amber-500' :
              'text-red-500'
            }`}>
              {overview.averageScore}
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {t('averageScore')}
            </div>
          </div>

          {/* Total Ratings */}
          <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div className="text-3xl font-bold text-neutral-700 dark:text-neutral-200">
              {overview.totalRatings}
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {t('totalRatings')}
            </div>
          </div>

          {/* Good Ratings (4-5) */}
          <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div className="text-3xl font-bold text-green-500">
              {overview.distribution.filter(d => d.score >= 4).reduce((sum, d) => sum + d.count, 0)}
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {t('goodRatings')}
            </div>
          </div>

          {/* Poor Ratings (1-2) */}
          <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div className="text-3xl font-bold text-red-500">
              {overview.distribution.filter(d => d.score <= 2).reduce((sum, d) => sum + d.count, 0)}
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {t('poorRatings')}
            </div>
          </div>
        </div>

        {/* Distribution Bar */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('distribution')}
          </h4>
          {overview.distribution.map(({ score, count }) => {
            const percentage = overview.totalRatings > 0 ? (count / overview.totalRatings) * 100 : 0
            return (
              <div key={score} className="flex items-center gap-3">
                <div className="w-8 text-sm font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                  {score} <Star className="h-3 w-3" />
                </div>
                <div className="flex-1 h-4 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      score >= 4 ? 'bg-lime-500' :
                      score === 3 ? 'bg-amber-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-16 text-sm text-neutral-500 text-right">
                  {count} ({Math.round(percentage)}%)
                </div>
              </div>
            )
          })}
        </div>

        {/* Trend Chart */}
        {chartData.length > 1 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('trend')}
            </h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return `${date.getMonth() + 1}/${date.getDate()}`
                    }}
                    className="text-neutral-500"
                  />
                  <YAxis
                    domain={[1, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tick={{ fontSize: 12 }}
                    className="text-neutral-500"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-white dark:bg-neutral-800 p-2 rounded shadow border border-neutral-200 dark:border-neutral-700">
                            <p className="text-sm font-medium">{data.date}</p>
                            <p className="text-sm text-neutral-500">
                              {t('score')}: <span className="font-medium">{data.score}</span>
                            </p>
                            <p className="text-sm text-neutral-500">
                              {t('ratings')}: <span className="font-medium">{data.count}</span>
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
