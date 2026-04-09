'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, Check, User, Bot } from 'lucide-react'
import { generateTestSuggestions } from '@/lib/services/autotest-generator'
import { createTestCase } from '@/lib/actions/autotest'
import type { GeneratedTestSuggestion } from '@/types/autotest'

interface GenerateTestsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suiteId: string
  assistantId: string
  organizationId: string
  onTestsCreated?: () => void
}

export function GenerateTestsDialog({
  open,
  onOpenChange,
  suiteId,
  assistantId,
  organizationId,
  onTestsCreated,
}: GenerateTestsDialogProps) {
  const t = useTranslations('autotest')
  const locale = useLocale()
  const [count, setCount] = useState(5)
  const [isGenerating, setIsGenerating] = useState(false)
  const [suggestions, setSuggestions] = useState<GeneratedTestSuggestion[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    setSuggestions([])
    setSelectedIds(new Set())

    try {
      const result = await generateTestSuggestions({
        assistantId,
        organizationId,
        count,
        locale,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setSuggestions(result.suggestions)
        // Select all by default
        setSelectedIds(new Set(result.suggestions.map((_, i) => i)))
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleSelection = (index: number) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setSelectedIds(newSet)
  }

  const handleSaveSelected = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const selectedSuggestions = suggestions.filter((_, i) => selectedIds.has(i))

      for (const suggestion of selectedSuggestions) {
        await createTestCase({
          test_suite_id: suiteId,
          organization_id: organizationId,
          name: suggestion.name,
          description: suggestion.description,
          conversation_flow: suggestion.conversation_flow,
          evaluation_criteria: suggestion.evaluation_criteria,
        })
      }

      onOpenChange(false)
      setSuggestions([])
      setSelectedIds(new Set())
      onTestsCreated?.()
    } catch (err) {
      setError(String(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (!isGenerating && !isSaving) {
      onOpenChange(false)
      setSuggestions([])
      setSelectedIds(new Set())
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            {t('generateWithAI')}
          </DialogTitle>
          <DialogDescription>
            {t('generateDescription')}
          </DialogDescription>
        </DialogHeader>

        {suggestions.length === 0 ? (
          // Generation form
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="count">{t('numberOfTests')}</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                disabled={isGenerating}
              />
              <p className="text-sm text-neutral-500">
                {t('numberOfTestsHint')}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        ) : (
          // Suggestions list
          <ScrollArea className="flex-1 pr-4 max-h-[50vh]">
            <div className="space-y-3 py-4">
              {suggestions.map((suggestion, index) => (
                <Card
                  key={index}
                  className={`cursor-pointer transition-colors ${
                    selectedIds.has(index)
                      ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10'
                      : 'hover:border-neutral-400'
                  }`}
                  onClick={() => toggleSelection(index)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(index)}
                        onCheckedChange={() => toggleSelection(index)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <CardTitle className="text-base">{suggestion.name}</CardTitle>
                        {suggestion.description && (
                          <p className="text-sm text-neutral-500 mt-1">{suggestion.description}</p>
                        )}
                      </div>
                      <Badge variant="outline">
                        {suggestion.conversation_flow.length} {t('turns')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm">
                      {suggestion.conversation_flow.slice(0, 4).map((turn, turnIndex) => (
                        <div key={turnIndex} className="flex items-start gap-2">
                          {turn.role === 'user' ? (
                            <User className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Bot className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          )}
                          <span className="text-neutral-600 dark:text-neutral-400 line-clamp-1">
                            {turn.role === 'user' ? turn.content : turn.expected}
                          </span>
                        </div>
                      ))}
                      {suggestion.conversation_flow.length > 4 && (
                        <p className="text-neutral-400 text-xs pl-6">
                          +{suggestion.conversation_flow.length - 4} {t('moreTurns')}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {suggestions.length === 0 ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
                {t('cancel')}
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('generate')}
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setSuggestions([])} disabled={isSaving}>
                {t('regenerate')}
              </Button>
              <Button
                onClick={handleSaveSelected}
                disabled={selectedIds.size === 0 || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {t('saveSelected', { count: selectedIds.size })}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
