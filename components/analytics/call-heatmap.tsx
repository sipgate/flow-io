'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { HeatmapCell } from '@/lib/actions/analytics'

interface CallHeatmapProps {
  data: HeatmapCell[]
  onCellClick?: (dayOfWeek: number, hour: number) => void
}

export function CallHeatmap({ data, onCellClick }: CallHeatmapProps) {
  const t = useTranslations('analytics.heatmap')
  const tCsat = useTranslations('csatScore')
  const [metric, setMetric] = useState<'count' | 'duration' | 'csat'>('count')

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Get cell value based on metric
  const getCellValue = (cell: HeatmapCell): number => {
    switch (metric) {
      case 'count':
        return cell.count
      case 'duration':
        return cell.avgDuration
      case 'csat':
        return cell.avgCsat ?? 0
    }
  }

  // Calculate max value for color scaling
  const maxValue = Math.max(...data.map(getCellValue), 1)

  // Get color intensity based on value
  const getColorIntensity = (value: number): string => {
    if (value === 0) return 'bg-neutral-100 dark:bg-neutral-800'
    const intensity = value / maxValue
    if (metric === 'csat') {
      // CSAT uses green scale (higher is better)
      if (intensity < 0.3) return 'bg-red-200 dark:bg-red-900/50'
      if (intensity < 0.5) return 'bg-yellow-200 dark:bg-yellow-900/50'
      if (intensity < 0.7) return 'bg-green-200 dark:bg-green-900/50'
      return 'bg-green-400 dark:bg-green-700'
    }
    // Count/Duration uses blue scale
    if (intensity < 0.2) return 'bg-blue-100 dark:bg-blue-900/30'
    if (intensity < 0.4) return 'bg-blue-200 dark:bg-blue-900/50'
    if (intensity < 0.6) return 'bg-blue-300 dark:bg-blue-800/70'
    if (intensity < 0.8) return 'bg-blue-400 dark:bg-blue-700'
    return 'bg-blue-500 dark:bg-blue-600'
  }

  // Format cell value for display
  const formatValue = (cell: HeatmapCell): string => {
    switch (metric) {
      case 'count':
        return `${cell.count} ${t('calls')}`
      case 'duration':
        const mins = Math.floor(cell.avgDuration / 60)
        const secs = cell.avgDuration % 60
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
      case 'csat':
        return cell.avgCsat !== null ? `${cell.avgCsat}/5` : t('noData')
    }
  }

  // Get cell by coordinates
  const getCell = (day: number, hour: number): HeatmapCell | undefined => {
    return data.find(c => c.dayOfWeek === day && c.hour === hour)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t('title')}</CardTitle>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setMetric('count')}
              className={`px-2 py-1 rounded ${
                metric === 'count'
                  ? 'bg-blue-500 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {t('calls')}
            </button>
            <button
              onClick={() => setMetric('duration')}
              className={`px-2 py-1 rounded ${
                metric === 'duration'
                  ? 'bg-blue-500 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {t('duration')}
            </button>
            <button
              onClick={() => setMetric('csat')}
              className={`px-2 py-1 rounded ${
                metric === 'csat'
                  ? 'bg-blue-500 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {tCsat('label')}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex mb-1">
                <div className="w-10" /> {/* Spacer for day labels */}
                {hours.map(hour => (
                  <div
                    key={hour}
                    className="flex-1 text-center text-xs text-neutral-500 dark:text-neutral-400"
                  >
                    {hour.toString().padStart(2, '0')}
                  </div>
                ))}
              </div>
              {/* Heatmap grid */}
              {days.map((dayName, dayIndex) => (
                <div key={dayName} className="flex gap-0.5 mb-0.5">
                  <div className="w-10 text-xs text-neutral-500 dark:text-neutral-400 flex items-center">
                    {dayName}
                  </div>
                  {hours.map(hour => {
                    const cell = getCell(dayIndex, hour)
                    if (!cell) return <div key={hour} className="flex-1 h-6" />

                    return (
                      <Tooltip key={hour}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onCellClick?.(dayIndex, hour)}
                            className={`flex-1 h-6 rounded-sm transition-colors ${getColorIntensity(
                              getCellValue(cell)
                            )} hover:ring-2 hover:ring-blue-500 hover:ring-offset-1`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                            <p className="font-medium">
                              {dayName} {hour.toString().padStart(2, '0')}:00
                            </p>
                            <p>{formatValue(cell)}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-4 text-xs text-neutral-500">
            <span>{t('less')}</span>
            <div className="flex gap-0.5">
              <div className="w-4 h-4 rounded-sm bg-neutral-100 dark:bg-neutral-800" />
              <div className="w-4 h-4 rounded-sm bg-blue-100 dark:bg-blue-900/30" />
              <div className="w-4 h-4 rounded-sm bg-blue-200 dark:bg-blue-900/50" />
              <div className="w-4 h-4 rounded-sm bg-blue-300 dark:bg-blue-800/70" />
              <div className="w-4 h-4 rounded-sm bg-blue-400 dark:bg-blue-700" />
              <div className="w-4 h-4 rounded-sm bg-blue-500 dark:bg-blue-600" />
            </div>
            <span>{t('more')}</span>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
