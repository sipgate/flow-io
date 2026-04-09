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
  BarChart,
  Bar,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Target, CheckCircle, XCircle, HelpCircle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface CriteriaAnalyticsData {
  byAssistant: Array<{
    assistant_id: string
    assistant_name: string
    totalEvaluations: number
    passed: number
    failed: number
    inconclusive: number
    passRate: number
  }>
  byCriterion: Array<{
    criterion_id: string
    criterion_name: string
    totalEvaluations: number
    passed: number
    failed: number
    inconclusive: number
    passRate: number
  }>
  dailyTrend: Array<{
    date: string
    passed: number
    failed: number
    inconclusive: number
  }>
}

interface CriteriaAnalyticsSectionProps {
  data: CriteriaAnalyticsData
}

export function CriteriaAnalyticsSection({ data }: CriteriaAnalyticsSectionProps) {
  const t = useTranslations('analytics.criteria')
  const locale = useLocale()

  const chartData = useMemo(() => {
    return data.dailyTrend.map((d) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    }))
  }, [data.dailyTrend, locale])

  const hasData = data.dailyTrend.some((d) => d.passed > 0 || d.failed > 0 || d.inconclusive > 0)
  const totalEvaluations = data.byCriterion.reduce((sum, c) => sum + c.totalEvaluations, 0)
  const totalPassed = data.byCriterion.reduce((sum, c) => sum + c.passed, 0)
  const totalFailed = data.byCriterion.reduce((sum, c) => sum + c.failed, 0)
  const totalInconclusive = data.byCriterion.reduce((sum, c) => sum + c.inconclusive, 0)
  const overallPassRate = totalEvaluations > 0 ? Math.round((totalPassed / totalEvaluations) * 100) : 0

  if (!hasData && data.byCriterion.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-neutral-500">
            {t('noData')}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section Header with Summary Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('totalEvaluations')}</p>
              <p className="text-2xl font-bold">{totalEvaluations}</p>
            </div>
            <div className="p-4 rounded-lg bg-lime-50 dark:bg-lime-950/20">
              <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                {t('passed')}
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalPassed}</p>
            </div>
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                {t('failed')}
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totalFailed}</p>
            </div>
            <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex items-center gap-1 text-sm text-neutral-500">
                <HelpCircle className="h-4 w-4" />
                {t('inconclusive')}
              </div>
              <p className="text-2xl font-bold text-neutral-500">{totalInconclusive}</p>
            </div>
          </div>

          {/* Overall Pass Rate */}
          <div className="mt-4 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">{t('overallPassRate')}</span>
              <span className={`text-xl font-bold ${
                overallPassRate >= 80 ? 'text-green-500' :
                overallPassRate >= 50 ? 'text-amber-500' :
                'text-red-500'
              }`}>
                {overallPassRate}%
              </span>
            </div>
            <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden flex">
              {totalPassed > 0 && (
                <div
                  className="h-full bg-lime-500"
                  style={{ width: `${(totalPassed / totalEvaluations) * 100}%` }}
                />
              )}
              {totalInconclusive > 0 && (
                <div
                  className="h-full bg-neutral-400"
                  style={{ width: `${(totalInconclusive / totalEvaluations) * 100}%` }}
                />
              )}
              {totalFailed > 0 && (
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${(totalFailed / totalEvaluations) * 100}%` }}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend Chart */}
      {hasData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">{t('trendOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCriteriaPassed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCriteriaFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCriteriaInconclusive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
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
                    dataKey="passed"
                    name={t('passed')}
                    stackId="1"
                    stroke="#22c55e"
                    fill="url(#colorCriteriaPassed)"
                  />
                  <Area
                    type="monotone"
                    dataKey="inconclusive"
                    name={t('inconclusive')}
                    stackId="1"
                    stroke="#94a3b8"
                    fill="url(#colorCriteriaInconclusive)"
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    name={t('failed')}
                    stackId="1"
                    stroke="#ef4444"
                    fill="url(#colorCriteriaFailed)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tables Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Criterion */}
        {data.byCriterion.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">{t('byCriterion')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('criterion')}</TableHead>
                    <TableHead className="text-center">{t('passed')}</TableHead>
                    <TableHead className="text-center">{t('failed')}</TableHead>
                    <TableHead className="text-right">{t('passRate')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byCriterion.map((criterion) => (
                    <TableRow key={criterion.criterion_id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {criterion.criterion_name}
                      </TableCell>
                      <TableCell className="text-center text-green-600 dark:text-green-400">
                        {criterion.passed}
                      </TableCell>
                      <TableCell className="text-center text-red-600 dark:text-red-400">
                        {criterion.failed}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${
                          criterion.passRate >= 80 ? 'text-green-500' :
                          criterion.passRate >= 50 ? 'text-amber-500' :
                          'text-red-500'
                        }`}>
                          {criterion.passRate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* By Assistant */}
        {data.byAssistant.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">{t('byAssistant')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('assistant')}</TableHead>
                    <TableHead className="text-center">{t('passed')}</TableHead>
                    <TableHead className="text-center">{t('failed')}</TableHead>
                    <TableHead className="text-right">{t('passRate')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byAssistant.map((assistant) => (
                    <TableRow key={assistant.assistant_id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {assistant.assistant_name}
                      </TableCell>
                      <TableCell className="text-center text-green-600 dark:text-green-400">
                        {assistant.passed}
                      </TableCell>
                      <TableCell className="text-center text-red-600 dark:text-red-400">
                        {assistant.failed}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${
                          assistant.passRate >= 80 ? 'text-green-500' :
                          assistant.passRate >= 50 ? 'text-amber-500' :
                          'text-red-500'
                        }`}>
                          {assistant.passRate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
