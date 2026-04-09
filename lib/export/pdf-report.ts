import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type {
  AnalyticsSummary,
  PeriodComparison,
  CallsByDay,
  CallsByHour,
  EnhancedAssistantStats,
  CSATOverview,
  DurationDistribution,
  TopVariable,
} from '@/lib/actions/analytics'

interface ReportData {
  title: string
  dateRange: string
  summary?: AnalyticsSummary
  comparison?: PeriodComparison
  callsByDay?: CallsByDay[]
  callsByHour?: CallsByHour[]
  assistants?: EnhancedAssistantStats[]
  csat?: CSATOverview
  duration?: DurationDistribution[]
  variables?: TopVariable[]
}

export function generatePDFReport(data: ReportData, sections: string[]): void {
  const doc = new jsPDF()
  let yPos = 20

  // Helper functions
  const addTitle = (text: string) => {
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(text, 14, yPos)
    yPos += 10
  }

  const addSubtitle = (text: string) => {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(text, 14, yPos)
    doc.setTextColor(0)
    yPos += 8
  }

  const addSectionTitle = (text: string) => {
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(text, 14, yPos)
    yPos += 8
  }

  const addText = (text: string) => {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(text, 14, yPos)
    yPos += 6
  }

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  // Title
  addTitle(data.title)
  addSubtitle(`Generated: ${new Date().toLocaleString()} | Period: ${data.dateRange}`)
  yPos += 5

  // Summary Section
  if (sections.includes('summary') && data.summary) {
    addSectionTitle('Summary Statistics')

    const summaryData = [
      ['Total Calls', data.summary.totalCalls.toString()],
      ['Completed Calls', data.summary.completedCalls.toString()],
      ['Failed Calls', data.summary.failedCalls.toString()],
      ['Success Rate', `${data.summary.totalCalls > 0 ? Math.round((data.summary.completedCalls / data.summary.totalCalls) * 100) : 0}%`],
      ['Average Duration', formatDuration(data.summary.avgDuration)],
      ['Total Duration', formatDuration(data.summary.totalDuration)],
      ['Variables Extracted', data.summary.variablesExtracted.toString()],
    ]

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'striped',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  // Period Comparison
  if (sections.includes('comparison') && data.comparison) {
    addSectionTitle('Period Comparison')

    const comparisonData = [
      [
        'Total Calls',
        data.comparison.current.totalCalls.toString(),
        data.comparison.previous.totalCalls.toString(),
        `${data.comparison.changes.totalCalls > 0 ? '+' : ''}${data.comparison.changes.totalCalls}%`,
      ],
      [
        'Completed Calls',
        data.comparison.current.completedCalls.toString(),
        data.comparison.previous.completedCalls.toString(),
        `${data.comparison.changes.completedCalls > 0 ? '+' : ''}${data.comparison.changes.completedCalls}%`,
      ],
      [
        'Avg Duration',
        formatDuration(data.comparison.current.avgDuration),
        formatDuration(data.comparison.previous.avgDuration),
        `${data.comparison.changes.avgDuration > 0 ? '+' : ''}${data.comparison.changes.avgDuration}%`,
      ],
      [
        'Avg CSAT',
        data.comparison.current.avgCsat?.toString() || '-',
        data.comparison.previous.avgCsat?.toString() || '-',
        data.comparison.changes.avgCsat !== null ? `${data.comparison.changes.avgCsat > 0 ? '+' : ''}${data.comparison.changes.avgCsat}` : '-',
      ],
    ]

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Current', 'Previous', 'Change']],
      body: comparisonData,
      theme: 'striped',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  // Assistant Performance
  if (sections.includes('assistants') && data.assistants && data.assistants.length > 0) {
    addSectionTitle('Assistant Performance')

    const assistantData = data.assistants.map(a => [
      a.name,
      a.totalCalls.toString(),
      `${a.completionRate}%`,
      formatDuration(a.avgDuration),
      a.avgCsat?.toFixed(1) || '-',
      a.criteriaPassRate !== null ? `${a.criteriaPassRate}%` : '-',
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Assistant', 'Calls', 'Completion', 'Avg Duration', 'CSAT', 'Criteria']],
      body: assistantData,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  // CSAT Analysis
  if (sections.includes('csat') && data.csat) {
    addSectionTitle('CSAT Analysis')

    addText(`Total Ratings: ${data.csat.totalRatings}`)
    addText(`Average Score: ${data.csat.averageScore.toFixed(1)}/5`)
    yPos += 2

    const csatData = data.csat.distribution.map(d => [
      `${d.score} Star${d.score > 1 ? 's' : ''}`,
      d.count.toString(),
      `${data.csat!.totalRatings > 0 ? Math.round((d.count / data.csat!.totalRatings) * 100) : 0}%`,
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Rating', 'Count', 'Percentage']],
      body: csatData,
      theme: 'striped',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  // Calls by Day
  if (sections.includes('callsByDay') && data.callsByDay && data.callsByDay.length > 0) {
    addSectionTitle('Calls by Day')

    const dayData = data.callsByDay
      .filter(d => d.total > 0)
      .slice(-14) // Last 14 days
      .map(d => [
        d.date,
        d.total.toString(),
        d.completed.toString(),
        d.failed.toString(),
        formatDuration(d.avgDuration),
      ])

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Total', 'Completed', 'Failed', 'Avg Duration']],
      body: dayData,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  // Calls by Hour
  if (sections.includes('callsByHour') && data.callsByHour) {
    addSectionTitle('Calls by Hour of Day')

    const hourData = data.callsByHour
      .filter(h => h.count > 0)
      .map(h => [
        `${h.hour.toString().padStart(2, '0')}:00`,
        h.count.toString(),
      ])

    if (hourData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Hour', 'Calls']],
        body: hourData,
        theme: 'striped',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 40 } },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10
    }
  }

  // Duration Distribution
  if (sections.includes('duration') && data.duration) {
    addSectionTitle('Duration Distribution')

    const durationData = data.duration.map(d => [
      d.range,
      d.count.toString(),
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Duration Range', 'Count']],
      body: durationData,
      theme: 'striped',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  // Top Variables
  if (sections.includes('variables') && data.variables && data.variables.length > 0) {
    addSectionTitle('Top Extracted Variables')

    const variableData = data.variables.map(v => [
      v.label || v.name,
      v.count.toString(),
      v.uniqueValues.toString(),
      v.topValues.slice(0, 3).map(tv => tv.value).join(', '),
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Variable', 'Extractions', 'Unique Values', 'Top Values']],
      body: variableData,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Page ${i} of ${pageCount} | Generated by Flow-IO Analytics`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    )
  }

  // Download
  const filename = `${data.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
