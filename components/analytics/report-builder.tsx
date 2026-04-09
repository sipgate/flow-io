'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
import { FileDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export interface ReportSection {
  id: string
  label: string
  enabled: boolean
}

export const DEFAULT_REPORT_SECTIONS: ReportSection[] = [
  { id: 'summary', label: 'Summary Statistics', enabled: true },
  { id: 'comparison', label: 'Period Comparison', enabled: true },
  { id: 'callsByDay', label: 'Calls by Day Chart', enabled: true },
  { id: 'callsByHour', label: 'Calls by Hour Chart', enabled: true },
  { id: 'heatmap', label: 'Call Heatmap', enabled: true },
  { id: 'assistants', label: 'Assistant Performance', enabled: true },
  { id: 'csat', label: 'CSAT Analysis', enabled: true },
  { id: 'criteria', label: 'Criteria Results', enabled: false },
  { id: 'variables', label: 'Extracted Variables', enabled: false },
  { id: 'duration', label: 'Duration Distribution', enabled: false },
]

interface ReportBuilderDialogProps {
  open: boolean
  onClose: () => void
  onGenerate: (title: string, sections: string[]) => Promise<void>
}

export function ReportBuilderDialog({
  open,
  onClose,
  onGenerate,
}: ReportBuilderDialogProps) {
  const t = useTranslations('analytics.report')
  const [title, setTitle] = useState('')
  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_REPORT_SECTIONS)
  const [generating, setGenerating] = useState(false)

  const toggleSection = (id: string) => {
    setSections(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    )
  }

  const selectAll = () => {
    setSections(prev => prev.map(s => ({ ...s, enabled: true })))
  }

  const selectNone = () => {
    setSections(prev => prev.map(s => ({ ...s, enabled: false })))
  }

  const handleGenerate = async () => {
    const selectedSections = sections.filter(s => s.enabled).map(s => s.id)
    if (selectedSections.length === 0) {
      toast.error(t('noSectionsSelected'))
      return
    }

    setGenerating(true)
    try {
      const reportTitle = title || `Analytics Report - ${new Date().toLocaleDateString()}`
      await onGenerate(reportTitle, selectedSections)
      onClose()
    } catch (error) {
      console.error('Report generation error:', error)
      toast.error(t('generateError'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Report Title */}
          <div className="space-y-2">
            <Label htmlFor="reportTitle">{t('reportTitle')}</Label>
            <Input
              id="reportTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
            />
          </div>

          {/* Section Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('sections')}</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {t('selectAll')}
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  {t('selectNone')}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto border rounded-lg p-3">
              {sections.map((section) => (
                <div key={section.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={section.id}
                    checked={section.enabled}
                    onCheckedChange={() => toggleSection(section.id)}
                  />
                  <Label htmlFor={section.id} className="text-sm cursor-pointer">
                    {section.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('generating')}
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                {t('generate')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
