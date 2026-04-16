'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { format } from 'date-fns'
import { enUS, de, es } from 'date-fns/locale'
import { useTranslations, useLocale } from 'next-intl'
import { Phone, Clock, User, Bot, RefreshCw, StickyNote, AlertCircle, Info, MessageSquare, CheckCircle2, XCircle, HelpCircle, Target, Loader2, Wrench, ArrowRightLeft, Mic, Hourglass } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { getCallSession } from '@/lib/actions/calls'
import { getCallNotes } from '@/lib/actions/call-tools'
import { getCallCriteriaResults, triggerCallEvaluation, triggerCSATEvaluation } from '@/lib/actions/call-criteria'
import { getCallExtractedVariables, triggerVariableReextraction } from '@/lib/actions/variables'
import { formatPhoneNumber } from '@/lib/utils/format-phone'
import { ExtractedVariablesDisplay } from '@/components/variables/extracted-variables-display'
import { createClient } from '@/lib/supabase/client'
import { findVoiceName } from '@/lib/constants/voices'
import type { ExtractedVariable } from '@/types/variables'
import type { CallNote } from '@/types/call-tools'
import { debug } from '@/lib/utils/logger'
import { toast } from 'sonner'

interface CallDetailsModalProps {
  callSessionId: string
  open: boolean
  onClose: () => void
}

interface CallSessionDetail {
  id: string
  caller_number: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  csat_score: number | null
  csat_reasoning: string | null
  assistants: { name: string } | null
  phone_numbers: { phone_number: string } | null
  [key: string]: unknown
}

interface CallTranscriptDetail {
  id: string
  speaker: string
  text: string
  timestamp: string | null
  metadata: {
    tool_name?: string
    arguments?: Record<string, unknown>
    result_preview?: string
    assistant_name?: string
    assistant_avatar_url?: string | null
    voice_id?: string
    voice_provider?: string
    voice_language?: string
    llm_model?: string
    llm_provider?: string
    llm_temperature?: number | null
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
    performance?: { ttftMs: number; totalTimeMs: number; tokensPerSecond: number }
    response_latency_ms?: number
    barge_in?: boolean
    hesitation?: boolean
    wait_for_turn_filler?: boolean
    partial_turn?: boolean
    combined_from_partial?: boolean
    [key: string]: unknown
  } | null
}

interface CriterionResult {
  id: string
  criterion_id: string
  passed: boolean | null  // null = inconclusive
  reasoning: string | null
  evaluated_at: string
  criterion: {
    id: string
    name: string
    description: string
    position: number
  } | null
}

