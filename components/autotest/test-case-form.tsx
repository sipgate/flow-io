'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createTestCase, updateTestCase } from '@/lib/actions/autotest'
import { TestCaseFlowEditor } from './test-case-flow-editor'
import type { TestCase, ConversationTurn } from '@/types/autotest'

interface TestCaseFormProps {
  suiteId: string
  organizationId: string
  orgSlug: string
  existingTestCase?: TestCase
}

export function TestCaseForm({
  suiteId,
  organizationId,
  orgSlug,
  existingTestCase,
}: TestCaseFormProps) {
  const t = useTranslations('autotest')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(existingTestCase?.name || '')
  const [description, setDescription] = useState(existingTestCase?.description || '')
  const [conversationFlow, setConversationFlow] = useState<ConversationTurn[]>(
    existingTestCase?.conversation_flow || [
      { role: 'user', content: '' },
      { role: 'assistant', expected: '' },
    ]
  )
  const [evaluationCriteria, setEvaluationCriteria] = useState(
    existingTestCase?.evaluation_criteria || ''
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError(t('nameRequired'))
      return
    }

    // Validate conversation flow
    const validTurns = conversationFlow.filter(
      (turn) =>
        (turn.role === 'user' && turn.content?.trim()) ||
        (turn.role === 'assistant' && turn.expected?.trim())
    )

    if (validTurns.length < 2) {
      setError(t('atLeastTwoTurns'))
      return
    }

    setIsSubmitting(true)

    try {
      if (existingTestCase) {
        // Update existing test case
        const { error: updateError } = await updateTestCase(existingTestCase.id, {
          name: name.trim(),
          description: description.trim() || null,
          conversation_flow: conversationFlow,
          evaluation_criteria: evaluationCriteria.trim() || null,
        })

        if (updateError) {
          setError(updateError)
          return
        }
      } else {
        // Create new test case
        const { error: createError } = await createTestCase({
          test_suite_id: suiteId,
          organization_id: organizationId,
          name: name.trim(),
          description: description.trim() || null,
          conversation_flow: conversationFlow,
          evaluation_criteria: evaluationCriteria.trim() || null,
        })

        if (createError) {
          setError(createError)
          return
        }
      }

      router.push(`/${orgSlug}/autotest/${suiteId}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('testDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t('testName')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('testNamePlaceholder')}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('testDescription')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('testDescriptionPlaceholder')}
              rows={2}
              disabled={isSubmitting}
            />
          </div>
        </CardContent>
      </Card>

      {/* Conversation Flow */}
      <Card>
        <CardHeader>
          <CardTitle>{t('conversationFlow')}</CardTitle>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('conversationFlowDescription')}
          </p>
        </CardHeader>
        <CardContent>
          <TestCaseFlowEditor
            turns={conversationFlow}
            onChange={setConversationFlow}
            disabled={isSubmitting}
          />
        </CardContent>
      </Card>

      {/* Overall Evaluation Criteria */}
      <Card>
        <CardHeader>
          <CardTitle>{t('overallEvaluationCriteria')}</CardTitle>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('overallEvaluationDescription')}
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={evaluationCriteria}
            onChange={(e) => setEvaluationCriteria(e.target.value)}
            placeholder={t('overallEvaluationPlaceholder')}
            rows={3}
            disabled={isSubmitting}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Link href={`/${orgSlug}/autotest/${suiteId}`}>
          <Button type="button" variant="outline" disabled={isSubmitting}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('cancel')}
          </Button>
        </Link>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {existingTestCase ? t('saving') : t('creating')}
            </>
          ) : existingTestCase ? (
            t('saveChanges')
          ) : (
            t('createTest')
          )}
        </Button>
      </div>
    </form>
  )
}
