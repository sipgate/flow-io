'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { format } from 'date-fns'
import { Search, Phone, Clock, Variable, AlertCircle, StickyNote, ChevronLeft, ChevronRight, CheckCircle2, XCircle, HelpCircle, GitBranch } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getCallsCriteriaSummaries } from '@/lib/actions/call-criteria'
import type { CallCriteriaSummary } from '@/types/call-criteria'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { CallDetailsModal } from './call-details-modal'
import { formatPhoneNumber } from '@/lib/utils/format-phone'
import { createClient } from '@/lib/supabase/client'

interface ExtractedVar {
  id: string
  name: string
  label: string
  type: string
  value: string | null
  confidence: number | null
}

interface CallMetadata {
  extraction_status?: 'complete' | 'incomplete'
  missing_required_variables?: string[]
}

interface Call {
  id: string
  session_id: string
  caller_number: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  csat_score: number | null
  metadata: CallMetadata | null
  assistants: {
    id: string
    name: string
  } | null
  phone_numbers: {
    id: string
    phone_number: string
  } | null
  call_scenarios: {
    id: string
    name: string
  } | null
  extracted_variables: ExtractedVar[] | null
  call_notes: { id: string; content: string }[] | null
}

interface CallsTableProps {
  calls: Call[]
}