export function CallDetailsModal({
  callSessionId,
  open,
  onClose,
}: CallDetailsModalProps) {
  const t = useTranslations('calls.details')
  const tStatus = useTranslations('calls.status')
  const tCriteria = useTranslations('calls.criteria')
  const tCommon = useTranslations('common')
  const tCsat = useTranslations('csatScore')
  const locale = useLocale()
  const dateLocale = locale === 'de' ? de : locale === 'es' ? es : enUS
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<CallSessionDetail | null>(null)
  const [transcripts, setTranscripts] = useState<CallTranscriptDetail[]>([])
  const [extractedVariables, setExtractedVariables] = useState<ExtractedVariable[]>([])
  const [callNotes, setCallNotes] = useState<CallNote[]>([])
  const [criteriaResults, setCriteriaResults] = useState<CriterionResult[]>([])
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [isEvaluatingCSAT, setIsEvaluatingCSAT] = useState(false)
  const [isReExtracting, setIsReExtracting] = useState(false)
  const evaluationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const csatEvaluationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reExtractTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  // Live calls have no ended_at; completed calls do.
  const isLiveCall = !session?.ended_at

  /**
   * Computed transcript list for display:
   * - Post-call: hide all partial_turn entries (they're superseded by the final combined entry)
   * - Live call: show only the LAST partial_turn entry with an "awaiting more input" flag;
   *   older partials are hidden since they're already included in the latest one's text.
   * - wait_for_turn_filler entries are merged inline into the adjacent user entry as subtle segments.
   */
  type FillerSegment = { text: string; isFiller: boolean }
  type DisplayTranscript = CallTranscriptDetail & { isAwaitingMoreInput?: boolean; segments?: FillerSegment[] }
  const displayTranscripts = useMemo((): DisplayTranscript[] => {
    // Step 1: handle partial turns
    let partialFiltered: DisplayTranscript[]
    if (!isLiveCall) {
      partialFiltered = transcripts.filter((t) => !t.metadata?.partial_turn)
    } else {
      let lastPartialIdx = -1
      for (let i = transcripts.length - 1; i >= 0; i--) {
        if (transcripts[i].metadata?.partial_turn) {
          lastPartialIdx = i
          break
        }
      }
      partialFiltered = transcripts.reduce<DisplayTranscript[]>((acc, t, i) => {
        if (t.metadata?.partial_turn) {
          if (i === lastPartialIdx) acc.push({ ...t, isAwaitingMoreInput: true })
          // older partial entries are dropped
        } else {
          acc.push(t)
        }
        return acc
      }, [])
    }

    // Step 2: merge wait_for_turn_filler entries into adjacent user entries
    const result: DisplayTranscript[] = []
    let i = 0
    while (i < partialFiltered.length) {
      const current = partialFiltered[i]
      if (current.speaker === 'user') {
        const segments: FillerSegment[] = [{ text: current.text, isFiller: false }]
        let j = i + 1
        let mergedAny = false
        let awaitingMore = current.isAwaitingMoreInput ?? false
        while (j < partialFiltered.length) {
          const next = partialFiltered[j]
          if (next.speaker === 'assistant' && next.metadata?.wait_for_turn_filler === true) {
            segments.push({ text: next.text, isFiller: true })
            j++
            mergedAny = true
          } else if (mergedAny && next.speaker === 'user') {
            segments.push({ text: next.text, isFiller: false })
            if (next.isAwaitingMoreInput) awaitingMore = true
            j++
          } else {
            break
          }
        }
        if (mergedAny) {
          result.push({ ...current, segments, isAwaitingMoreInput: awaitingMore })
        } else {
          result.push(current)
        }
        i = j
      } else if (current.speaker === 'assistant' && current.metadata?.wait_for_turn_filler === true) {
        // Orphaned filler with no preceding user — skip
        i++
      } else {
        result.push(current)
        i++
      }
    }
    return result
  }, [transcripts, isLiveCall])

  const loadCallDetails = useCallback(async () => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional loading state reset at start of async operation
    setLoading(true)
    const [result, notesResult, criteriaResult] = await Promise.all([
      getCallSession(callSessionId),
      getCallNotes(callSessionId),
      getCallCriteriaResults(callSessionId),
    ])
    if (!result.error && result.session) {
      setSession(result.session as unknown as CallSessionDetail)
      setTranscripts(result.transcripts as unknown as CallTranscriptDetail[])
      setExtractedVariables(result.extractedVariables as unknown as ExtractedVariable[])
    }
    if (!notesResult.error) {
      setCallNotes(notesResult.notes)
    }
    if (!criteriaResult.error) {
      setCriteriaResults(criteriaResult.results)
    }
    setLoading(false)
  }, [callSessionId])

  const handleReEvaluate = async () => {
    setIsEvaluating(true)

    // Clear any existing timeout
    if (evaluationTimeoutRef.current) {
      clearTimeout(evaluationTimeoutRef.current)
    }

    const { error } = await triggerCallEvaluation(callSessionId)
    if (error) {
      toast.error(error)
      setIsEvaluating(false)
    } else {
      toast.success(tCriteria('evaluationStarted'))
      // Set a maximum timeout of 60 seconds in case realtime updates don't come through
      evaluationTimeoutRef.current = setTimeout(() => {
        setIsEvaluating(false)
      }, 60000)
    }
  }

  const handleEvaluateCSAT = async () => {
    setIsEvaluatingCSAT(true)

    // Clear any existing timeout
    if (csatEvaluationTimeoutRef.current) {
      clearTimeout(csatEvaluationTimeoutRef.current)
    }

    const { error } = await triggerCSATEvaluation(callSessionId)
    if (error) {
      toast.error(error)
      setIsEvaluatingCSAT(false)
    } else {
      toast.success(t('csatEvaluationStarted'))
      // Set a maximum timeout of 30 seconds for CSAT evaluation
      csatEvaluationTimeoutRef.current = setTimeout(() => {
        setIsEvaluatingCSAT(false)
      }, 30000)
    }
  }

  const handleReExtractVariables = async () => {
    setIsReExtracting(true)

    if (reExtractTimeoutRef.current) {
      clearTimeout(reExtractTimeoutRef.current)
    }

    // Clear existing variables so realtime inserts repopulate them
    setExtractedVariables([])

    const { error } = await triggerVariableReextraction(callSessionId)
    if (error) {
      toast.error(error)
      setIsReExtracting(false)
    } else {
      toast.success(t('variableReExtractionStarted'))
      // Set a maximum timeout of 60 seconds
      reExtractTimeoutRef.current = setTimeout(() => {
        setIsReExtracting(false)
      }, 60000)
    }
  }

  // Initial load
  useEffect(() => {
    if (open && callSessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- loadCallDetails intentionally sets loading state at the start of the async fetch
      loadCallDetails()
    }
  }, [open, callSessionId, loadCallDetails])

  // Real-time subscriptions
  useEffect(() => {
    if (!open || !callSessionId) return

    debug('[CallDetails] Setting up realtime subscriptions for:', callSessionId)

    // Subscribe to call_sessions updates (status changes)
    const sessionsChannel = supabase
      .channel(`call_session_${callSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_sessions',
          filter: `id=eq.${callSessionId}`,
        },
        (payload) => {
          debug('[CallDetails] Session updated:', payload)
          setSession((prev) => prev ? { ...prev, ...payload.new as Partial<CallSessionDetail> } : prev)
          // If CSAT score was updated, stop the evaluation spinner
          if (payload.new.csat_score !== null && payload.new.csat_score !== undefined) {
            setIsEvaluatingCSAT(false)
            if (csatEvaluationTimeoutRef.current) {
              clearTimeout(csatEvaluationTimeoutRef.current)
            }
          }
        }
      )
      .subscribe((status) => {
        debug('[CallDetails] Sessions channel status:', status)
      })

    // Subscribe to new transcripts (INSERT) and partial_turn metadata updates (UPDATE)
    const transcriptsChannel = supabase
      .channel(`call_transcripts_${callSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_transcripts',
          filter: `call_session_id=eq.${callSessionId}`,
        },
        (payload) => {
          debug('[CallDetails] New transcript:', payload)
          setTranscripts((prev) => [...prev, payload.new as unknown as CallTranscriptDetail])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_transcripts',
          filter: `call_session_id=eq.${callSessionId}`,
        },
        (payload) => {
          debug('[CallDetails] Updated transcript:', payload)
          const updated = payload.new as unknown as CallTranscriptDetail
          setTranscripts((prev) => prev.map((t) => t.id === updated.id ? updated : t))
        }
      )
      .subscribe((status) => {
        debug('[CallDetails] Transcripts channel status:', status)
      })

    // Subscribe to extracted variables
    const variablesChannel = supabase
      .channel(`extracted_variables_${callSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'extracted_variables',
          filter: `call_session_id=eq.${callSessionId}`,
        },
        (payload) => {
          debug('[CallDetails] Variable change:', payload.eventType, payload)
          if (payload.eventType === 'INSERT') {
            setExtractedVariables((prev) => [...prev, payload.new as unknown as ExtractedVariable])
          } else if (payload.eventType === 'DELETE') {
            setExtractedVariables((prev) => prev.filter((v) => v.id !== (payload.old as { id?: string }).id))
          }

          // Reset re-extraction timeout — after 5s of no more changes, consider done
          if (reExtractTimeoutRef.current) {
            clearTimeout(reExtractTimeoutRef.current)
          }
          reExtractTimeoutRef.current = setTimeout(() => {
            setIsReExtracting(false)
          }, 5000)
        }
      )
      .subscribe((status) => {
        debug('[CallDetails] Variables channel status:', status)
      })

    // Subscribe to call notes
    const notesChannel = supabase
      .channel(`call_notes_${callSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_notes',
          filter: `call_session_id=eq.${callSessionId}`,
        },
        (payload) => {
          debug('[CallDetails] New note added:', payload)
          setCallNotes((prev) => [...prev, payload.new as unknown as CallNote])
        }
      )
      .subscribe((status) => {
        debug('[CallDetails] Notes channel status:', status)
      })

    // Subscribe to criteria results (for real-time evaluation updates)
    const criteriaChannel = supabase
      .channel(`call_criteria_results_${callSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT and UPDATE (upsert creates both)
          schema: 'public',
          table: 'call_criteria_results',
          filter: `call_session_id=eq.${callSessionId}`,
        },
        (payload) => {
          debug('[CallDetails] Criteria result changed:', payload)
          // Reload all criteria results to get joined criterion data
          getCallCriteriaResults(callSessionId).then(({ results, error }) => {
            if (!error) {
              setCriteriaResults(results)

              // Reset the evaluation completion timeout
              // After 10 seconds of no more updates, consider evaluation complete
              // (LLM calls can take variable time, so we need a generous timeout)
              if (evaluationTimeoutRef.current) {
                clearTimeout(evaluationTimeoutRef.current)
              }
              evaluationTimeoutRef.current = setTimeout(() => {
                setIsEvaluating(false)
              }, 10000)
            }
          })
        }
      )
      .subscribe((status) => {
        debug('[CallDetails] Criteria channel status:', status)
      })

    return () => {
      debug('[CallDetails] Cleaning up realtime subscriptions')
      supabase.removeChannel(sessionsChannel)
      supabase.removeChannel(transcriptsChannel)
      supabase.removeChannel(variablesChannel)
      supabase.removeChannel(notesChannel)
      supabase.removeChannel(criteriaChannel)
      if (evaluationTimeoutRef.current) {
        clearTimeout(evaluationTimeoutRef.current)
      }
      if (csatEvaluationTimeoutRef.current) {
        clearTimeout(csatEvaluationTimeoutRef.current)
      }
      if (reExtractTimeoutRef.current) {
        clearTimeout(reExtractTimeoutRef.current)
      }
    }
  }, [open, callSessionId, supabase])

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatMs = (ms: number) =>
    ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-400/10 dark:text-blue-400 dark:border-blue-800">
            {tStatus('active')}
          </Badge>
        )
      case 'completed':
        return <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">{tStatus('completed')}</Badge>
      case 'failed':
        return <Badge variant="destructive">{tStatus('failed')}</Badge>
      default:
        return <Badge variant="secondary">{tStatus('unknown')}</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-neutral-500">{t('loading')}</div>
          </div>
        ) : !session ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-neutral-500">{t('notFound')}</div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-5 gap-6">
            {/* Left Column - Call Info, Variables, Notes */}
            <div className="col-span-2 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1">
                {/* Call Info */}
                <div className="space-y-3 pb-4">
                  <h3 className="font-semibold text-sm text-neutral-500 uppercase tracking-wide">{t('callInfo')}</h3>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-500">{t('caller')}</span>
                      <span className="font-mono text-sm">{formatPhoneNumber(session.caller_number)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-500">{t('status')}</span>
                      {getStatusBadge(session.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-500">{t('assistant')}</span>
                      <span className="text-sm">{session.assistants?.name || t('none')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-500">{t('phone')}</span>
                      <span className="font-mono text-sm">{formatPhoneNumber(session.phone_numbers?.phone_number)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-500">{t('started')}</span>
                      <span className="text-sm">
                        {session.started_at ? format(new Date(session.started_at), 'PP p', { locale: dateLocale }) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-500">{t('duration')}</span>
                      <span className="text-sm">{formatDuration(session.duration_seconds)}</span>
                    </div>
                  </div>
                </div>

                {/* Extracted Variables */}
                <div className="py-4 border-t">
                  <ExtractedVariablesDisplay
                    variables={extractedVariables}
                    onReExtract={handleReExtractVariables}
                    isReExtracting={isReExtracting}
                    reExtractLabel={t('reExtractVariables')}
                  />
                </div>

                {/* Criteria Results */}
                <div className="py-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      {tCriteria('title')}
                      {criteriaResults.length > 0 && (
                        <span className="text-sm font-normal text-neutral-500">
                          ({criteriaResults.filter(r => r.passed === true).length}/{criteriaResults.length})
                        </span>
                      )}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReEvaluate}
                      disabled={isEvaluating}
                    >
                      {isEvaluating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-1">{tCriteria('reEvaluate')}</span>
                    </Button>
                  </div>
                  {criteriaResults.length === 0 ? (
                    <p className="text-sm text-neutral-500">{tCriteria('notEvaluated')}</p>
                  ) : (
                    <div className="space-y-2">
                      {criteriaResults.map((result) => (
                        <div
                          key={result.id}
                          className={`rounded-lg border p-3 ${
                            result.passed === true
                              ? 'border-lime-200 dark:border-lime-800 bg-lime-50 dark:bg-lime-950/30'
                              : result.passed === false
                                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
                                : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/30'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {result.passed === true ? (
                              <CheckCircle2 className="h-4 w-4 text-lime-600 mt-0.5 flex-shrink-0" />
                            ) : result.passed === false ? (
                              <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <HelpCircle className="h-4 w-4 text-neutral-400 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{result.criterion?.name}</p>
                              {result.reasoning && (
                                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                                  {result.reasoning}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CSAT Score */}
                <div className="py-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      {tCsat('label')}
                      {session?.csat_score !== null && session?.csat_score !== undefined && (
                        <span className="text-sm font-normal text-neutral-500">
                          ({tCsat('scoreOutOf5', { score: session.csat_score })})
                        </span>
                      )}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEvaluateCSAT}
                      disabled={isEvaluatingCSAT}
                    >
                      {isEvaluatingCSAT ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-1">{session?.csat_score !== null && session?.csat_score !== undefined ? t('reEvaluate') : t('evaluate')}</span>
                    </Button>
                  </div>
                  {session?.csat_score !== null && session?.csat_score !== undefined ? (
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                        session.csat_score >= 4
                          ? 'bg-lime-500/10 text-lime-700 dark:bg-lime-400/10 dark:text-lime-400'
                          : session.csat_score === 3
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {session.csat_score}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {session.csat_score >= 4 ? tCsat('good') : session.csat_score === 3 ? tCsat('neutral') : tCsat('poor')}
                        </p>
                        {session.csat_reasoning && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            {session.csat_reasoning}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">{t('csatNotEvaluated')}</p>
                  )}
                </div>

                {/* Call Notes */}
                {callNotes.length > 0 && (
                  <div className="py-4 border-t">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <StickyNote className="h-4 w-4" />
                      {t('notes')} ({callNotes.length})
                    </h3>
                    <div className="space-y-2">
                      {callNotes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3"
                        >
                          <div className="flex items-start gap-2">
                            {note.priority === 'high' ? (
                              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            ) : note.category === 'action_required' ? (
                              <MessageSquare className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{note.content}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {note.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {note.category.replace('_', ' ')}
                                  </Badge>
                                )}
                                {note.priority && note.priority !== 'low' && (
                                  <Badge
                                    variant={note.priority === 'high' ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {note.priority}
                                  </Badge>
                                )}
                                <span className="text-xs text-neutral-500">
                                  {format(new Date(note.created_at), 'HH:mm:ss')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right Column - Transcript */}
            <div className="col-span-3 overflow-hidden flex flex-col border-l pl-6">
              <h3 className="font-semibold mb-3">{t('conversationTranscript')}</h3>
              <ScrollArea className="flex-1 pr-4">
                {transcripts.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500">
                    {t('noTranscript')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayTranscripts.map((transcript, index) => {
                      if (transcript.speaker === 'tool') {
                        const isTransfer = transcript.metadata?.tool_name === 'transfer_to_agent'
                        const hasToolData = transcript.metadata?.arguments || transcript.metadata?.result_preview
                        const badge = (
                          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full whitespace-nowrap">
                            {isTransfer ? (
                              <ArrowRightLeft className="h-3 w-3" />
                            ) : (
                              <Wrench className="h-3 w-3" />
                            )}
                            <span>{transcript.text}</span>
                            {transcript.timestamp && (
                              <span className="text-neutral-400 dark:text-neutral-500">· {format(new Date(transcript.timestamp), 'HH:mm:ss')}</span>
                            )}
                          </div>
                        )
                        return (
                          <div key={transcript.id || index} className="flex items-center gap-2 py-0.5">
                            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                            {hasToolData ? (
                              <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="focus:outline-none cursor-default">{badge}</button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs max-w-80 space-y-2 p-3">
                                    {transcript.metadata?.arguments && Object.keys(transcript.metadata.arguments).length > 0 && (
                                      <div>
                                        <div className="font-semibold text-neutral-400 mb-1">Arguments</div>
                                        <pre className="whitespace-pre-wrap break-all font-mono">{JSON.stringify(transcript.metadata.arguments, null, 2)}</pre>
                                      </div>
                                    )}
                                    {transcript.metadata?.result_preview && (
                                      <div>
                                        <div className="font-semibold text-neutral-400 mb-1">Result</div>
                                        <div className="whitespace-pre-wrap break-all">{transcript.metadata.result_preview}</div>
                                      </div>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : badge}
                            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                          </div>
                        )
                      }

                      const isUser = transcript.speaker === 'user'
                      const isHesitation = !isUser && transcript.metadata?.hesitation === true
                      return (
                        <div
                          key={transcript.id || index}
                          className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`flex gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            {!isUser && transcript.metadata?.assistant_avatar_url ? (
                              <img
                                src={transcript.metadata.assistant_avatar_url}
                                alt={transcript.metadata.assistant_name || ''}
                                className="flex-shrink-0 w-7 h-7 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                                  isUser
                                    ? 'bg-lime-100 dark:bg-lime-900/30'
                                    : isHesitation
                                      ? 'bg-amber-100 dark:bg-amber-900/30'
                                      : 'bg-blue-100 dark:bg-blue-900'
                                }`}
                              >
                                {isUser ? (
                                  <User className="h-3.5 w-3.5 text-lime-700 dark:text-lime-400" />
                                ) : isHesitation ? (
                                  <Hourglass className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                ) : (
                                  <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                )}
                              </div>
                            )}
                            <div
                              className={`rounded-lg px-3 py-2 ${
                                isUser
                                  ? 'bg-lime-50 dark:bg-lime-950'
                                  : isHesitation
                                    ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50'
                                    : 'bg-neutral-100 dark:bg-neutral-800'
                              }`}
                            >
                              <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5 flex items-center gap-1">
                                <span>
                                  {isUser
                                    ? t('user')
                                    : (transcript.metadata?.assistant_name || t('assistantLabel'))}
                                  {transcript.timestamp &&
                                    ` · ${format(new Date(transcript.timestamp), 'HH:mm:ss')}`}
                                </span>
                                {isUser && transcript.metadata?.barge_in && (
                                  <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-orange-200 dark:bg-orange-800 hover:bg-orange-300 dark:hover:bg-orange-700 flex-shrink-0">
                                          <Info className="h-2.5 w-2.5 text-orange-600 dark:text-orange-400" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <Mic className="h-3 w-3 flex-shrink-0 text-orange-500" />
                                          <span>{t('bargeIn')}</span>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {!isUser && !isHesitation && (transcript.metadata?.voice_id || transcript.metadata?.performance || transcript.metadata?.usage || transcript.metadata?.response_latency_ms !== undefined) && (
                                  <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 flex-shrink-0">
                                          <Info className="h-2.5 w-2.5 text-neutral-500 dark:text-neutral-400" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs space-y-1 max-w-56">
                                        {transcript.metadata?.voice_id && (
                                          <>
                                            <div className="flex items-center gap-1.5">
                                              <Mic className="h-3 w-3 flex-shrink-0" />
                                              <span className="font-medium">{transcript.metadata.voice_provider}</span>
                                              <span className="text-neutral-400">·</span>
                                              <span className="truncate">{findVoiceName(transcript.metadata.voice_provider ?? null, transcript.metadata.voice_id ?? null) ?? transcript.metadata.voice_id}</span>
                                            </div>
                                            {transcript.metadata.voice_language && (
                                              <div className="text-neutral-400 pl-4">{transcript.metadata.voice_language}</div>
                                            )}
                                          </>
                                        )}
                                        {transcript.metadata?.llm_model && (
                                          <div className="flex items-center gap-1.5 pt-0.5 border-t border-neutral-200 dark:border-neutral-700">
                                            <Bot className="h-3 w-3 flex-shrink-0" />
                                            <span className="font-medium">{transcript.metadata.llm_provider}</span>
                                            <span className="text-neutral-400">·</span>
                                            <span className="truncate">{transcript.metadata.llm_model}</span>
                                          </div>
                                        )}
                                        {transcript.metadata?.llm_temperature !== null && transcript.metadata?.llm_temperature !== undefined && (
                                          <div className="text-neutral-400 pl-4">{t('tempLabel')} {transcript.metadata.llm_temperature}</div>
                                        )}
                                        {transcript.metadata?.usage && (
                                          <div className="pt-0.5 border-t border-neutral-200 dark:border-neutral-700 space-y-0.5">
                                            <div className="flex justify-between gap-3">
                                              <span className="text-neutral-400">{t('promptTokens')}</span>
                                              <span className="font-mono">{transcript.metadata.usage.promptTokens}</span>
                                            </div>
                                            <div className="flex justify-between gap-3">
                                              <span className="text-neutral-400">{t('completionTokens')}</span>
                                              <span className="font-mono">{transcript.metadata.usage.completionTokens}</span>
                                            </div>
                                            <div className="flex justify-between gap-3">
                                              <span className="text-neutral-400">{t('totalTokens')}</span>
                                              <span className="font-mono">{transcript.metadata.usage.totalTokens}</span>
                                            </div>
                                          </div>
                                        )}
                                        {(transcript.metadata?.performance || transcript.metadata?.response_latency_ms !== undefined) && (
                                          <div className="pt-0.5 border-t border-neutral-200 dark:border-neutral-700 space-y-0.5">
                                            {transcript.metadata?.response_latency_ms !== undefined && (
                                              <div className="flex justify-between gap-3">
                                                <span className="text-neutral-400">{t('responseLatency')}</span>
                                                <span className="font-mono">{formatMs(transcript.metadata.response_latency_ms)}</span>
                                              </div>
                                            )}
                                            {transcript.metadata?.performance?.ttftMs !== undefined && (
                                              <div className="flex justify-between gap-3">
                                                <span className="text-neutral-400">{t('ttft')}</span>
                                                <span className="font-mono">{formatMs(transcript.metadata.performance.ttftMs)}</span>
                                              </div>
                                            )}
                                            {transcript.metadata?.performance?.totalTimeMs !== undefined && (
                                              <div className="flex justify-between gap-3">
                                                <span className="text-neutral-400">{t('totalTime')}</span>
                                                <span className="font-mono">{formatMs(transcript.metadata.performance.totalTimeMs)}</span>
                                              </div>
                                            )}
                                            {transcript.metadata?.performance?.tokensPerSecond !== undefined && (
                                              <div className="flex justify-between gap-3">
                                                <span className="text-neutral-400">{t('tps')}</span>
                                                <span className="font-mono">{transcript.metadata.performance.tokensPerSecond.toFixed(1)}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <div className={`text-sm ${isHesitation ? 'italic text-amber-800 dark:text-amber-300' : ''}`}>
                                {transcript.segments ? (
                                  transcript.segments.map((segment, segIdx) =>
                                    segment.isFiller ? (
                                      <span key={segIdx} className="italic text-neutral-400 dark:text-neutral-500 text-xs mx-1 opacity-80">
                                        {segment.text}
                                      </span>
                                    ) : (
                                      <span key={segIdx}>{segment.text}</span>
                                    )
                                  )
                                ) : (
                                  transcript.text
                                )}
                                {transcript.isAwaitingMoreInput && (
                                  <span className="inline-flex gap-0.5 ml-2 items-end translate-y-[-1px]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-lime-600 dark:bg-lime-400 animate-bounce [animation-delay:0ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-lime-600 dark:bg-lime-400 animate-bounce [animation-delay:150ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-lime-600 dark:bg-lime-400 animate-bounce [animation-delay:300ms]" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
