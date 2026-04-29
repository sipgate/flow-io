'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { BarChart3, FileDown, TrendingUp, Grid3X3, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TimeRangeSelector } from '@/components/analytics/time-range-selector'
import { AnalyticsSummaryCards } from '@/components/analytics/analytics-summary'
import { CallsByDayChart } from '@/components/analytics/calls-by-day-chart'
import { CallsByHourChart } from '@/components/analytics/calls-by-hour-chart'
import { DurationDistributionChart } from '@/components/analytics/duration-distribution-chart'
import { AssistantStatsTable } from '@/components/analytics/assistant-stats-table'
import { CriteriaAnalyticsSection } from '@/components/analytics/criteria-analytics-section'
import { CSATAnalyticsSection } from '@/components/analytics/csat-analytics-section'
import { CallHeatmap } from '@/components/analytics/call-heatmap'
import { PeriodComparisonCard } from '@/components/analytics/period-comparison'
import { EnhancedAssistantStatsTable } from '@/components/analytics/enhanced-assistant-stats'
import { DrillDownModal } from '@/components/analytics/drill-down-modal'
import { ReportBuilderDialog } from '@/components/analytics/report-builder'
import { generatePDFReport } from '@/lib/export/pdf-report'
import { toast } from 'sonner'
import {
  getAnalyticsSummary,
  getCallsByDay,
  getCallsByHour,
  getDurationDistribution,
  getAssistantStats,
  getCSATOverview,
  getCSATByDay,
  getCallHeatmap,
  getPeriodComparison,
  getEnhancedAssistantStats,
  getTopExtractedVariables,
  type TimeRange,
  type DateRange,
  type AnalyticsSummary,
  type CallsByDay,
  type CallsByHour,
  type DurationDistribution,
  type AssistantStats,
  type CSATOverview,
  type CSATByDay,
  type HeatmapCell,
  type PeriodComparison,
  type EnhancedAssistantStats,
  type TopVariable,
} from '@/lib/actions/analytics'
import { getCriteriaAnalytics } from '@/lib/actions/call-criteria'

interface AnalyticsContentProps {
  organizationId: string
  orgSlug: string
}

