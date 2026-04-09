'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Phone, Clock, Star, ExternalLink } from 'lucide-react'
import { getDrillDownCalls, type DrillDownCall } from '@/lib/actions/analytics'
import Link from 'next/link'

interface DrillDownFilters {
  date?: string
  hour?: number
  dayOfWeek?: number
  assistantId?: string
  status?: string
  csatMin?: number
  csatMax?: number
}

interface DrillDownModalProps {
  open: boolean
  onClose: () => void
  organizationId: string
  orgSlug: string
  filters: DrillDownFilters
  title: string
}

export function DrillDownModal({
  open,
  onClose,
  organizationId,
  orgSlug,
  filters,
  title,
}: DrillDownModalProps) {
  const t = useTranslations('analytics.drillDown')
  const tCsat = useTranslations('csatScore')
  const [calls, setCalls] = useState<DrillDownCall[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional loading state reset at start of async operation
      setLoading(true)
      getDrillDownCalls(organizationId, filters, 50)
        .then(setCalls)
        .finally(() => setLoading(false))
    }
  }, [open, organizationId, filters])

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">{t('completed')}</Badge>
      case 'failed':
        return <Badge variant="destructive">{t('failed')}</Badge>
      case 'active':
        return <Badge variant="secondary">{t('active')}</Badge>
      default:
        return <Badge variant="outline">{status || '-'}</Badge>
    }
  }

  const getCsatBadge = (score: number | null) => {
    if (score === null) return <span className="text-neutral-400">-</span>
    const colors: Record<number, string> = {
      1: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
      2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
      3: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
      4: 'bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300',
      5: 'bg-lime-500/10 text-lime-700 dark:bg-lime-400/10 dark:text-lime-400',
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors[score] || ''}`}>
        <Star className="h-3 w-3" />
        {score}
      </span>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('description', { count: calls.length })}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            {t('noCalls')}
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-neutral-950">
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">{t('caller')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('assistant')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('status')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('duration')}</th>
                  <th className="text-left py-2 px-3 font-medium">{tCsat('label')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('date')}</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} className="border-b hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-neutral-400" />
                        <span className="font-mono text-xs">{call.caller_number || '-'}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-neutral-600 dark:text-neutral-300">
                      {call.assistant_name || '-'}
                    </td>
                    <td className="py-2 px-3">
                      {getStatusBadge(call.status)}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-neutral-400" />
                        <span className="font-mono text-xs">{formatDuration(call.duration_seconds)}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {getCsatBadge(call.csat_score)}
                    </td>
                    <td className="py-2 px-3 text-xs text-neutral-500">
                      {formatDate(call.started_at)}
                    </td>
                    <td className="py-2 px-3">
                      <Link
                        href={`/${orgSlug}/calls?call=${call.id}`}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
