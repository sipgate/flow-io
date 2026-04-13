'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, ChevronDown, ChevronRight, Volume2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { PhonemeSet, PhonemeSetEntry } from '@/types/phoneme-sets'
import {
  getPhonemeSets,
  createPhonemeSet,
  deletePhonemeSet,
  upsertPhonemeSetEntry,
  togglePhonemeSetEntry,
  updatePhonemeSetEntryField,
  deletePhonemeSetEntry,
} from '@/lib/actions/phoneme-sets'

interface PhonemeSetsProps {
  organizationId: string
  canEdit: boolean
}

export function PhonemeSetsSection({ organizationId, canEdit }: PhonemeSetsProps) {
  const t = useTranslations('phonemeSets')
  const [sets, setSets] = useState<PhonemeSet[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [expandedSetIds, setExpandedSetIds] = useState<Set<string>>(new Set())

  // New set form
  const [newSetName, setNewSetName] = useState('')
  const [newSetDesc, setNewSetDesc] = useState('')
  const [showNewSetForm, setShowNewSetForm] = useState(false)

  // New entry form per set
  const [entryForms, setEntryForms] = useState<Record<string, { word: string; alias: string; boost_recognition: boolean; replace_pronunciation: boolean }>>({})
  const phonemeInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Preview state: ID of entry or set currently loading audio
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  // Cache raw audio bytes by "word::alias" to avoid re-fetching
  const audioCache = useRef<Map<string, ArrayBuffer>>(new Map())

  async function previewPhoneme(id: string, word: string, alias: string) {
    if (!word.trim() || !alias.trim()) return
    setPreviewingId(id)
    // Create AudioContext immediately inside the click handler to satisfy autoplay policy
    const audioCtx = new AudioContext()
    try {
      const cacheKey = `${word}::${alias}`
      let arrayBuffer = audioCache.current.get(cacheKey)
      if (!arrayBuffer) {
        const res = await fetch('/api/phoneme-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word, alias }),
        })
        if (!res.ok) { toast.error(t('previewFailed')); return }
        arrayBuffer = await res.arrayBuffer()
        audioCache.current.set(cacheKey, arrayBuffer)
      }
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
      const source = audioCtx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioCtx.destination)
      source.start(0)
      source.onended = () => audioCtx.close()
    } catch {
      toast.error(t('previewFailed'))
      audioCtx.close()
    } finally {
      setPreviewingId(null)
    }
  }

  // Delete confirmation
  const [deletingSet, setDeletingSet] = useState<PhonemeSet | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<PhonemeSetEntry | null>(null)

  useEffect(() => {
    getPhonemeSets(organizationId).then(({ sets }) => {
      setSets(sets)
      setLoading(false)
    })
  }, [organizationId])

  function toggleExpand(id: string) {
    setExpandedSetIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleCreateSet() {
    if (!newSetName.trim()) return
    startTransition(async () => {
      const { set, error } = await createPhonemeSet(organizationId, newSetName.trim(), newSetDesc.trim() || undefined)
      if (error || !set) {
        toast.error(error || t('setCreateFailed'))
        return
      }
      setSets((prev) => [...prev, { ...set, entries: [] }])
      setNewSetName('')
      setNewSetDesc('')
      setShowNewSetForm(false)
      setExpandedSetIds((prev) => new Set([...prev, set.id]))
      toast.success(t('setCreated'))
    })
  }

  function handleDeleteSet(set: PhonemeSet) {
    startTransition(async () => {
      const { error } = await deletePhonemeSet(set.id)
      if (error) {
        toast.error(error)
        return
      }
      setSets((prev) => prev.filter((s) => s.id !== set.id))
      setDeletingSet(null)
      toast.success(t('setDeleted'))
    })
  }

  function handleAddEntry(setId: string) {
    const form = entryForms[setId]
    if (!form?.word.trim()) return
    if (form.replace_pronunciation && !form.alias.trim()) return
    startTransition(async () => {
      const { entry, error } = await upsertPhonemeSetEntry(setId, {
        word: form.word.trim(),
        alias: form.alias.trim() || form.word.trim(),
        boost_recognition: form.boost_recognition,
        replace_pronunciation: form.replace_pronunciation,
      })
      if (error || !entry) {
        toast.error(error || t('entryAddFailed'))
        return
      }
      setSets((prev) =>
        prev.map((s) =>
          s.id === setId
            ? { ...s, entries: [...(s.entries ?? []).filter((e) => e.word !== entry.word), entry] }
            : s
        )
      )
      setEntryForms((prev) => ({ ...prev, [setId]: { word: '', alias: '', boost_recognition: true, replace_pronunciation: true } }))
      toast.success(t('entrySaved'))
    })
  }

  function handleToggleEntry(setId: string, entry: PhonemeSetEntry) {
    startTransition(async () => {
      const { error } = await togglePhonemeSetEntry(entry.id, !entry.is_active)
      if (error) {
        toast.error(error)
        return
      }
      setSets((prev) =>
        prev.map((s) =>
          s.id === setId
            ? { ...s, entries: (s.entries ?? []).map((e) => e.id === entry.id ? { ...e, is_active: !e.is_active } : e) }
            : s
        )
      )
    })
  }

  function handleToggleEntryField(setId: string, entry: PhonemeSetEntry, field: 'boost_recognition' | 'replace_pronunciation') {
    startTransition(async () => {
      const newValue = !entry[field]
      const { error } = await updatePhonemeSetEntryField(entry.id, field, newValue)
      if (error) {
        toast.error(error)
        return
      }
      setSets((prev) =>
        prev.map((s) =>
          s.id === setId
            ? { ...s, entries: (s.entries ?? []).map((e) => e.id === entry.id ? { ...e, [field]: newValue } : e) }
            : s
        )
      )
    })
  }

  function handleDeleteEntry(setId: string, entry: PhonemeSetEntry) {
    startTransition(async () => {
      const { error } = await deletePhonemeSetEntry(entry.id)
      if (error) {
        toast.error(error)
        return
      }
      setSets((prev) =>
        prev.map((s) =>
          s.id === setId
            ? { ...s, entries: (s.entries ?? []).filter((e) => e.id !== entry.id) }
            : s
        )
      )
      setDeletingEntry(null)
      toast.success(t('entryDeleted'))
    })
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t('loading')}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewSetForm((v) => !v)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('newSet')}
          </Button>
        )}
      </div>

      {/* New set form */}
      {showNewSetForm && canEdit && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <h3 className="text-sm font-medium">{t('newSetTitle')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="new-set-name" className="text-xs">{t('nameLabel')}</Label>
              <Input
                id="new-set-name"
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-set-desc" className="text-xs">{t('descriptionLabel')}</Label>
              <Input
                id="new-set-desc"
                value={newSetDesc}
                onChange={(e) => setNewSetDesc(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateSet} disabled={isPending || !newSetName.trim()}>
              {t('create')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNewSetForm(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {sets.length === 0 && !showNewSetForm && (
        <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
          {t('noSets')}
        </div>
      )}

      {/* Set list */}
      <div className="space-y-3">
        {sets.map((set) => {
          const isExpanded = expandedSetIds.has(set.id)
          const entries = set.entries ?? []
          const entryForm = entryForms[set.id] ?? { word: '', alias: '', boost_recognition: true, replace_pronunciation: true }

          return (
            <div key={set.id} className="rounded-lg border bg-card">
              {/* Set header */}
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                  onClick={() => toggleExpand(set.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">{set.name}</span>
                  {set.description && (
                    <span className="text-xs text-muted-foreground truncate">{set.description}</span>
                  )}
                  <Badge variant="secondary" className="text-xs ml-auto shrink-0">
                    {entries.filter((e) => e.boost_recognition || e.replace_pronunciation).length}/{entries.length}
                  </Badge>
                </button>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 ml-2 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => setDeletingSet(set)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Entries table */}
              {isExpanded && (
                <div className="border-t px-4 py-3 space-y-3">
                  {entries.length > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b">
                          <th className="text-left pb-2 font-medium">{t('wordColumn')}</th>
                          <th className="text-left pb-2 font-medium">{t('aliasColumn')}</th>
                          <th className="text-center pb-2 font-medium" title={t('recognitionHint')}>{t('recognitionColumn')}</th>
                          <th className="text-center pb-2 font-medium" title={t('pronunciationHint')}>{t('pronunciationColumn')}</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-3 font-mono text-xs">{entry.word}</td>
                            <td className="py-1.5 pr-3 font-mono text-xs text-muted-foreground">
                              {entry.replace_pronunciation ? entry.alias : <span className="text-muted-foreground/50">—</span>}
                            </td>
                            <td className="py-1.5 text-center">
                              <Checkbox
                                checked={entry.boost_recognition}
                                onCheckedChange={() => canEdit && handleToggleEntryField(set.id, entry, 'boost_recognition')}
                                disabled={!canEdit || isPending}
                              />
                            </td>
                            <td className="py-1.5 text-center">
                              <Checkbox
                                checked={entry.replace_pronunciation}
                                onCheckedChange={() => canEdit && handleToggleEntryField(set.id, entry, 'replace_pronunciation')}
                                disabled={!canEdit || isPending}
                              />
                            </td>
                            <td className="py-1.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {entry.replace_pronunciation && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    disabled={previewingId === entry.id}
                                    onClick={() => previewPhoneme(entry.id, entry.word, entry.alias)}
                                    title={t('previewTitle')}
                                  >
                                    {previewingId === entry.id
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <Volume2 className="h-3 w-3" />}
                                  </Button>
                                )}
                                {canEdit && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    onClick={() => setDeletingEntry(entry)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Add entry form */}
                  {canEdit && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-end flex-wrap">
                        <div className="space-y-1 min-w-[120px]">
                          <Label className="text-xs text-muted-foreground">{t('wordLabel')}</Label>
                          <Input
                            value={entryForm.word}
                            onChange={(e) =>
                              setEntryForms((prev) => ({
                                ...prev,
                                [set.id]: { ...entryForm, word: e.target.value },
                              }))
                            }
                            placeholder="sipgate"
                            className="h-7 text-xs font-mono"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddEntry(set.id)}
                          />
                        </div>
                        {entryForm.replace_pronunciation && (
                          <div className="space-y-1 flex-1 min-w-[140px]">
                            <Label className="text-xs text-muted-foreground">{t('aliasLabel')}</Label>
                            <div className="flex gap-1">
                              <Input
                                ref={(el) => { phonemeInputRefs.current[set.id] = el }}
                                value={entryForm.alias}
                                onChange={(e) =>
                                  setEntryForms((prev) => ({
                                    ...prev,
                                    [set.id]: { ...entryForm, alias: e.target.value },
                                  }))
                                }
                                placeholder="zipgate"
                                className="h-7 text-xs font-mono"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddEntry(set.id)}
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 shrink-0"
                                disabled={!entryForm.word.trim() || !entryForm.alias.trim() || previewingId === set.id}
                                onClick={() => previewPhoneme(set.id, entryForm.word, entryForm.alias)}
                                title={t('previewTitleElevenLabs')}
                              >
                                {previewingId === set.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <Volume2 className="h-3 w-3" />
                                }
                              </Button>
                            </div>
                          </div>
                        )}
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleAddEntry(set.id)}
                          disabled={isPending || !entryForm.word.trim() || (entryForm.replace_pronunciation && !entryForm.alias.trim())}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t('addEntry')}
                        </Button>
                      </div>
                      <div className="flex gap-4 items-center">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title={t('recognitionHint')}>
                          <Checkbox
                            checked={entryForm.boost_recognition}
                            onCheckedChange={(checked) =>
                              setEntryForms((prev) => ({
                                ...prev,
                                [set.id]: { ...entryForm, boost_recognition: checked === true },
                              }))
                            }
                          />
                          {t('recognitionColumn')}
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title={t('pronunciationHint')}>
                          <Checkbox
                            checked={entryForm.replace_pronunciation}
                            onCheckedChange={(checked) =>
                              setEntryForms((prev) => ({
                                ...prev,
                                [set.id]: { ...entryForm, replace_pronunciation: checked === true },
                              }))
                            }
                          />
                          {t('pronunciationColumn')}
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Delete set confirmation */}
      <AlertDialog open={!!deletingSet} onOpenChange={(open) => !open && setDeletingSet(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteSetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteSetDescription', { name: deletingSet?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirmCancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingSet && handleDeleteSet(deletingSet)}
            >
              {t('confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete entry confirmation */}
      <AlertDialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteEntryTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteEntryDescription', { word: deletingEntry?.word ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirmCancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletingEntry) return
                const setId = sets.find((s) => s.entries?.some((e) => e.id === deletingEntry.id))?.id
                if (setId) handleDeleteEntry(setId, deletingEntry)
              }}
            >
              {t('confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
