'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { PhoneOff, PhoneForwarded, StickyNote, Loader2, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getCallToolConfig, upsertCallToolConfig } from '@/lib/actions/call-tools'
import type { CallToolConfig } from '@/types/call-tools'

interface CallToolsSectionProps {
  assistantId: string
  organizationId: string
  onSummaryChange?: (summary: string) => void
}

export function CallToolsSection({
  assistantId,
  organizationId,
  onSummaryChange,
}: CallToolsSectionProps) {
  const t = useTranslations('callTools')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Form state
  const [hangupEnabled, setHangupEnabled] = useState(false)
  const [hangupInstructions, setHangupInstructions] = useState('')

  const [forwardEnabled, setForwardEnabled] = useState(false)
  const [forwardPhoneNumber, setForwardPhoneNumber] = useState('')
  const [forwardCallerIdName, setForwardCallerIdName] = useState('')
  const [forwardCallerIdNumber, setForwardCallerIdNumber] = useState('')
  const [forwardInstructions, setForwardInstructions] = useState('')

  const [noteEnabled, setNoteEnabled] = useState(false)
  const [noteInstructions, setNoteInstructions] = useState('')

  // Refs for debounce and initial load tracking
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initialLoadDone = useRef(false)
  const isFirstRender = useRef(true)

  // Report summary to parent
  useEffect(() => {
    if (!onSummaryChange) return
    const tools = [
      hangupEnabled ? 'Auflegen' : null,
      forwardEnabled ? 'Weiterleiten' : null,
      noteEnabled ? 'Notiz' : null,
    ].filter(Boolean)
    onSummaryChange(tools.length > 0 ? tools.join(' · ') : '—')
  }, [hangupEnabled, forwardEnabled, noteEnabled, onSummaryChange])

  // Fetch existing config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      const { config: existingConfig } = await getCallToolConfig(assistantId)
      if (existingConfig) {
        setHangupEnabled(existingConfig.hangup_enabled)
        setHangupInstructions(existingConfig.hangup_instructions || '')
        setForwardEnabled(existingConfig.forward_enabled)
        setForwardPhoneNumber(existingConfig.forward_phone_number || '')
        setForwardCallerIdName(existingConfig.forward_caller_id_name || '')
        setForwardCallerIdNumber(existingConfig.forward_caller_id_number || '')
        setForwardInstructions(existingConfig.forward_instructions || '')
        setNoteEnabled(existingConfig.note_enabled)
        setNoteInstructions(existingConfig.note_instructions || '')
      }
      setLoading(false)
      // Mark initial load as done after state settles
      requestAnimationFrame(() => {
        initialLoadDone.current = true
      })
    }
    fetchConfig()
  }, [assistantId])

  // Debounced auto-save effect
  useEffect(() => {
    // Skip on first render and before initial load
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (!initialLoadDone.current) {
      return
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true)
      setSaved(false)

      await upsertCallToolConfig({
        assistant_id: assistantId,
        organization_id: organizationId,
        hangup_enabled: hangupEnabled,
        hangup_instructions: hangupInstructions || undefined,
        forward_enabled: forwardEnabled,
        forward_phone_number: forwardPhoneNumber || undefined,
        forward_caller_id_name: forwardCallerIdName || undefined,
        forward_caller_id_number: forwardCallerIdNumber || undefined,
        forward_instructions: forwardInstructions || undefined,
        note_enabled: noteEnabled,
        note_instructions: noteInstructions || undefined,
      })

      setSaving(false)
      setSaved(true)

      // Hide saved indicator after 2 seconds
      setTimeout(() => setSaved(false), 2000)
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [
    assistantId,
    organizationId,
    hangupEnabled,
    hangupInstructions,
    forwardEnabled,
    forwardPhoneNumber,
    forwardCallerIdName,
    forwardCallerIdNumber,
    forwardInstructions,
    noteEnabled,
    noteInstructions,
  ])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      {(saving || saved) && (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('saving')}</span>
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4 text-lime-600" />
              <span className="text-lime-700">{t('saved')}</span>
            </>
          ) : null}
        </div>
      )}

      {/* Hangup Tool */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <PhoneOff className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-base">{t('endCall.title')}</CardTitle>
                <CardDescription>
                  {t('endCall.description')}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={hangupEnabled}
              onCheckedChange={setHangupEnabled}
            />
          </div>
        </CardHeader>
        {hangupEnabled && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <Label htmlFor="hangup-instructions">{t('endCall.instructionsLabel')}</Label>
              <Textarea
                id="hangup-instructions"
                placeholder={t('endCall.instructionsPlaceholder')}
                value={hangupInstructions}
                onChange={(e) => setHangupInstructions(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Forward Tool */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <PhoneForwarded className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">{t('transferCall.title')}</CardTitle>
                <CardDescription>
                  {t('transferCall.description')}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={forwardEnabled}
              onCheckedChange={setForwardEnabled}
            />
          </div>
        </CardHeader>
        {forwardEnabled && (
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forward-phone">{t('transferCall.phoneLabel')}</Label>
              <Input
                id="forward-phone"
                type="tel"
                placeholder={t('transferCall.phonePlaceholder')}
                value={forwardPhoneNumber}
                onChange={(e) => setForwardPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-neutral-500">{t('transferCall.phoneHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="forward-caller-name">{t('transferCall.callerIdName')}</Label>
                <Input
                  id="forward-caller-name"
                  placeholder={t('transferCall.callerIdNamePlaceholder')}
                  value={forwardCallerIdName}
                  onChange={(e) => setForwardCallerIdName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forward-caller-number">{t('transferCall.callerIdNumber')}</Label>
                <Input
                  id="forward-caller-number"
                  type="tel"
                  placeholder="+49301234567"
                  value={forwardCallerIdNumber}
                  onChange={(e) => setForwardCallerIdNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forward-instructions">{t('transferCall.instructionsLabel')}</Label>
              <Textarea
                id="forward-instructions"
                placeholder={t('transferCall.instructionsPlaceholder')}
                value={forwardInstructions}
                onChange={(e) => setForwardInstructions(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Take Note Tool */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <StickyNote className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-base">{t('takeNotes.title')}</CardTitle>
                <CardDescription>
                  {t('takeNotes.description')}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={noteEnabled}
              onCheckedChange={setNoteEnabled}
            />
          </div>
        </CardHeader>
        {noteEnabled && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <Label htmlFor="note-instructions">{t('takeNotes.instructionsLabel')}</Label>
              <Textarea
                id="note-instructions"
                placeholder={t('takeNotes.instructionsPlaceholder')}
                value={noteInstructions}
                onChange={(e) => setNoteInstructions(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        )}
      </Card>

    </div>
  )
}
