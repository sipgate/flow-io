'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, FileSpreadsheet, FileJson, FileText, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { getCallsForExport } from '@/lib/actions/calls'
import { EXPORT_FIELDS, type ExportFormat } from '@/lib/export/call-export-config'
import * as XLSX from 'xlsx'

type ExportCallData = Record<string, string | number | null | undefined>

/**
 * Convert data to CSV format
 */
function convertToCSV(data: ExportCallData[]): string {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0])
  const csvRows: string[] = []

  // Header row
  csvRows.push(headers.map(h => `"${h}"`).join(','))

  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]
      if (value === null || value === undefined) return ''
      // Escape quotes and wrap in quotes
      const stringValue = String(value).replace(/"/g, '""')
      return `"${stringValue}"`
    })
    csvRows.push(values.join(','))
  }

  return csvRows.join('\n')
}

/**
 * Convert data to JSON format
 */
function convertToJSON(data: ExportCallData[]): string {
  return JSON.stringify(data, null, 2)
}

interface ExportCallsDialogProps {
  open: boolean
  onClose: () => void
  organizationId: string
}

export function ExportCallsDialog({
  open,
  onClose,
  organizationId,
}: ExportCallsDialogProps) {
  const t = useTranslations('calls.export')
  const tCommon = useTranslations('common')

  const [format, setFormat] = useState<ExportFormat>('csv')
  const [fields, setFields] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const field of EXPORT_FIELDS) {
      initial[field.key] = field.enabled
    }
    return initial
  })
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const toggleField = (key: string) => {
    setFields(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const selectAll = () => {
    const newFields: Record<string, boolean> = {}
    for (const field of EXPORT_FIELDS) {
      newFields[field.key] = true
    }
    setFields(newFields)
  }

  const selectNone = () => {
    const newFields: Record<string, boolean> = {}
    for (const field of EXPORT_FIELDS) {
      newFields[field.key] = false
    }
    setFields(newFields)
  }

  const handleExport = async () => {
    const selectedFields = Object.entries(fields)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)

    if (selectedFields.length === 0) {
      toast.error(t('noFieldsSelected'))
      return
    }

    setIsExporting(true)

    try {
      const { data, error } = await getCallsForExport({
        organizationId,
        fields: selectedFields,
        format,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })

      if (error) {
        toast.error(error)
        return
      }

      if (data.length === 0) {
        toast.error(t('noData'))
        return
      }

      // Generate file content based on format
      let content: string | ArrayBuffer
      let filename: string
      let mimeType: string

      const timestamp = new Date().toISOString().split('T')[0]

      switch (format) {
        case 'csv':
          content = convertToCSV(data)
          filename = `calls-export-${timestamp}.csv`
          mimeType = 'text/csv;charset=utf-8;'
          break
        case 'json':
          content = convertToJSON(data)
          filename = `calls-export-${timestamp}.json`
          mimeType = 'application/json'
          break
        case 'xlsx':
          const worksheet = XLSX.utils.json_to_sheet(data)
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Calls')
          content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
          filename = `calls-export-${timestamp}.xlsx`
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          break
      }

      // Download file
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(t('exportSuccess', { count: data.length }))
      onClose()
    } catch (error) {
      console.error('Export error:', error)
      toast.error(t('exportError'))
    } finally {
      setIsExporting(false)
    }
  }

  const getFormatIcon = (fmt: ExportFormat) => {
    switch (fmt) {
      case 'csv':
        return <FileText className="h-4 w-4" />
      case 'json':
        return <FileJson className="h-4 w-4" />
      case 'xlsx':
        return <FileSpreadsheet className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('format')}</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as ExportFormat)}
              className="flex gap-4"
            >
              {(['csv', 'json', 'xlsx'] as ExportFormat[]).map((fmt) => (
                <div key={fmt} className="flex items-center space-x-2">
                  <RadioGroupItem value={fmt} id={fmt} />
                  <Label
                    htmlFor={fmt}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    {getFormatIcon(fmt)}
                    {fmt.toUpperCase()}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Date Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('dateRange')}</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateFrom" className="text-xs text-neutral-500">
                  {t('from')}
                </Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dateTo" className="text-xs text-neutral-500">
                  {t('to')}
                </Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-neutral-500">{t('dateHint')}</p>
          </div>

          {/* Field Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('fields')}</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {t('selectAll')}
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  {t('selectNone')}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {EXPORT_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={field.key}
                    checked={fields[field.key]}
                    onCheckedChange={() => toggleField(field.key)}
                  />
                  <Label
                    htmlFor={field.key}
                    className="text-sm cursor-pointer"
                  >
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('exporting')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t('export')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