export function AnalyticsContent({ organizationId, orgSlug }: AnalyticsContentProps) {
  const t = useTranslations('analytics')
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Data states
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [callsByDay, setCallsByDay] = useState<CallsByDay[]>([])
  const [callsByHour, setCallsByHour] = useState<CallsByHour[]>([])
  const [durationDist, setDurationDist] = useState<DurationDistribution[]>([])
  const [assistantStats, setAssistantStats] = useState<AssistantStats[]>([])
  const [criteriaAnalytics, setCriteriaAnalytics] = useState<Awaited<ReturnType<typeof getCriteriaAnalytics>> | null>(null)
  const [csatOverview, setCsatOverview] = useState<CSATOverview | null>(null)
  const [csatByDay, setCsatByDay] = useState<CSATByDay[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([])
  const [periodComparison, setPeriodComparison] = useState<PeriodComparison | null>(null)
  const [enhancedAssistantStats, setEnhancedAssistantStats] = useState<EnhancedAssistantStats[]>([])
  const [topVariables, setTopVariables] = useState<TopVariable[]>([])

  // Modal states
  const [drillDownOpen, setDrillDownOpen] = useState(false)
  const [drillDownFilters, setDrillDownFilters] = useState<{
    date?: string
    hour?: number
    dayOfWeek?: number
    assistantId?: string
  }>({})
  const [drillDownTitle, setDrillDownTitle] = useState('')
  const [reportBuilderOpen, setReportBuilderOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 30

        const [
          summaryData,
          dayData,
          hourData,
          durationData,
          assistantData,
          criteriaData,
          csatOverviewData,
          csatDayData,
          heatmapResult,
          comparisonData,
          enhancedStats,
          variables,
        ] = await Promise.all([
          getAnalyticsSummary(organizationId, timeRange, customRange),
          getCallsByDay(organizationId, timeRange, customRange),
          getCallsByHour(organizationId, timeRange, customRange),
          getDurationDistribution(organizationId, timeRange, customRange),
          getAssistantStats(organizationId, timeRange, customRange),
          getCriteriaAnalytics(organizationId, days),
          getCSATOverview(organizationId, timeRange, customRange),
          getCSATByDay(organizationId, timeRange, customRange),
          getCallHeatmap(organizationId, timeRange, customRange),
          getPeriodComparison(organizationId, timeRange, customRange),
          getEnhancedAssistantStats(organizationId, timeRange, customRange),
          getTopExtractedVariables(organizationId, timeRange, customRange),
        ])

        setSummary(summaryData)
        setCallsByDay(dayData)
        setCallsByHour(hourData)
        setDurationDist(durationData)
        setAssistantStats(assistantData)
        setCriteriaAnalytics(criteriaData)
        setCsatOverview(csatOverviewData)
        setCsatByDay(csatDayData)
        setHeatmapData(heatmapResult)
        setPeriodComparison(comparisonData)
        setEnhancedAssistantStats(enhancedStats)
        setTopVariables(variables)
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, timeRange, customRange])

  const handleTimeRangeChange = (range: TimeRange, newCustomRange?: DateRange) => {
    setTimeRange(range)
    setCustomRange(newCustomRange)
  }

  const handleHeatmapCellClick = (dayOfWeek: number, hour: number) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    setDrillDownFilters({ dayOfWeek, hour })
    setDrillDownTitle(`Calls on ${dayNames[dayOfWeek]}s at ${hour.toString().padStart(2, '0')}:00`)
    setDrillDownOpen(true)
  }

  const handleAssistantClick = (assistantId: string) => {
    const assistant = enhancedAssistantStats.find(a => a.id === assistantId)
    setDrillDownFilters({ assistantId })
    setDrillDownTitle(`Calls for ${assistant?.name || 'Agent'}`)
    setDrillDownOpen(true)
  }

  const getDateRangeString = () => {
    if (customRange) {
      return `${customRange.from.toLocaleDateString()} - ${customRange.to.toLocaleDateString()}`
    }
    return timeRange === '7d' ? 'Last 7 days' : timeRange === '30d' ? 'Last 30 days' : 'Last 90 days'
  }

  const handleGenerateReport = async (title: string, sections: string[]) => {
    try {
      generatePDFReport(
        {
          title,
          dateRange: getDateRangeString(),
          summary: summary || undefined,
          comparison: periodComparison || undefined,
          callsByDay,
          callsByHour,
          assistants: enhancedAssistantStats,
          csat: csatOverview || undefined,
          duration: durationDist,
          variables: topVariables,
        },
        sections
      )
      toast.success(t('report.success'))
    } catch (error) {
      console.error('Report generation error:', error)
      toast.error(t('report.error'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            {t('title')}
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            {t('description')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReportBuilderOpen(true)}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {t('exportReport')}
          </Button>
          <TimeRangeSelector value={timeRange} customRange={customRange} onChange={handleTimeRangeChange} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-[350px] bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('tabs.overview')}
            </TabsTrigger>
            <TabsTrigger value="patterns" className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              {t('tabs.patterns')}
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('tabs.performance')}
            </TabsTrigger>
            <TabsTrigger value="assistants" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('tabs.assistants')}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {summary && <AnalyticsSummaryCards summary={summary} />}
            <CallsByDayChart data={callsByDay} />
            <div className="grid gap-6 lg:grid-cols-2">
              <CallsByHourChart data={callsByHour} />
              <DurationDistributionChart data={durationDist} />
            </div>
            {criteriaAnalytics && !criteriaAnalytics.error && (
              <CriteriaAnalyticsSection data={criteriaAnalytics} />
            )}
            {csatOverview && (
              <CSATAnalyticsSection overview={csatOverview} byDay={csatByDay} />
            )}
          </TabsContent>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="space-y-6">
            <CallHeatmap data={heatmapData} onCellClick={handleHeatmapCellClick} />
            <div className="grid gap-6 lg:grid-cols-2">
              <CallsByHourChart data={callsByHour} />
              <DurationDistributionChart data={durationDist} />
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            {periodComparison && <PeriodComparisonCard data={periodComparison} />}
            {csatOverview && (
              <CSATAnalyticsSection overview={csatOverview} byDay={csatByDay} />
            )}
            {criteriaAnalytics && !criteriaAnalytics.error && (
              <CriteriaAnalyticsSection data={criteriaAnalytics} />
            )}
          </TabsContent>

          {/* Assistants Tab */}
          <TabsContent value="assistants" className="space-y-6">
            <EnhancedAssistantStatsTable
              data={enhancedAssistantStats}
              onAssistantClick={handleAssistantClick}
            />
            <AssistantStatsTable data={assistantStats} />
          </TabsContent>
        </Tabs>
      )}

      {/* Drill-Down Modal */}
      <DrillDownModal
        open={drillDownOpen}
        onClose={() => setDrillDownOpen(false)}
        organizationId={organizationId}
        orgSlug={orgSlug}
        filters={drillDownFilters}
        title={drillDownTitle}
      />

      {/* Report Builder */}
      <ReportBuilderDialog
        open={reportBuilderOpen}
        onClose={() => setReportBuilderOpen(false)}
        onGenerate={handleGenerateReport}
      />
    </div>
  )
}
