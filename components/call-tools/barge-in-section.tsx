'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { MessageSquareOff, Loader2, Check } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getCallToolConfig, updateBargeInConfig } from '@/lib/actions/call-tools'

interface BargeInSectionProps {
  assistantId: string
  organizationId: string
  onSummaryChange?: (summary: string) => void
}

export function BargeInSection({ assistantId, organizationId, onSummaryChange }: BargeInSectionProps) {
  const t = useTranslations('callTools')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [bargeInStrategy, setBargeInStrategy] = useState<'none' | 'manual' | 'minimum_characters' | 'immediate'>('minimum_characters')
  const [bargeInMinChars, setBargeInMinChars] = useState(3)
  const [bargeInAllowAfterMs, setBargeInAllowAfterMs] = useState(0)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initialLoadDone = useRef(false)
  const isFirstRender = useRef(true)

  // Report summary to parent
  useEffect(() => {
    if (!onSummaryChange) return
    const strategyLabel: Record<string, string> = {
      immediate: 'Sofort',
      minimum_characters: `Min. ${bargeInMinChars} Zeichen`,
      manual: 'Manuell',
      none: 'Deaktiviert',
    }
    const parts = [strategyLabel[bargeInStrategy] ?? bargeInStrategy]
    if (bargeInAllowAfterMs > 0) parts.push(`${bargeInAllowAfterMs} ms Schutz`)
    onSummaryChange(parts.join(' · '))
  }, [bargeInStrategy, bargeInMinChars, bargeInAllowAfterMs, onSummaryChange])

  useEffect(() => {
    const fetchConfig = async () => {
      const { config } = await getCallToolConfig(assistantId)
      if (config) {
        setBargeInStrategy(config.barge_in_strategy || 'minimum_characters')
        setBargeInMinChars(config.barge_in_minimum_characters ?? 3)
        setBargeInAllowAfterMs(config.barge_in_allow_after_ms ?? 0)
      }
      setLoading(false)
      requestAnimationFrame(() => {
        initialLoadDone.current = true
      })
    }
    fetchConfig()
  }, [assistantId])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (!initialLoadDone.current) return

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true)
      setSaved(false)
      await updateBargeInConfig(assistantId, organizationId, {
        barge_in_strategy: bargeInStrategy,
        barge_in_minimum_characters: bargeInMinChars,
        barge_in_allow_after_ms: bargeInAllowAfterMs,
      })
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 500)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [assistantId, organizationId, bargeInStrategy, bargeInMinChars, bargeInAllowAfterMs])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <MessageSquareOff className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-base">{t('bargeIn.title')}</CardTitle>
              <CardDescription>{t('bargeIn.description')}</CardDescription>
            </div>
          </div>
          {(saving || saved) && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              {saving ? (
                <><Loader2 className="h-3 w-3 animate-spin" />{t('saving')}</>
              ) : (
                <><Check className="h-3 w-3 text-lime-600" /><span className="text-lime-700">{t('saved')}</span></>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-6">
        <div className="space-y-2">
          <Label>{t('bargeIn.strategyLabel')}</Label>
          <Select value={bargeInStrategy} onValueChange={(v) => setBargeInStrategy(v as typeof bargeInStrategy)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">{t('bargeIn.immediate')}</SelectItem>
              <SelectItem value="minimum_characters">{t('bargeIn.minimumCharacters')}</SelectItem>
              <SelectItem value="manual">{t('bargeIn.manual')}</SelectItem>
              <SelectItem value="none">{t('bargeIn.none')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-neutral-500">
            {bargeInStrategy === 'immediate' && t('bargeIn.immediateDescription')}
            {bargeInStrategy === 'minimum_characters' && t('bargeIn.minimumCharactersDescription')}
            {bargeInStrategy === 'manual' && t('bargeIn.manualDescription')}
            {bargeInStrategy === 'none' && t('bargeIn.noneDescription')}
          </p>
        </div>

        {bargeInStrategy === 'minimum_characters' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('bargeIn.minCharsLabel')}</Label>
              <span className="text-sm text-neutral-500 tabular-nums">{bargeInMinChars}</span>
            </div>
            <Slider
              min={1}
              max={100}
              step={1}
              value={[bargeInMinChars]}
              onValueChange={([v]) => setBargeInMinChars(v)}
            />
            <p className="text-xs text-neutral-500">{t('bargeIn.minCharsHint')}</p>
          </div>
        )}

        {(bargeInStrategy === 'minimum_characters' || bargeInStrategy === 'immediate') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('bargeIn.protectionPeriodLabel')}</Label>
              <span className="text-sm text-neutral-500 tabular-nums">{bargeInAllowAfterMs} ms</span>
            </div>
            <Slider
              min={0}
              max={10000}
              step={100}
              value={[bargeInAllowAfterMs]}
              onValueChange={([v]) => setBargeInAllowAfterMs(v)}
            />
            <p className="text-xs text-neutral-500">{t('bargeIn.protectionPeriodHint')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
