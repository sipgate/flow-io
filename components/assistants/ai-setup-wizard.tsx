'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Sparkles, ArrowRight, SkipForward, ArrowLeft, Bot } from 'lucide-react'
import { createAssistant } from '@/lib/actions/assistants'
import { toast } from 'sonner'
import type { AISetupResult } from '@/app/api/assistants/ai-setup/route'
import { AssistantForm } from './assistant-form'
import { LLMButtonTooltip } from '@/components/ui/llm-button-tooltip'
import type { ToolModelConfig } from '@/lib/tool-model'
import { getModelLabel } from '@/lib/models'

type WizardStep = 'input' | 'loading' | 'preview' | 'form'

interface AISetupWizardProps {
  organizationId: string
  orgSlug: string
  toolModel: ToolModelConfig
}

function extractDomain(text: string): string | null {
  const urlPattern = /https?:\/\/[^\s]+|(?:^|\s)([\w-]+\.(?:de|com|net|org|io|at|ch|eu|shop|store|info|biz)(?:\/[^\s]*)?)/gi
  const match = urlPattern.exec(text)
  if (!match) return null
  const url = match[0].trim()
  if (url.startsWith('http')) return url
  return `https://${url}`
}

export function AISetupWizard({ organizationId, orgSlug, toolModel }: AISetupWizardProps) {
  const t = useTranslations('assistants.aiWizard')
  const tCommon = useTranslations('common')
  const router = useRouter()

  const [step, setStep] = useState<WizardStep>('input')
  const [description, setDescription] = useState('')
  const [scrapeEnabled, setScrapeEnabled] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [generatedConfig, setGeneratedConfig] = useState<AISetupResult | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const detectedDomain = extractDomain(description)
  const scrapeUrl = scrapeEnabled ? (customUrl || detectedDomain || '') : undefined

  const handleGenerate = async () => {
    if (!description.trim()) return
    setStep('loading')

    try {
      const res = await fetch('/api/assistants/ai-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, scrapeUrl, organizationId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Generation failed')
      }

      const config: AISetupResult = await res.json()
      setGeneratedConfig(config)
      setStep('preview')
    } catch (err) {
      console.error(err)
      toast.error(t('generationError'))
      setStep('input')
    }
  }

  const handleCreate = async () => {
    if (!generatedConfig) return
    setIsCreating(true)

    const result = await createAssistant(organizationId, {
      name: generatedConfig.name,
      description: generatedConfig.description,
      system_prompt: generatedConfig.system_prompt,
      opening_message: generatedConfig.opening_message,
      voice_provider: generatedConfig.voice_provider,
      voice_id: generatedConfig.voice_id,
      voice_language: generatedConfig.voice_language,
      llm_provider: generatedConfig.llm_provider,
      llm_model: generatedConfig.llm_model,
      llm_temperature: generatedConfig.llm_temperature,
      thinking_level: generatedConfig.thinking_level,
      is_active: true,
    })

    if (result.error) {
      setIsCreating(false)
      toast.error(result.error)
      return
    }

    // Navigate immediately without resetting state — revalidatePath in the server action
    // would otherwise re-render this component before router.push takes effect
    router.push(`/${orgSlug}/assistants/${result.assistant?.id}/edit`)
  }

  const handleCustomize = () => {
    setStep('form')
  }

  const handleSkip = () => {
    setStep('form')
  }

  if (step === 'form') {
    const defaults = generatedConfig ? {
      name: generatedConfig.name,
      description: generatedConfig.description,
      system_prompt: generatedConfig.system_prompt,
      opening_message: generatedConfig.opening_message,
      voice_provider: generatedConfig.voice_provider,
      voice_id: generatedConfig.voice_id,
      voice_language: generatedConfig.voice_language,
      llm_provider: generatedConfig.llm_provider,
      llm_model: generatedConfig.llm_model,
      llm_temperature: generatedConfig.llm_temperature,
    } : undefined

    return (
      <AssistantForm
        organizationId={organizationId}
        orgSlug={orgSlug}
        defaultValues={defaults}
      />
    )
  }

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <Bot className="h-12 w-12 text-neutral-300" />
          <Sparkles className="h-5 w-5 text-lime-500 absolute -top-1 -right-1 animate-pulse" />
        </div>
        <p className="text-sm text-neutral-500">{t('generating')}</p>
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (step === 'preview' && generatedConfig) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-lime-600 dark:text-lime-400" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('previewTitle')}</p>
            <p className="text-xs text-neutral-500">{t('previewSubtitle')}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-500 mb-1">{t('fieldName')}</p>
                <p className="font-medium">{generatedConfig.name}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-500 mb-1">{t('fieldVoice')}</p>
                <p className="font-medium text-sm">{generatedConfig.voice_id.split('-').slice(2).join(' ')} · {generatedConfig.voice_language}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-neutral-500 mb-1">{t('fieldDescription')}</p>
              <p className="text-sm">{generatedConfig.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-neutral-500 mb-1">{t('fieldOpeningMessage')}</p>
              <p className="text-sm italic">&quot;{generatedConfig.opening_message}&quot;</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-neutral-500 mb-2">{t('fieldSystemPrompt')}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-4">
                {generatedConfig.system_prompt}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleCreate} disabled={isCreating} className="flex-1">
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {tCommon('creating')}
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                {t('createButton')}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleCustomize} disabled={isCreating}>
            {t('customizeButton')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setStep('input')} disabled={isCreating}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // Step: input
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="ai-description">{t('inputLabel')}</Label>
        <Textarea
          id="ai-description"
          placeholder={t('inputPlaceholder')}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            if (!customUrl && extractDomain(e.target.value)) {
              setScrapeEnabled(true)
            }
          }}
          rows={4}
          className="resize-none"
          autoFocus
        />
        <p className="text-xs text-neutral-500">{t('inputHint')}</p>
      </div>

      {(detectedDomain || scrapeEnabled) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="scrape-website"
              checked={scrapeEnabled}
              onCheckedChange={(v) => setScrapeEnabled(!!v)}
            />
            <Label htmlFor="scrape-website" className="font-normal cursor-pointer">
              {t('scrapeLabel')}
              {detectedDomain && !customUrl && (
                <span className="text-neutral-400 ml-1">({detectedDomain})</span>
              )}
            </Label>
          </div>
          {scrapeEnabled && (
            <Input
              placeholder={detectedDomain || 'https://example.de'}
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="text-sm"
            />
          )}
        </div>
      )}

      <div className="flex gap-3">
        <LLMButtonTooltip model={getModelLabel(toolModel.tool_provider, toolModel.tool_model)}>
          <Button
            onClick={handleGenerate}
            disabled={!description.trim()}
            className="flex-1"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {t('generateButton')}
          </Button>
        </LLMButtonTooltip>
        <Button variant="outline" onClick={handleSkip}>
          <SkipForward className="h-4 w-4 mr-2" />
          {t('skipButton')}
        </Button>
      </div>
    </div>
  )
}
