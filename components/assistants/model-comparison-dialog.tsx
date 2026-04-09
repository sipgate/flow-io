'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BarChart3,
  Loader2,
  Timer,
  Zap,
  Clock,
  Trophy,
  AlertCircle,
  Snowflake,
  Flame,
} from 'lucide-react'
import { compareModels, type ModelComparisonResult } from '@/lib/actions/model-comparison'

interface ModelComparisonDialogProps {
  systemPrompt: string
  disabled?: boolean
}

export function ModelComparisonDialog({ systemPrompt, disabled }: ModelComparisonDialogProps) {
  const t = useTranslations('assistants.modelComparison')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ModelComparisonResult[]>([])
  const [hasRun, setHasRun] = useState(false)

  const handleCompare = async () => {
    setLoading(true)
    setResults([])
    setHasRun(true)

    try {
      const { results: comparisonResults } = await compareModels({
        systemPrompt,
        testPrompt: 'Who are you? Answer in one sentence.',
      })
      setResults(comparisonResults)
    } catch (error) {
      console.error('Model comparison failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTps = (tps: number) => {
    return tps.toFixed(1)
  }

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
      case 'mistral':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      default: // google
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    }
  }

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'OpenAI'
      case 'mistral':
        return 'Mistral'
      default:
        return 'Google'
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Reset state when closing
      setResults([])
      setHasRun(false)
    }
  }

  // Group results by model name for display
  const groupedResults = results.reduce((acc, result) => {
    const key = result.model
    if (!acc[key]) {
      acc[key] = { cold: null, warm: null, provider: result.provider }
    }
    if (result.runType === 'cold') {
      acc[key].cold = result
    } else {
      acc[key].warm = result
    }
    return acc
  }, {} as Record<string, { cold: ModelComparisonResult | null; warm: ModelComparisonResult | null; provider: 'openai' | 'google' | 'mistral' }>)

  // Sort by warm TTFT (fastest first)
  const sortedModels = Object.entries(groupedResults).sort(([, a], [, b]) => {
    const aWarmTtft = a.warm?.performance?.ttftMs ?? Infinity
    const bWarmTtft = b.warm?.performance?.ttftMs ?? Infinity
    return aWarmTtft - bWarmTtft
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          {t('compare')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('description')}
          </p>

          {!hasRun && (
            <Button
              onClick={handleCompare}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('running')}
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {t('runComparison')}
                </>
              )}
            </Button>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
              <p className="text-sm text-neutral-500">{t('testingModels')}</p>
              <p className="text-xs text-neutral-400 mt-1">{t('mayTakeTime')}</p>
            </div>
          )}

          {sortedModels.length > 0 && (
            <ScrollArea className="max-h-[55vh]">
              <div className="space-y-3">
                {sortedModels.map(([modelName, { cold, warm, provider }], index) => (
                  <div
                    key={modelName}
                    className={`p-4 rounded-lg border ${
                      index === 0 && warm?.performance
                        ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20'
                        : 'border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        {index === 0 && warm?.performance && (
                          <Trophy className="h-4 w-4 text-yellow-500" />
                        )}
                        <span className="font-medium">{modelName}</span>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${getProviderColor(provider)}`}
                        >
                          {getProviderLabel(provider)}
                        </Badge>
                      </div>
                    </div>

                    {/* Cold/Warm Results Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Cold Run */}
                      <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Snowflake className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                            {t('cold')}
                          </span>
                        </div>
                        {cold?.error ? (
                          <div className="flex items-center gap-1.5 text-xs text-red-500">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="truncate">{cold.error.substring(0, 50)}...</span>
                          </div>
                        ) : cold?.performance ? (
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">{t('ttft')}:</span>
                              <span className="font-mono font-medium">
                                {formatMs(cold.performance.ttftMs)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">{t('tps')}:</span>
                              <span className="font-mono font-medium">
                                {formatTps(cold.performance.tokensPerSecond)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">{t('total')}:</span>
                              <span className="font-mono font-medium">
                                {formatMs(cold.performance.totalTimeMs)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">-</span>
                        )}
                      </div>

                      {/* Warm Run */}
                      <div className="p-3 rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Flame className="h-3.5 w-3.5 text-orange-500" />
                          <span className="text-xs font-medium text-orange-700 dark:text-orange-400">
                            {t('warm')}
                          </span>
                        </div>
                        {warm?.error ? (
                          <div className="flex items-center gap-1.5 text-xs text-red-500">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="truncate">{warm.error.substring(0, 50)}...</span>
                          </div>
                        ) : warm?.performance ? (
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">{t('ttft')}:</span>
                              <span className="font-mono font-medium">
                                {formatMs(warm.performance.ttftMs)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">{t('tps')}:</span>
                              <span className="font-mono font-medium">
                                {formatTps(warm.performance.tokensPerSecond)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">{t('total')}:</span>
                              <span className="font-mono font-medium">
                                {formatMs(warm.performance.totalTimeMs)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">-</span>
                        )}
                      </div>
                    </div>

                    {/* Response preview (from warm run) */}
                    {warm?.response && (
                      <div className="mt-3 text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/50 p-2 rounded">
                        <p className="line-clamp-2">{warm.response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {hasRun && !loading && sortedModels.length > 0 && (
            <Button
              onClick={handleCompare}
              variant="outline"
              className="w-full"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {t('runAgain')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