export function CallsTable({ calls }: CallsTableProps) {
  const t = useTranslations('calls')
  const tCommon = useTranslations('common')
  const tCsat = useTranslations('csatScore')
  const locale = useLocale()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [criteriaSummaries, setCriteriaSummaries] = useState<Record<string, CallCriteriaSummary>>({})

  // Filter calls
  const filteredCalls = calls.filter((call) => {
    const matchesSearch =
      search === '' ||
      call.caller_number?.includes(search) ||
      call.assistants?.name.toLowerCase().includes(search.toLowerCase()) ||
      call.session_id.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' || call.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Pagination
  const totalPages = Math.ceil(filteredCalls.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedCalls = filteredCalls.slice(startIndex, startIndex + pageSize)

  // Fetch criteria summaries for paginated calls
  const callIdsKey = paginatedCalls.map(c => c.id).join(',')

  useEffect(() => {
    const callIds = paginatedCalls.map(call => call.id)
    if (callIds.length === 0) return

    getCallsCriteriaSummaries(callIds).then(({ summaries, error }) => {
      if (!error) {
        setCriteriaSummaries(summaries)
      }
    })
  }, [callIdsKey])

  // Realtime subscription for criteria results updates
  useEffect(() => {
    const callIds = paginatedCalls.map(call => call.id)
    if (callIds.length === 0) return

    const supabase = createClient()

    // Subscribe to criteria results changes for all visible calls
    const channel = supabase
      .channel('calls_table_criteria_results')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_criteria_results',
        },
        (payload) => {
          // Check if this update is for one of our visible calls
          const changedCallId = (payload.new as { call_session_id?: string })?.call_session_id || (payload.old as { call_session_id?: string })?.call_session_id
          if (changedCallId && callIds.includes(changedCallId)) {
            console.log('[CallsTable] Criteria result changed, refreshing summaries')
            // Refresh summaries for all visible calls
            getCallsCriteriaSummaries(callIds).then(({ summaries, error }) => {
              if (!error) {
                setCriteriaSummaries(summaries)
              }
            })
          }
        }
      )
      .subscribe((status) => {
        console.log('[CallsTable] Criteria realtime channel status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [callIdsKey])

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setCurrentPage(1)
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-400/10 dark:text-blue-400 dark:border-blue-800">
            {t('status.active')}
          </Badge>
        )
      case 'completed':
        return <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">{t('status.completed')}</Badge>
      case 'failed':
        return <Badge variant="destructive">{t('status.failed')}</Badge>
      default:
        return <Badge variant="secondary">{t('status.unknown')}</Badge>
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-6 pb-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder={t('filters.searchPlaceholder')}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('filters.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
                <SelectItem value="active">{t('status.active')}</SelectItem>
                <SelectItem value="completed">{t('status.completed')}</SelectItem>
                <SelectItem value="failed">{t('status.failed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>

          {/* Table */}
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.caller')}</TableHead>
                  <TableHead>{t('table.assistant')}</TableHead>
                  <TableHead>{t('table.phoneNumber')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead>{t('table.criteria')}</TableHead>
                  <TableHead>{t('table.csat')}</TableHead>
                  <TableHead>{t('table.variables')}</TableHead>
                  <TableHead>{t('table.duration')}</TableHead>
                  <TableHead>{t('table.started')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCalls.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-8 text-neutral-500"
                    >
                      {t('empty.title')}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCalls.map((call) => (
                    <TableRow
                      key={call.id}
                      className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      onClick={() => setSelectedCall(call)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-neutral-400" />
                          <span className="font-mono text-sm">
                            {formatPhoneNumber(call.caller_number)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {call.call_scenarios && (
                            <span className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium">
                              <GitBranch className="h-3 w-3" />
                              {call.call_scenarios.name}
                            </span>
                          )}
                          <span>{call.assistants?.name || t('noAssistant')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPhoneNumber(call.phone_numbers?.phone_number)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(call.status)}
                          {call.call_notes && call.call_notes.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-amber-500 cursor-pointer">
                                  <StickyNote className="h-4 w-4" />
                                  <span className="text-xs">{call.call_notes.length}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs bg-neutral-900 text-neutral-100 p-2">
                                <div className="space-y-1">
                                  <p className="font-medium text-xs text-amber-400">{t('notes.title')}</p>
                                  {call.call_notes.map((note) => (
                                    <p key={note.id} className="text-xs truncate">
                                      {note.content}
                                    </p>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const summary = criteriaSummaries[call.id]

                          if (!summary || summary.total === 0) {
                            return <span className="text-neutral-400">-</span>
                          }

                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5 cursor-pointer">
                                  {summary.results.map((result, idx) => (
                                    <div
                                      key={`${call.id}-${result.criterion_id}-${idx}`}
                                      className={`w-2.5 h-2.5 rounded-full ${
                                        result.passed === true
                                          ? 'bg-lime-500'
                                          : result.passed === false
                                            ? 'bg-red-500'
                                            : 'bg-neutral-400'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs bg-neutral-900 text-neutral-100 p-2">
                                <div className="space-y-1">
                                  <p className="font-medium text-xs text-blue-400">{t('criteria.title')}</p>
                                  <div className="text-xs mb-2">
                                    <span className="text-lime-400">{summary.passed} {t('criteria.passed')}</span>
                                    {summary.failed > 0 && (
                                      <span className="text-red-400"> / {summary.failed} {t('criteria.failed')}</span>
                                    )}
                                    {summary.inconclusive > 0 && (
                                      <span className="text-neutral-400"> / {summary.inconclusive} {t('criteria.inconclusive')}</span>
                                    )}
                                  </div>
                                  {summary.results.map((result, idx) => (
                                    <div key={`${call.id}-tooltip-${result.criterion_id}-${idx}`} className="flex items-center gap-2 text-xs">
                                      {result.passed === true ? (
                                        <CheckCircle2 className="h-3 w-3 text-lime-600" />
                                      ) : result.passed === false ? (
                                        <XCircle className="h-3 w-3 text-red-500" />
                                      ) : (
                                        <HelpCircle className="h-3 w-3 text-neutral-400" />
                                      )}
                                      <span>{result.criterion_name}</span>
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        {call.csat_score !== null ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium cursor-pointer ${
                                call.csat_score >= 4
                                  ? 'bg-lime-500/10 text-lime-700 dark:bg-lime-400/10 dark:text-lime-400'
                                  : call.csat_score === 3
                                    ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400'
                                    : 'bg-red-500/10 text-red-600 dark:bg-red-400/10 dark:text-red-400'
                              }`}>
                                {call.csat_score}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">{tCsat('scoreWithLabel', { score: call.csat_score })}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const validVars = (call.extracted_variables || []).filter(
                            v => v.value && v.value !== 'null' && v.value.trim() !== ''
                          )
                          const isIncomplete = call.metadata?.extraction_status === 'incomplete'
                          const missingVars = call.metadata?.missing_required_variables || []

                          if (validVars.length === 0 && !isIncomplete) {
                            return <span className="text-neutral-400">-</span>
                          }

                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 cursor-pointer">
                                  {isIncomplete ? (
                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                  ) : (
                                    <Variable className="h-4 w-4 text-pink-500" />
                                  )}
                                  <div className="flex flex-wrap gap-1">
                                    {isIncomplete && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
                                      >
                                        {t('variables.incomplete')}
                                      </Badge>
                                    )}
                                    {validVars.slice(0, isIncomplete ? 1 : 2).map((v) => (
                                      <Badge
                                        key={v.id}
                                        variant="outline"
                                        className="text-xs max-w-[100px] truncate"
                                      >
                                        {v.value}
                                      </Badge>
                                    ))}
                                    {validVars.length > (isIncomplete ? 1 : 2) && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{validVars.length - (isIncomplete ? 1 : 2)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-sm bg-neutral-900 text-neutral-100 p-2">
                                <div className="space-y-1">
                                  <p className="font-medium text-xs text-pink-400">{t('variables.title')}</p>
                                  {validVars.map((v) => (
                                    <p key={v.id} className="text-xs">
                                      <span className="text-neutral-400">{v.label}:</span>{' '}
                                      <span className="font-mono">{v.value}</span>
                                    </p>
                                  ))}
                                  {isIncomplete && missingVars.length > 0 && (
                                    <>
                                      <p className="font-medium text-xs text-amber-400 mt-2">{t('variables.missingRequired')}</p>
                                      {missingVars.map((name) => (
                                        <p key={name} className="text-xs text-neutral-400">{name}</p>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-neutral-400" />
                          {formatDuration(call.duration_seconds)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {call.started_at
                          ? format(
                              new Date(call.started_at),
                              'MMM d, yyyy HH:mm'
                            )
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

        <CardContent className="p-6 pt-4">
          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <span>{tCommon('show')}</span>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>{tCommon('perPage')}</span>
            </div>

            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              {tCommon('showing', { start: filteredCalls.length === 0 ? 0 : startIndex + 1, end: Math.min(startIndex + pageSize, filteredCalls.length), total: filteredCalls.length })}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                {tCommon('previous')}
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                {tCommon('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Details Modal */}
      {selectedCall && (
        <CallDetailsModal
          callSessionId={selectedCall.id}
          open={!!selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </>
  )
}
