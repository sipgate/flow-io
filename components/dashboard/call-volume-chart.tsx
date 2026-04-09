'use client'

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { CallVolumeData } from '@/lib/actions/dashboard'

interface CallVolumeChartProps {
  data: CallVolumeData[]
}

export function CallVolumeChart({ data }: CallVolumeChartProps) {
  const t = useTranslations('dashboard.callVolume')
  const tCalls = useTranslations('calls')
  const locale = useLocale()

  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      day: new Date(d.date).toLocaleDateString(locale, { weekday: 'short' }),
      avgDurationMins: Math.round(d.avgDuration / 60 * 10) / 10,
    }))
  }, [data, locale])

  const totalCalls = data.reduce((sum, d) => sum + d.calls, 0)
  const hasData = totalCalls > 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{t('title')}</CardTitle>
          <span className="text-sm text-neutral-500">{t('last7Days')}</span>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center text-neutral-500">
            <div className="text-center">
              <p>{t('noData')}</p>
              <p className="text-sm">{t('chartWillPopulate')}</p>
            </div>
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  className="text-neutral-500"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  className="text-neutral-500"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  className="text-neutral-500"
                  hide
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    borderColor: 'var(--tooltip-border, #e2e8f0)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ fontWeight: 600 }}
                  formatter={(value, name) => {
                    if (name === 'calls') return [value, t('calls')]
                    if (name === 'avgDurationMins') return [`${value}m`, t('avgDuration')]
                    return [value, name]
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="calls"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgDurationMins"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', strokeWidth: 0, r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        {hasData && (
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-neutral-500">{t('calls')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-neutral-500">{t('avgDuration')}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
