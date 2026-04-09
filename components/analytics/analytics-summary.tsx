'use client'

import { useTranslations } from 'next-intl'
import { Phone, CheckCircle, XCircle, Clock, Timer, Variable } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { AnalyticsSummary } from '@/lib/actions/analytics'

interface AnalyticsSummaryCardsProps {
  summary: AnalyticsSummary
}

export function AnalyticsSummaryCards({ summary }: AnalyticsSummaryCardsProps) {
  const t = useTranslations('analytics.overview')

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0s'
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) return `${hours}h ${mins}m`
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const successRate = summary.totalCalls > 0
    ? Math.round((summary.completedCalls / summary.totalCalls) * 100)
    : 0

  const cards = [
    {
      title: t('totalCalls'),
      value: summary.totalCalls,
      icon: Phone,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: t('completed'),
      value: summary.completedCalls,
      subtitle: t('successRate', { rate: successRate }),
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: t('failed'),
      value: summary.failedCalls,
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: t('avgDuration'),
      value: formatDuration(summary.avgDuration),
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      isText: true,
    },
    {
      title: t('totalDuration'),
      value: formatTotalDuration(summary.totalDuration),
      icon: Timer,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      isText: true,
    },
    {
      title: t('variablesExtracted'),
      value: summary.variablesExtracted,
      icon: Variable,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
  ]

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.title} className="p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {card.title}
              </p>
              <p className="text-xl font-bold">{card.value}</p>
              {card.subtitle && (
                <p className="text-xs text-neutral-500">{card.subtitle}</p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
