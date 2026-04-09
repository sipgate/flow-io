'use client'

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { CallsByDay } from '@/lib/actions/analytics'

interface CallsByDayChartProps {
  data: CallsByDay[]
}

export function CallsByDayChart({ data }: CallsByDayChartProps) {
  const t = useTranslations('analytics')
  const tOverview = useTranslations('analytics.overview')
  const locale = useLocale()

  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    }))
  }, [data, locale])

  const hasData = data.some((d) => d.total > 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{t('callsOverTime')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[300px] flex items-center justify-center text-neutral-500">
            {t('noCallData')}
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="text-neutral-500"
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} className="text-neutral-500" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    borderColor: 'var(--tooltip-border, #e2e8f0)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name={tOverview('completed')}
                  stackId="1"
                  stroke="#22c55e"
                  fill="url(#colorCompleted)"
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  name={tOverview('failed')}
                  stackId="1"
                  stroke="#ef4444"
                  fill="url(#colorFailed)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
