'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createTestSuite, updateTestSuite } from '@/lib/actions/autotest'
import type { TestSuite } from '@/types/autotest'

interface TestSuiteFormProps {
  organizationId: string
  orgSlug: string
  assistants: Array<{ id: string; name: string }>
  existingSuite?: TestSuite
}

export function TestSuiteForm({
  organizationId,
  orgSlug,
  assistants,
  existingSuite,
}: TestSuiteFormProps) {
  const t = useTranslations('autotest')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(existingSuite?.name || '')
  const [description, setDescription] = useState(existingSuite?.description || '')
  const [assistantId, setAssistantId] = useState(existingSuite?.assistant_id || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError(t('nameRequired'))
      return
    }

    if (!assistantId) {
      setError(t('assistantRequired'))
      return
    }

    setIsSubmitting(true)

    try {
      if (existingSuite) {
        // Update existing suite
        const { error: updateError } = await updateTestSuite(existingSuite.id, {
          name: name.trim(),
          description: description.trim() || null,
        })

        if (updateError) {
          setError(updateError)
          return
        }

        router.push(`/${orgSlug}/autotest/${existingSuite.id}`)
      } else {
        // Create new suite
        const { suite, error: createError } = await createTestSuite({
          organization_id: organizationId,
          assistant_id: assistantId,
          name: name.trim(),
          description: description.trim() || null,
        })

        if (createError || !suite) {
          setError(createError || t('createFailed'))
          return
        }

        router.push(`/${orgSlug}/autotest/${suite.id}`)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{existingSuite ? t('editSuite') : t('suiteDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t('suiteName')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('suiteNamePlaceholder')}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assistant">{t('assistant')}</Label>
            <Select
              value={assistantId}
              onValueChange={setAssistantId}
              disabled={isSubmitting || !!existingSuite}
            >
              <SelectTrigger id="assistant">
                <SelectValue placeholder={t('selectAssistant')} />
              </SelectTrigger>
              <SelectContent>
                {assistants.map((assistant) => (
                  <SelectItem key={assistant.id} value={assistant.id}>
                    {assistant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {existingSuite && (
              <p className="text-xs text-neutral-500">{t('assistantCannotChange')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('suiteDescription')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('suiteDescriptionPlaceholder')}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Link href={`/${orgSlug}/autotest`}>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('cancel')}
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {existingSuite ? t('saving') : t('creating')}
                </>
              ) : existingSuite ? (
                t('saveChanges')
              ) : (
                t('createSuite')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
