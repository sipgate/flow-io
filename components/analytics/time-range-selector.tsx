'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { TimeRange, DateRange } from '@/lib/actions/analytics'

interface TimeRangeSelectorProps {
  value: TimeRange
  customRange?: DateRange
  onChange: (range: TimeRange, customRange?: DateRange) => void
}

export function TimeRangeSelector({ value, customRange, onChange }: TimeRangeSelectorProps) {
  const t = useTranslations('analytics.timeRange')
  const tCommon = useTranslations('common')
  const [isOpen, setIsOpen] = useState(false)
  const [fromDate, setFromDate] = useState<Date | undefined>(customRange?.from)
  const [toDate, setToDate] = useState<Date | undefined>(customRange?.to)

  const presetRanges: { value: TimeRange; label: string }[] = [
    { value: '7d', label: t('days7') },
    { value: '30d', label: t('days30') },
    { value: '90d', label: t('days90') },
  ]

  const handlePresetClick = (range: TimeRange) => {
    setFromDate(undefined)
    setToDate(undefined)
    onChange(range)
  }

  const handleApplyCustomRange = () => {
    if (fromDate && toDate) {
      onChange('custom', { from: fromDate, to: toDate })
      setIsOpen(false)
    }
  }

  const formatDateRange = () => {
    if (customRange?.from && customRange?.to) {
      return `${format(customRange.from, 'MMM d')} - ${format(customRange.to, 'MMM d, yyyy')}`
    }
    return t('customRange')
  }

  return (
    <div className="flex gap-2">
      {presetRanges.map((range) => (
        <Button
          key={range.value}
          variant={value === range.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetClick(range.value)}
        >
          {range.label}
        </Button>
      ))}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={value === 'custom' ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
          >
            <CalendarIcon className="h-4 w-4" />
            {value === 'custom' ? formatDateRange() : t('custom')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-2">{t('from')}</p>
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={setFromDate}
                  disabled={(date) => date > new Date() || (toDate ? date > toDate : false)}
                  initialFocus
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">{t('to')}</p>
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={setToDate}
                  disabled={(date) => date > new Date() || (fromDate ? date < fromDate : false)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleApplyCustomRange}
                disabled={!fromDate || !toDate}
              >
                {t('apply')}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
