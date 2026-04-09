'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  User,
  Bot,
  Clock,
  Lightbulb,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Play,
  Save,
  RotateCcw,
  Zap,
  Cpu,
  Timer,
} from 'lucide-react'
import { getPromptImprovementSuggestions, applyPromptChanges } from '@/lib/actions/autotest'
import type { TestRun, EvaluationResult, ConversationLogEntry } from '@/types/autotest'

interface PromptSuggestion {
  analysis: string
  changes: string[]
  revisedPrompt: string
  assistantId: string
}

interface TestRunModalProps {
  run: TestRun | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onTestWithPrompt?: (prompt: string) => void
}

export function TestRunModal({ run, open, onOpenChange, onTestWithPrompt }: TestRunModalProps) {
  const t = useTranslations('autotest')
  const locale = useLocale()
  const [suggestion, setSuggestion] = useState<PromptSuggestion | null>(null)
  const [editedPrompt, setEditedPrompt] = useState<string>('')
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(true)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const [applyingPrompt, setApplyingPrompt] = useState(false)
  const [promptApplied, setPromptApplied] = useState(false)

  const handleGetSuggestions = async () => {
    if (!run) return
    setSuggestionsLoading(true)
    setSuggestionsError(null)
    setPromptApplied(false)

    try {
      const result = await getPromptImprovementSuggestions(run.id, locale)
      if (result.error) {
        setSuggestionsError(result.error)
      } else if (result.analysis && result.revisedPrompt && result.assistantId) {
        setSuggestion({
          analysis: result.analysis,
          changes: result.changes || [],
          revisedPrompt: result.revisedPrompt,
          assistantId: result.assistantId,
        })
        setEditedPrompt(result.revisedPrompt)
      }
    } catch (error) {
      setSuggestionsError(String(error))
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const handleApplyPrompt = async () => {
    if (!suggestion) return
    setApplyingPrompt(true)

    try {
      const result = await applyPromptChanges(suggestion.assistantId, editedPrompt)
      if (result.error) {
        setSuggestionsError(result.error)
      } else {
        setPromptApplied(true)
      }
    } catch (error) {
      setSuggestionsError(String(error))
    } finally {
      setApplyingPrompt(false)
    }
  }

  const handleApplyTestedPrompt = async (promptToApply: string) => {
    if (!run) return
    setApplyingPrompt(true)

    try {
      const result = await applyPromptChanges(run.assistant_id, promptToApply)
      if (result.error) {
        setSuggestionsError(result.error)
      } else {
        setPromptApplied(true)
      }
    } catch (error) {
      setSuggestionsError(String(error))
    } finally {
      setApplyingPrompt(false)
    }
  }

  const handleTestWithPrompt = () => {
    if (onTestWithPrompt && editedPrompt) {
      onTestWithPrompt(editedPrompt)
    }
  }

  const handleResetPrompt = () => {
    if (suggestion) {
      setEditedPrompt(suggestion.revisedPrompt)
    }
  }

  // Reset suggestions when modal closes or run changes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSuggestion(null)
      setEditedPrompt('')
      setSuggestionsError(null)
      setPromptApplied(false)
    }
    onOpenChange(isOpen)
  }

  if (!run) return null

  const isRunning = run.status === 'pending' || run.status === 'running'
  const conversationLog = (run.conversation_log || []) as ConversationLogEntry[]
  const evaluation = run.evaluation_result as EvaluationResult | null
  const turnEvaluations = evaluation?.turn_evaluations || []
  const overallEvaluation = evaluation?.overall_evaluation

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-5 w-5 text-lime-600" />
      case 'partial':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-orange-500" />
      default:
        return <Clock className="h-5 w-5 text-neutral-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return (
          <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">
            {t('passed')}
          </Badge>
        )
      case 'partial':
        return (
          <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-800">
            {t('partial')}
          </Badge>
        )
      case 'failed':
        return <Badge variant="destructive">{t('failed')}</Badge>
      case 'error':
        return (
          <Badge className="bg-orange-500/10 text-orange-700 border-orange-200 dark:bg-orange-400/10 dark:text-orange-400 dark:border-orange-800">
            {t('error')}
          </Badge>
        )
      default:
        return <Badge variant="outline">{t('pending')}</Badge>
    }
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  // Group conversation turns with their evaluations
  let evalIndex = 0
  const conversationWithEvals = conversationLog.map((entry, index) => {
    if (entry.role === 'assistant') {
      const turnEval = turnEvaluations[evalIndex]
      evalIndex++
      return { ...entry, evaluation: turnEval, index }
    }
    return { ...entry, evaluation: null, index }
  })

  // Show running state
  if (isRunning) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
            <DialogTitle className="text-xl mb-2">{t('running')}</DialogTitle>
            <p className="text-sm text-neutral-500 text-center">
              {t('testsRunningDescription')}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(run.status)}
              <DialogTitle className="text-xl">
                {t('testResults')}
              </DialogTitle>
            </div>
            {getStatusBadge(run.status)}
          </div>
          <div className="flex items-center gap-4 text-sm text-neutral-500 mt-2">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(run.duration_ms)}
            </span>
            {run.completed_at && (
              <span>
                {new Date(run.completed_at).toLocaleString()}
              </span>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Error Message */}
            {run.error_message && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">
                  <strong>{t('error')}:</strong> {run.error_message}
                </p>
              </div>
            )}

            {/* Conversation Log */}
            <div className="space-y-3">
              {conversationWithEvals.map((entry, index) => (
                <div key={index} className="space-y-2">
                  {/* Message */}
                  <div
                    className={`flex gap-3 ${
                      entry.role === 'user' ? 'flex-row' : 'flex-row-reverse'
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        entry.role === 'user'
                          ? 'bg-blue-100 dark:bg-blue-900'
                          : 'bg-purple-100 dark:bg-purple-900'
                      }`}
                    >
                      {entry.role === 'user' ? (
                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      )}
                    </div>
                    <div
                      className={`flex-1 max-w-[80%] ${
                        entry.role === 'user' ? '' : 'text-right'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-neutral-500">
                          {entry.role === 'user' ? t('user') : t('assistantRole')}
                        </p>
                        {/* Performance metrics badge for assistant messages */}
                        {entry.role === 'assistant' && entry.model && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                            {entry.model}
                          </Badge>
                        )}
                      </div>
                      <div
                        className={`inline-block p-3 rounded-lg ${
                          entry.role === 'user'
                            ? 'bg-blue-50 dark:bg-blue-950/30 text-left'
                            : 'bg-purple-50 dark:bg-purple-950/30 text-left'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                        {/* Performance metrics for assistant responses */}
                        {entry.role === 'assistant' && entry.performance && (
                          <div className="mt-2 pt-2 border-t border-purple-200/50 dark:border-purple-800/50 flex flex-wrap gap-3 text-[10px] text-neutral-500">
                            <span className="flex items-center gap-1" title={t('timeToFirstToken')}>
                              <Timer className="h-3 w-3" />
                              {t('ttft')}: {entry.performance.ttftMs.toFixed(0)}ms
                            </span>
                            <span className="flex items-center gap-1" title={t('tokensPerSecond')}>
                              <Zap className="h-3 w-3" />
                              {t('tps')}: {entry.performance.tokensPerSecond.toFixed(1)}
                            </span>
                            <span className="flex items-center gap-1" title={t('totalTime')}>
                              <Clock className="h-3 w-3" />
                              {t('totalTimeShort')}: {formatDuration(entry.performance.totalTimeMs)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Evaluation for assistant turns */}
                  {entry.evaluation && (
                    <div className="ml-11 mr-11">
                      <div
                        className={`p-3 rounded-lg border ${
                          entry.evaluation.passed
                            ? 'bg-lime-50 dark:bg-lime-950/20 border-lime-200 dark:border-lime-800'
                            : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {entry.evaluation.passed ? (
                              <CheckCircle2 className="h-4 w-4 text-lime-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm font-medium">
                              {entry.evaluation.passed ? t('turnPassed') : t('turnFailed')}
                            </span>
                          </div>
                          <Badge variant="outline">
                            {t('scoreOutOf100', { score: entry.evaluation.score })}
                          </Badge>
                        </div>

                        {entry.evaluation.expected && (
                          <div className="mb-2">
                            <p className="text-xs text-neutral-500 mb-1">{t('expected')}:</p>
                            <p className="text-sm text-neutral-700 dark:text-neutral-300 italic">
                              {entry.evaluation.expected}
                            </p>
                          </div>
                        )}

                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            {entry.evaluation.reasoning}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Overall Evaluation */}
            {overallEvaluation && (
              <>
                <Separator className="my-4" />
                <div
                  className={`p-4 rounded-lg border ${
                    overallEvaluation.passed
                      ? 'bg-lime-50 dark:bg-lime-950/20 border-lime-200 dark:border-lime-800'
                      : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {overallEvaluation.passed ? (
                        <CheckCircle2 className="h-5 w-5 text-lime-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">{t('overallEvaluation')}</span>
                    </div>
                    <Badge
                      variant={overallEvaluation.passed ? 'default' : 'destructive'}
                      className={overallEvaluation.passed ? 'bg-lime-500' : ''}
                    >
                      {t('scoreOutOf100', { score: overallEvaluation.score })}
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {overallEvaluation.reasoning}
                  </p>
                </div>
              </>
            )}

            {/* Prompt Override Applied - Show option to apply to assistant */}
            {run.prompt_override && (
              <>
                <Separator className="my-4" />
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">{t('testedWithCustomPrompt')}</span>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {t('testedWithCustomPromptDescription')}
                  </p>

                  {/* Show/hide prompt */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      {t('viewTestedPrompt')}
                    </summary>
                    <div className="mt-2 p-3 bg-white dark:bg-neutral-900 rounded border text-sm font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                      {run.prompt_override}
                    </div>
                  </details>

                  {/* Success message */}
                  {promptApplied && (
                    <div className="flex items-center gap-2 p-2 bg-lime-50 dark:bg-lime-950/20 border border-lime-200 dark:border-lime-800 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-lime-600" />
                      <span className="text-sm text-lime-700 dark:text-lime-400">
                        {t('promptApplied')}
                      </span>
                    </div>
                  )}

                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleApplyTestedPrompt(run.prompt_override!)}
                    disabled={applyingPrompt || promptApplied}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {applyingPrompt ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {promptApplied ? t('applied') : t('applyTestedPrompt')}
                  </Button>
                </div>
              </>
            )}

            {/* Prompt Improvement Suggestions - Only show if no prompt override */}
            {!run.prompt_override && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3">
                  {!suggestion && !suggestionsLoading && (
                    <Button
                      variant="outline"
                      onClick={handleGetSuggestions}
                      className="w-full"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {t('suggestImprovements')}
                    </Button>
                  )}

              {suggestionsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-400 mr-2" />
                  <span className="text-sm text-neutral-500">{t('analyzingResults')}</span>
                </div>
              )}

              {suggestionsError && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {t('suggestionError')}: {suggestionsError}
                  </p>
                </div>
              )}

              {suggestion && (
                <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-4">
                  <button
                    onClick={() => setSuggestionsExpanded(!suggestionsExpanded)}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      <span className="font-medium">{t('promptImprovements')}</span>
                    </div>
                    {suggestionsExpanded ? (
                      <ChevronUp className="h-4 w-4 text-neutral-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-neutral-500" />
                    )}
                  </button>

                  {suggestionsExpanded && (
                    <div className="space-y-4">
                      {/* Analysis */}
                      <div>
                        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                          {t('analysis')}
                        </p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {suggestion.analysis}
                        </p>
                      </div>

                      {/* Changes */}
                      {suggestion.changes.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                            {t('suggestedChanges')}
                          </p>
                          <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
                            {suggestion.changes.map((change, index) => (
                              <li key={index}>{change}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Revised Prompt Editor */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            {t('revisedPrompt')}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetPrompt}
                            className="h-7 text-xs"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            {t('reset')}
                          </Button>
                        </div>
                        <Textarea
                          value={editedPrompt}
                          onChange={(e) => setEditedPrompt(e.target.value)}
                          className="min-h-[150px] text-sm font-mono bg-white dark:bg-neutral-900"
                          placeholder={t('revisedPromptPlaceholder')}
                        />
                      </div>

                      {/* Success message */}
                      {promptApplied && (
                        <div className="flex items-center gap-2 p-2 bg-lime-50 dark:bg-lime-950/20 border border-lime-200 dark:border-lime-800 rounded-lg">
                          <CheckCircle2 className="h-4 w-4 text-lime-600" />
                          <span className="text-sm text-lime-700 dark:text-lime-400">
                            {t('promptApplied')}
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {onTestWithPrompt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTestWithPrompt}
                            className="flex-1"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            {t('testWithChanges')}
                          </Button>
                        )}
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleApplyPrompt}
                          disabled={applyingPrompt || promptApplied}
                          className="flex-1 bg-purple-600 hover:bg-purple-700"
                        >
                          {applyingPrompt ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          {promptApplied ? t('applied') : t('applyChanges')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
