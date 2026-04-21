'use client'

import { useState, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Settings, Plus, GripVertical, Trash2, Pencil, Building2, Loader2, ChevronsUpDown, Check, Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { CallCriterion } from '@/types/call-criteria'
import {
  getOrgLevelCriteria,
  getScenarioCriteria,
  createCallCriterion,
  updateCallCriterion,
  deleteCallCriterion,
  reorderCallCriteria,
} from '@/lib/actions/call-criteria'
import { updateScenarioSettings } from '@/lib/actions/scenarios'
import { AZURE_VOICES, ELEVENLABS_VOICES, DEFAULT_ELEVENLABS_VOICE_ID, type VoiceOption } from '@/lib/constants/voices'

function getVoicesForProvider(provider: string): VoiceOption[] {
  return provider === 'azure' ? AZURE_VOICES : ELEVENLABS_VOICES
}

interface ScenarioSettingsSheetProps {
  scenarioId: string
  organizationId: string
  enableCsat: boolean
  voiceProvider: string | null
  voiceId: string | null
  voiceLanguage: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettingsChange: () => void
}

export function ScenarioSettingsSheet({
  scenarioId,
  organizationId,
  enableCsat,
  voiceProvider: initialVoiceProvider,
  voiceId: initialVoiceId,
  voiceLanguage: initialVoiceLanguage,
  open,
  onOpenChange,
  onSettingsChange,
}: ScenarioSettingsSheetProps) {
  const t = useTranslations('scenarios.settingsConfig')
  const tCriteria = useTranslations('settings.criteria')
  const tCommon = useTranslations('common')

  // CSAT
  const [csatEnabled, setCsatEnabled] = useState(enableCsat)
  const [csatSaving, startCsatSave] = useTransition()

  // Voice — default to ElevenLabs "Phil" (optimised for phone conversations)
  const [voiceProvider, setVoiceProvider] = useState(initialVoiceProvider || 'elevenlabs')
  const [voiceId, setVoiceId] = useState(initialVoiceId || DEFAULT_ELEVENLABS_VOICE_ID)
  const [voiceLanguage, setVoiceLanguage] = useState(initialVoiceLanguage || '')
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceSearch, setVoiceSearch] = useState('')
  const [voiceSaving, startVoiceSave] = useTransition()

  // Criteria
  const [orgCriteria, setOrgCriteria] = useState<CallCriterion[]>([])
  const [scenarioCriteria, setScenarioCriteria] = useState<CallCriterion[]>([])
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCriterion, setEditingCriterion] = useState<CallCriterion | null>(null)
  const [deletingCriterion, setDeletingCriterion] = useState<CallCriterion | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Drag state
  const [draggedItem, setDraggedItem] = useState<CallCriterion | null>(null)

  useEffect(() => {
    setCsatEnabled(enableCsat)
  }, [enableCsat])

  useEffect(() => {
    if (!open) return
    loadCriteria()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scenarioId])

  async function loadCriteria() {
    setLoading(true)
    const [orgResult, scenarioResult] = await Promise.all([
      getOrgLevelCriteria(organizationId),
      getScenarioCriteria(scenarioId),
    ])

    if (!orgResult.error) setOrgCriteria(orgResult.criteria)
    if (!scenarioResult.error) setScenarioCriteria(scenarioResult.criteria)
    setLoading(false)
  }

  function handleCsatToggle(checked: boolean) {
    setCsatEnabled(checked)
    startCsatSave(async () => {
      const { error } = await updateScenarioSettings(scenarioId, { enable_csat: checked })
      if (error) {
        toast.error(error)
        setCsatEnabled(!checked)
      } else {
        onSettingsChange()
      }
    })
  }

  function handleVoiceProviderChange(provider: string) {
    setVoiceProvider(provider)
    setVoiceId('')
    setVoiceLanguage('')
    startVoiceSave(async () => {
      await updateScenarioSettings(scenarioId, { voice_provider: provider, voice_id: null, voice_language: null })
    })
  }

  function handleVoiceSelect(voice: VoiceOption) {
    setVoiceId(voice.id)
    if (voice.lang) setVoiceLanguage(voice.lang)
    setVoiceOpen(false)
    setVoiceSearch('')
    startVoiceSave(async () => {
      await updateScenarioSettings(scenarioId, {
        voice_provider: voiceProvider,
        voice_id: voice.id,
        voice_language: voice.lang || voiceLanguage || null,
      })
    })
  }

  function handleVoiceLanguageChange(lang: string) {
    setVoiceLanguage(lang)
    startVoiceSave(async () => {
      await updateScenarioSettings(scenarioId, { voice_language: lang })
    })
  }

  function openCreateDialog() {
    setEditingCriterion(null)
    setName('')
    setDescription('')
    setIsActive(true)
    setIsDialogOpen(true)
  }

  function openEditDialog(criterion: CallCriterion) {
    setEditingCriterion(criterion)
    setName(criterion.name)
    setDescription(criterion.description)
    setIsActive(criterion.is_active ?? true)
    setIsDialogOpen(true)
  }

  async function handleSubmit() {
    if (!name.trim() || !description.trim()) {
      toast.error(tCriteria('nameAndDescriptionRequired'))
      return
    }

    startTransition(async () => {
      if (editingCriterion) {
        const { criterion, error } = await updateCallCriterion(editingCriterion.id, {
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
        })
        if (error) {
          toast.error(error)
        } else if (criterion) {
          setScenarioCriteria(prev => prev.map(c => c.id === criterion.id ? criterion : c))
          toast.success(tCriteria('criterionUpdated'))
          setIsDialogOpen(false)
        }
      } else {
        const { criterion, error } = await createCallCriterion({
          organization_id: organizationId,
          scenario_id: scenarioId,
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
        })
        if (error) {
          toast.error(error)
        } else if (criterion) {
          setScenarioCriteria(prev => [...prev, criterion])
          toast.success(tCriteria('criterionCreated'))
          setIsDialogOpen(false)
        }
      }
    })
  }

  async function handleDelete() {
    if (!deletingCriterion) return
    startTransition(async () => {
      const { error } = await deleteCallCriterion(deletingCriterion.id)
      if (error) {
        toast.error(error)
      } else {
        setScenarioCriteria(prev => prev.filter(c => c.id !== deletingCriterion.id))
        toast.success(tCriteria('criterionDeleted'))
      }
      setDeletingCriterion(null)
    })
  }

  async function handleToggleActive(criterion: CallCriterion) {
    startTransition(async () => {
      const { criterion: updated, error } = await updateCallCriterion(criterion.id, {
        is_active: !criterion.is_active,
      })
      if (error) {
        toast.error(error)
      } else if (updated) {
        setScenarioCriteria(prev => prev.map(c => c.id === updated.id ? updated : c))
      }
    })
  }

  function handleDragStart(e: React.DragEvent, criterion: CallCriterion) {
    setDraggedItem(criterion)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, targetCriterion: CallCriterion) {
    e.preventDefault()
    if (!draggedItem || draggedItem.id === targetCriterion.id) return

    const newCriteria = [...scenarioCriteria]
    const draggedIndex = newCriteria.findIndex(c => c.id === draggedItem.id)
    const targetIndex = newCriteria.findIndex(c => c.id === targetCriterion.id)

    const [removed] = newCriteria.splice(draggedIndex, 1)
    newCriteria.splice(targetIndex, 0, removed)

    setScenarioCriteria(newCriteria)
    setDraggedItem(null)

    const { error } = await reorderCallCriteria(newCriteria.map(c => c.id))
    if (error) {
      toast.error(error)
      loadCriteria()
    }
  }

  function handleDragEnd() {
    setDraggedItem(null)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md overflow-y-auto p-6">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t('title')}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('title')}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-8 mt-4">
            {/* Voice Settings */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">{t('voiceTitle')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t('voiceDescription')}</p>
              </div>

              {/* Provider */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t('voiceProvider')}</Label>
                <Select value={voiceProvider} onValueChange={handleVoiceProviderChange} disabled={voiceSaving}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="azure" className="text-xs">{t('voiceProviderAzure')}</SelectItem>
                    <SelectItem value="elevenlabs" className="text-xs">{t('voiceProviderElevenLabs')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Voice picker */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t('voiceId')}</Label>
                <Popover open={voiceOpen} onOpenChange={(o) => { setVoiceOpen(o); if (!o) setVoiceSearch('') }}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      disabled={voiceSaving}
                      className="w-full h-8 justify-between font-normal text-xs"
                    >
                      {(() => {
                        const voice = getVoicesForProvider(voiceProvider).find((v) => v.id === voiceId)
                        if (voice) return <span>{voice.flag ? `${voice.flag} ` : ''}{voice.name} ({voice.gender})</span>
                        return <span className="text-muted-foreground">{t('voiceId')}…</span>
                      })()}
                      <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <div className="flex items-center border-b px-3 py-2">
                      <Search className="h-3.5 w-3.5 shrink-0 opacity-50 mr-2" />
                      <input
                        className="flex h-6 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                        placeholder={t('voiceSearch')}
                        value={voiceSearch}
                        onChange={(e) => setVoiceSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1">
                      {(() => {
                        const voices = getVoicesForProvider(voiceProvider)
                        const query = voiceSearch.toLowerCase()
                        const filtered = query
                          ? voices.filter((v) =>
                              v.name.toLowerCase().includes(query) ||
                              (v.desc && v.desc.toLowerCase().includes(query)) ||
                              (v.lang && v.lang.toLowerCase().includes(query))
                            )
                          : voices
                        if (filtered.length === 0) {
                          return <p className="py-4 text-center text-xs text-muted-foreground">{t('noVoicesFound')}</p>
                        }
                        return filtered.map((voice) => (
                          <button
                            key={voice.id}
                            type="button"
                            className={cn(
                              'w-full text-left rounded-sm px-2 py-1.5 text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground',
                              voiceId === voice.id && 'bg-accent text-accent-foreground'
                            )}
                            onClick={() => handleVoiceSelect(voice)}
                          >
                            <div className="flex items-center gap-1">
                              {voice.flag && <span>{voice.flag}</span>}
                              <span className="font-medium">{voice.name}</span>
                              <span className="text-muted-foreground">({voice.gender})</span>
                              {voiceId === voice.id && <Check className="ml-auto h-3 w-3" />}
                            </div>
                            {voice.desc && (
                              <p className="text-xs text-muted-foreground mt-0.5 ml-0.5 line-clamp-1">{voice.desc}</p>
                            )}
                          </button>
                        ))
                      })()}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Language — only for Azure */}
              {voiceProvider === 'azure' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('voiceLanguage')}</Label>
                  <Select value={voiceLanguage || ''} onValueChange={handleVoiceLanguageChange} disabled={voiceSaving}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de-DE" className="text-xs">🇩🇪 Deutsch</SelectItem>
                      <SelectItem value="en-US" className="text-xs">🇺🇸 English (US)</SelectItem>
                      <SelectItem value="en-GB" className="text-xs">🇬🇧 English (UK)</SelectItem>
                      <SelectItem value="es-ES" className="text-xs">🇪🇸 Español</SelectItem>
                      <SelectItem value="fr-FR" className="text-xs">🇫🇷 Français</SelectItem>
                      <SelectItem value="it-IT" className="text-xs">🇮🇹 Italiano</SelectItem>
                      <SelectItem value="nl-NL" className="text-xs">🇳🇱 Nederlands</SelectItem>
                      <SelectItem value="pl-PL" className="text-xs">🇵🇱 Polski</SelectItem>
                      <SelectItem value="pt-BR" className="text-xs">🇧🇷 Português (BR)</SelectItem>
                      <SelectItem value="tr-TR" className="text-xs">🇹🇷 Türkçe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            {/* CSAT Toggle */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold tracking-tight">{t('csatTitle')}</h3>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="scenario_enable_csat" className="text-sm font-medium cursor-pointer">
                    {t('csatLabel')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('csatDescription')}
                  </p>
                </div>
                <Switch
                  id="scenario_enable_csat"
                  checked={csatEnabled}
                  onCheckedChange={handleCsatToggle}
                  disabled={csatSaving}
                />
              </div>
            </div>

            <Separator />

            {/* Call Criteria */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-tight">{t('criteriaTitle')}</h3>
                <Button variant="outline" size="sm" onClick={openCreateDialog}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {tCriteria('addCriterion')}
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Inherited org-level criteria */}
                  {orgCriteria.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {t('orgCriteria')}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {orgCriteria.map((criterion) => (
                          <div
                            key={criterion.id}
                            className={`p-3 bg-muted/50 border rounded-lg ${!criterion.is_active ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{criterion.name}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Org</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{criterion.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scenario-specific criteria */}
                  {scenarioCriteria.length > 0 && (
                    <div className="space-y-2">
                      {scenarioCriteria.map((criterion) => (
                        <div
                          key={criterion.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                            !criterion.is_active ? 'opacity-50' : ''
                          } ${draggedItem?.id === criterion.id ? 'opacity-30' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, criterion)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, criterion)}
                          onDragEnd={handleDragEnd}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">{criterion.name}</span>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{criterion.description}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Switch
                              checked={criterion.is_active ?? true}
                              onCheckedChange={() => handleToggleActive(criterion)}
                              disabled={isPending}
                              className="scale-75"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(criterion)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-600"
                              onClick={() => setDeletingCriterion(criterion)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {scenarioCriteria.length === 0 && orgCriteria.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        {t('noCriteria')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCriterion ? tCriteria('editCriterion') : tCriteria('createCriterion')}
            </DialogTitle>
            <DialogDescription>
              {t('criterionDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="criterion-name">{tCriteria('name')}</Label>
              <Input
                id="criterion-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tCriteria('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="criterion-description">{tCriteria('criterionDescription')}</Label>
              <Textarea
                id="criterion-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tCriteria('descriptionPlaceholder')}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{tCriteria('descriptionHint')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="criterion-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="criterion-active">{tCriteria('active')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingCriterion ? tCommon('save') : tCriteria('createCriterion')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCriterion} onOpenChange={(o) => { if (!o) setDeletingCriterion(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCriteria('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tCriteria('deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
