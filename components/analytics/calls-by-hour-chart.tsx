'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useTranslations } from 'next-intl'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { CallsByHour } from '@/lib/actions/analytics'

interface CallsByHourChartProps {
  data: CallsByHour[]
}

export function CallsByHourChart({ data }: CallsByHourChartProps) {
  const t = useTranslations('callsByHourChart')
  const chartData = data.map((d) => ({
    ...d,
    hourLabel: `${d.hour.toString().padStart(2, '0')}:00`,
  }))

  const hasData = data.some((d) => d.count > 0)
  const maxCount = Math.max(...data.map((d) => d.count))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center text-neutral-500">
            {t('noData')}
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700" />
                <XAxis
                  dataKey="hourLabel"
                  tick={{ fontSize: 10 }}
                  className="text-neutral-500"
                  interval={2}
                />
                <YAxis tick={{ fontSize: 12 }} className="text-neutral-500" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    borderColor: 'var(--tooltip-border, #e2e8f0)',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [value, t('callsLabel')]}
                  labelFormatter={(label) => t('timeLabel', { label })}
                />
                <Bar
                  dataKey="count"
                  fill="#3b82f6"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
