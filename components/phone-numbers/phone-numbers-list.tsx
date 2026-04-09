'use client'

import { useState, useTransition, useMemo, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Phone, Pencil, Loader2, GitBranch, User, X, Plus, Trash2, ChevronRight } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { formatPhoneNumber } from '@/lib/utils/format-phone'
import { addPhoneNumber, addPhoneNumberBlock, deletePhoneNumber, deletePhoneNumberBlock, assignPhoneNumber, assignPhoneNumberToFlow, unassignPhoneNumber, getSipgateNumbersForSelection } from '@/lib/actions/phone-numbers'
import { getOrganizationAssistants } from '@/lib/actions/assistants'
import { getScenarios } from '@/lib/actions/scenarios'
import type { ScenarioSummary } from '@/types/scenarios'
import { toast } from 'sonner'

interface AssistantOption {
  id: string
  name: string
}

interface PhoneNumber {
  id: string
  phone_number: string
  block_id: string | null
  is_active: boolean | null
  assigned_at?: string | null
  assistants: {
    id: string
    name: string
  } | null
  call_scenarios: {
    id: string
    name: string
  } | null
}

interface PhoneNumbersListProps {
  phoneNumbers: PhoneNumber[]
  organizationId: string
  orgSlug: string
  hasTelephonyAccount?: boolean
}

type AssignTab = 'assistant' | 'flow'

type DisplayItem =
  | { kind: 'single'; num: PhoneNumber }
  | { kind: 'block-header'; blockId: string; numbers: PhoneNumber[]; prefix: string; blockLabel: string }
  | { kind: 'block-row'; num: PhoneNumber; blockId: string }

function commonPrefix(strs: string[]): string {
  if (!strs.length) return ''
  let prefix = strs[0]
  for (const s of strs.slice(1)) {
    while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1)
    if (!prefix) return ''
  }
  return prefix
}

function blockLabel(count: number): string {
  if (count === 10) return '10er Block'
  if (count === 91) return '100er Block'
  return `Block`
}

// ── Sipgate number grouping ────────────────────────────────────────────────

type SipgateRouting = { targetType: string | null; targetId: string | null; displayAlias: string | null } | null
type SipgateNum = { number: string; localized: string; type: string; routing: SipgateRouting; blockNumbers?: SipgateNum[] }

function RoutingBadge({ n }: { n: SipgateNum }) {
  const t = useTranslations('phoneNumbers')
  const r = n.routing
  if (r?.targetType === 'AIFLOW') {
    return <span className="text-xs text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/40 px-1.5 py-0.5 rounded shrink-0">{t('aiFlowLabel')}</span>
  }
  if (r?.targetType && r.targetType !== 'UNKNOWN') {
    const label = r.displayAlias || r.targetType
    return <span className="text-xs text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded truncate max-w-28 shrink-0" title={label}>{label}</span>
  }
  return null
}
type SipgateGroup =
  | { kind: 'block'; blockSize: 10 | 100; prefix: string; numbers: SipgateNum[] }
  | { kind: 'single'; number: SipgateNum }

/** v3 returns blocks as a single entry – detect by type field. */
function sipgateBlockSize(type: string): 10 | 100 | null {
  if (type.includes('_BLOCK')) return 10
  if (type.includes('_PROLONGATION_PARENT')) return 100
  return null
}

function groupSipgateNumbers(numbers: SipgateNum[]): SipgateGroup[] {
  const seen = new Map<string, SipgateNum>()
  for (const n of numbers) if (!seen.has(n.number)) seen.set(n.number, n)
  const sorted = [...seen.values()].sort((a, b) => a.number.localeCompare(b.number))

  const result: SipgateGroup[] = []
  for (const n of sorted) {
    const blockSize = sipgateBlockSize(n.type)
    if (blockSize) {
      // Use the individual numbers from v3's nested array
      const blockNums = n.blockNumbers ?? [n]
      // Determine actual size from number count (both are GERMAN_LANDLINE_BLOCK in v3)
      const actualSize: 10 | 100 = blockNums.length > 10 ? 100 : 10
      result.push({ kind: 'block', blockSize: actualSize, prefix: n.number, numbers: blockNums })
    } else if (!n.type.includes('_PROLONGATION_CHILD')) {
      result.push({ kind: 'single', number: n })
    }
  }
  return result
}

function blockRangeDisplay(blockSize: 10 | 100, numbers: SipgateNum[]): string {
  const first = numbers[0]
  if (!first) return ''
  const display = first.localized || first.number
  let i = display.length - 1
  while (i >= 0 && !(display[i] >= '0' && display[i] <= '9')) i--
  if (i < 0) return display
  return display.slice(0, i) + (blockSize === 10 ? '0–9' : '0–99')
}

export function PhoneNumbersList({
  phoneNumbers,
  organizationId,
  hasTelephonyAccount = false,
}: PhoneNumbersListProps) {
  const t = useTranslations('phoneNumbers')
  const locale = useLocale()
  const router = useRouter()
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AssignTab>('assistant')
  const [assistants, setAssistants] = useState<AssistantOption[]>([])
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<
    { type: 'single'; id: string } | { type: 'block'; blockId: string; count: number; ids: string[] } | null
  >(null)
  // sipgate number selection
  const [sipgateNumbers, setSipgateNumbers] = useState<SipgateNum[]>([])
  const [sipgateLoading, setSipgateLoading] = useState(false)
  const [sipgateError, setSipgateError] = useState<string | null>(null)
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set())
  // Guards against React 19 re-invocation of async Actions
  const sipgateFetchingRef = useRef(false)
  const popoverFetchingRef = useRef(false)
  const [expandedSipgateGroups, setExpandedSipgateGroups] = useState<Set<string>>(new Set())

  // Group phone numbers into display items using number pattern detection
  const displayItems = useMemo<DisplayItem[]>(() => {
    const sorted = [...phoneNumbers].sort((a, b) => a.phone_number.localeCompare(b.phone_number))
    const byNumber = new Map(sorted.map(n => [n.phone_number, n]))
    const usedNumbers = new Set<string>()
    const items: DisplayItem[] = []

    // Step 1: Find all 10er blocks
    const by1 = new Map<string, PhoneNumber[]>()
    for (const n of sorted) {
      const prefix = n.phone_number.slice(0, -1)
      const arr = by1.get(prefix) ?? []
      arr.push(n)
      by1.set(prefix, arr)
    }
    const tenBlocks: Array<{ prefix: string; numbers: PhoneNumber[] }> = []
    for (const [prefix, nums] of by1) {
      if (nums.length !== 10) continue
      const suffixes = new Set(nums.map(n => n.phone_number.slice(-1)))
      if ('0123456789'.split('').every(s => suffixes.has(s)))
        tenBlocks.push({ prefix, numbers: nums })
    }

    // Step 2: Detect 100er blocks
    const tenByParent = new Map<string, Array<{ prefix: string; numbers: PhoneNumber[] }>>()
    for (const tb of tenBlocks) {
      const lastOfPrefix = tb.prefix.slice(-1)
      if (lastOfPrefix >= '1' && lastOfPrefix <= '9') {
        const parent = tb.prefix.slice(0, -1)
        const arr = tenByParent.get(parent) ?? []
        arr.push(tb)
        tenByParent.set(parent, arr)
      }
    }
    const usedTenPrefixes = new Set<string>()
    for (const [parent, blocks] of tenByParent) {
      if (blocks.length !== 9) continue
      const digits = new Set(blocks.map(b => b.prefix.slice(-1)))
      if (!'123456789'.split('').every(d => digits.has(d))) continue
      const baseNum = byNumber.get(parent + '0')
      if (!baseNum) continue
      const allNums = [baseNum, ...blocks.flatMap(b => b.numbers)]
        .sort((a, b) => a.phone_number.localeCompare(b.phone_number))
      const blockId = baseNum.block_id ?? `pattern-${parent}`
      items.push({ kind: 'block-header', blockId, numbers: allNums, prefix: parent, blockLabel: '100er Block' })
      if (expandedBlocks.has(blockId)) allNums.forEach(n => items.push({ kind: 'block-row', num: n, blockId }))
      usedNumbers.add(baseNum.phone_number)
      for (const tb of blocks) { usedTenPrefixes.add(tb.prefix); tb.numbers.forEach(n => usedNumbers.add(n.phone_number)) }
    }

    // Step 3: Remaining 10er blocks
    for (const tb of tenBlocks) {
      if (usedTenPrefixes.has(tb.prefix)) continue
      const blockId = tb.numbers[0].block_id ?? `pattern-${tb.prefix}`
      items.push({ kind: 'block-header', blockId, numbers: tb.numbers, prefix: tb.prefix, blockLabel: '10er Block' })
      if (expandedBlocks.has(blockId)) tb.numbers.forEach(n => items.push({ kind: 'block-row', num: n, blockId }))
      tb.numbers.forEach(n => usedNumbers.add(n.phone_number))
    }

    // Step 4: Singles
    for (const n of sorted) {
      if (!usedNumbers.has(n.phone_number)) items.push({ kind: 'single', num: n })
    }

    return items
  }, [phoneNumbers, expandedBlocks])

  const sipgateGroups = useMemo(() => groupSipgateNumbers(sipgateNumbers), [sipgateNumbers])

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }

  const toggleSipgateGroup = (key: string) => {
    setExpandedSipgateGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleBlockNumbers = (numbers: SipgateNum[]) => {
    const selectable = numbers.filter(n => !existingNumbers.has(n.number))
    const allSelected = selectable.length > 0 && selectable.every(n => selectedNumbers.has(n.number))
    setSelectedNumbers(prev => {
      const next = new Set(prev)
      if (allSelected) selectable.forEach(n => next.delete(n.number))
      else selectable.forEach(n => next.add(n.number))
      return next
    })
  }

  const handleOpenPopover = async (phoneNumberId: string) => {
    setOpenPopover(phoneNumberId)
    if (popoverFetchingRef.current) return
    popoverFetchingRef.current = true
    setLoading(true)
    try {
      const [assistantsResult, scenariosResult] = await Promise.all([
        getOrganizationAssistants(organizationId),
        getScenarios(organizationId),
      ])
      setAssistants((assistantsResult.assistants || []).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })))
      setScenarios(scenariosResult.scenarios || [])
      setLoading(false)
    } finally {
      popoverFetchingRef.current = false
    }
  }

  const handleAssignAssistant = async (phoneNumberId: string, assistantId: string) => {
    const { error } = await assignPhoneNumber(phoneNumberId, assistantId)
    if (error) { toast.error(error); return }
    setOpenPopover(null)
    toast.success(t('assignSuccess'))
    startTransition(() => router.refresh())
  }

  const handleAssignScenario = async (phoneNumberId: string, scenarioId: string) => {
    const { error } = await assignPhoneNumberToFlow(phoneNumberId, scenarioId)
    if (error) { toast.error(error); return }
    setOpenPopover(null)
    toast.success(t('assignSuccess'))
    startTransition(() => router.refresh())
  }

  const openAddDialog = async () => {
    setShowAddDialog(true)
    if (hasTelephonyAccount && !sipgateFetchingRef.current) {
      sipgateFetchingRef.current = true
      setSipgateNumbers([])
      setSipgateError(null)
      setSelectedNumbers(new Set())
      setExpandedSipgateGroups(new Set())
      setSipgateLoading(true)
      try {
        const { numbers, error } = await getSipgateNumbersForSelection(organizationId)
        setSipgateLoading(false)
        if (error) { setSipgateError(error); return }
        setSipgateNumbers(numbers)
      } finally {
        sipgateFetchingRef.current = false
      }
    }
  }

  const existingNumbers = useMemo(
    () => new Set(phoneNumbers.map(p => p.phone_number)),
    [phoneNumbers]
  )

  const toggleSelectNumber = (number: string) => {
    setSelectedNumbers(prev => {
      const next = new Set(prev)
      if (next.has(number)) next.delete(number)
      else next.add(number)
      return next
    })
  }

  const handleAddSelected = async () => {
    if (selectedNumbers.size === 0) return
    setIsAdding(true)
    let failed = 0
    for (const number of selectedNumbers) {
      const { error } = await addPhoneNumber(organizationId, number)
      if (error) failed++
    }
    setIsAdding(false)
    const added = selectedNumbers.size - failed
    toast.success(`${added} Rufnummer(n) hinzugefügt`)
    setSelectedNumbers(new Set())
    setShowAddDialog(false)
    startTransition(() => router.refresh())
  }


  const handleDelete = (phoneNumberId: string) => {
    setDeleteTarget({ type: 'single', id: phoneNumberId })
  }

  const handleDeleteBlock = (blockId: string, numbers: PhoneNumber[]) => {
    setDeleteTarget({ type: 'block', blockId, count: numbers.length, ids: numbers.map(n => n.id) })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'single') {
      const { error } = await deletePhoneNumber(deleteTarget.id)
      if (error) { toast.error(error); setDeleteTarget(null); return }
      toast.success('Rufnummer gelöscht')
    } else {
      const { error } = await deletePhoneNumberBlock(deleteTarget.blockId, deleteTarget.ids)
      if (error) { toast.error(error); setDeleteTarget(null); return }
      setExpandedBlocks(prev => { const next = new Set(prev); next.delete(deleteTarget.blockId); return next })
      toast.success(`${deleteTarget.count} Rufnummer(n) gelöscht`)
    }
    setDeleteTarget(null)
    startTransition(() => router.refresh())
  }

  const handleUnassign = async (phoneNumberId: string) => {
    const { error } = await unassignPhoneNumber(phoneNumberId)
    if (error) { toast.error(error); return }
    setOpenPopover(null)
    toast.success(t('unassignSuccess', { defaultValue: 'Zuweisung aufgehoben' }))
    startTransition(() => router.refresh())
  }

  const renderAssignPopover = (phoneNumber: PhoneNumber) => (
    <Popover
      open={openPopover === phoneNumber.id}
      onOpenChange={(open) => {
        if (open) { setActiveTab('assistant'); handleOpenPopover(phoneNumber.id) }
        else setOpenPopover(null)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title={t('addNumber')}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="flex border-b border-neutral-200 dark:border-neutral-700">
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'assistant'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
            onClick={() => setActiveTab('assistant')}
          >
            <User className="h-3.5 w-3.5" />{t('tabAssistant')}
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'flow'
                ? 'border-b-2 border-violet-500 text-violet-600 dark:text-violet-400'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
            onClick={() => setActiveTab('flow')}
          >
            <GitBranch className="h-3.5 w-3.5" />{t('tabScenario')}
          </button>
        </div>
        <div className="p-2">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            </div>
          ) : activeTab === 'assistant' ? (
            assistants.length === 0 ? (
              <p className="text-sm text-neutral-400 px-2 py-3 text-center">{t('noAssistantsAvailable')}</p>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {assistants.map((a) => (
                  <Button
                    key={a.id}
                    variant={phoneNumber.assistants?.id === a.id ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start text-sm"
                    disabled={isPending}
                    onClick={() => handleAssignAssistant(phoneNumber.id, a.id)}
                  >
                    {a.name}
                  </Button>
                ))}
              </div>
            )
          ) : scenarios.length === 0 ? (
            <p className="text-sm text-neutral-400 px-2 py-3 text-center">{t('noScenariosAvailable')}</p>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {scenarios.map((s) => (
                <Button
                  key={s.id}
                  variant={phoneNumber.call_scenarios?.id === s.id ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-sm"
                  disabled={isPending}
                  onClick={() => handleAssignScenario(phoneNumber.id, s.id)}
                >
                  {s.name}
                </Button>
              ))}
            </div>
          )}
          {(phoneNumber.assistants || phoneNumber.call_scenarios) && (
            <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                disabled={isPending}
                onClick={() => handleUnassign(phoneNumber.id)}
              >
                <X className="h-3.5 w-3.5 mr-1.5" />{t('unassign')}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )

  return (
    <div className="space-y-4">
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.type === 'block' ? t('deleteBlockTitle') : t('deleteNumberTitle')}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === 'block'
                ? t('deleteBlockDescription', { count: deleteTarget.count })
                : t('deleteNumberDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) { setSelectedNumbers(new Set()); setExpandedSipgateGroups(new Set()) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('addPhoneNumber')}</DialogTitle>
          </DialogHeader>

          <div className="py-2">
              {sipgateLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-sm text-neutral-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('loadingSipgateNumbers')}
                </div>
              ) : sipgateError ? (
                <p className="text-sm text-red-500 py-4 text-center">{sipgateError}</p>
              ) : sipgateNumbers.length === 0 ? (
                <p className="text-sm text-neutral-400 py-4 text-center">{t('noSipgateNumbers')}</p>
              ) : (() => {
                // Flatten: blocks contribute their individual numbers, singles contribute themselves
                const allIndividual = sipgateGroups.flatMap(g =>
                  g.kind === 'block' ? g.numbers : [g.number]
                )
                const selectable = allIndividual.filter(n => !existingNumbers.has(n.number))
                const allSelected = selectable.length > 0 && selectable.every(n => selectedNumbers.has(n.number))
                const toggleAll = () => {
                  if (allSelected) setSelectedNumbers(new Set())
                  else setSelectedNumbers(new Set(selectable.map(n => n.number)))
                }
                const flowSelectable = selectable.filter(n => n.routing?.targetType === 'AIFLOW')
                const allFlowSelected = flowSelectable.length > 0 && flowSelectable.every(n => selectedNumbers.has(n.number))
                const toggleFlow = () => {
                  if (allFlowSelected) setSelectedNumbers(prev => {
                    const next = new Set(prev)
                    flowSelectable.forEach(n => next.delete(n.number))
                    return next
                  })
                  else setSelectedNumbers(prev => new Set([...prev, ...flowSelectable.map(n => n.number)]))
                }
                return (
                  <div className="space-y-1">
                    {(selectable.length > 0 || flowSelectable.length > 0) && (
                      <div className="flex gap-1 border-b border-neutral-100 dark:border-neutral-800 mb-1">
                        {selectable.length > 0 && (
                          <label className="flex flex-1 items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800">
                            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                            <span className="text-sm font-medium">{t('selectAll')}</span>
                          </label>
                        )}
                        {flowSelectable.length > 0 && (
                          <label className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-950/20 shrink-0">
                            <Checkbox checked={allFlowSelected} onCheckedChange={toggleFlow} />
                            <span className="text-sm font-medium text-violet-700 dark:text-violet-400">{t('selectAiFlow')}</span>
                          </label>
                        )}
                      </div>
                    )}
                    <div className="max-h-64 overflow-y-auto space-y-0.5">
                      {sipgateGroups.map((group) => {
                        if (group.kind === 'single') {
                          const alreadyAdded = existingNumbers.has(group.number.number)
                          const isChecked = selectedNumbers.has(group.number.number)
                          return (
                            <label
                              key={group.number.number}
                              className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                                alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                              }`}
                            >
                              <Checkbox
                                checked={isChecked}
                                disabled={alreadyAdded}
                                onCheckedChange={() => !alreadyAdded && toggleSelectNumber(group.number.number)}
                              />
                              <span className="font-mono text-sm flex-1">{group.number.localized || group.number.number}</span>
                              {!alreadyAdded && <RoutingBadge n={group.number} />}
                              {alreadyAdded && <span className="text-xs text-neutral-400">{t('alreadyAdded')}</span>}
                            </label>
                          )
                        }

                        // Block rendering — group.numbers contains the individual block numbers
                        const isExpanded = expandedSipgateGroups.has(group.prefix)
                        const blockSelectable = group.numbers.filter(n => !existingNumbers.has(n.number))
                        const blockAllSelected = blockSelectable.length > 0 && blockSelectable.every(n => selectedNumbers.has(n.number))
                        const blockSomeSelected = blockSelectable.some(n => selectedNumbers.has(n.number))
                        const alreadyAddedCount = group.numbers.length - blockSelectable.length

                        return (
                          <div key={`${group.blockSize}-${group.prefix}`}>
                            <div
                              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                              onClick={() => toggleSipgateGroup(group.prefix)}
                            >
                              <ChevronRight className={`h-3.5 w-3.5 text-neutral-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              <div onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={blockAllSelected ? true : blockSomeSelected ? 'indeterminate' : false}
                                  disabled={blockSelectable.length === 0}
                                  onCheckedChange={() => toggleBlockNumbers(group.numbers)}
                                />
                              </div>
                              <span className="font-mono text-sm flex-1 truncate">
                                {blockRangeDisplay(group.blockSize, group.numbers)}
                              </span>
                              <span className="text-xs text-neutral-500 bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded shrink-0">
                                {group.blockSize}er
                              </span>
                              {alreadyAddedCount > 0 && (
                                <span className="text-xs text-neutral-400 shrink-0">{alreadyAddedCount} ✓</span>
                              )}
                            </div>
                            {isExpanded && (
                              <div className="ml-7 space-y-0.5">
                                {group.numbers.map(n => {
                                  const alreadyAdded = existingNumbers.has(n.number)
                                  const isChecked = selectedNumbers.has(n.number)
                                  return (
                                    <label
                                      key={n.number}
                                      className={`flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                                        alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                      }`}
                                    >
                                      <Checkbox
                                        checked={isChecked}
                                        disabled={alreadyAdded}
                                        onCheckedChange={() => !alreadyAdded && toggleSelectNumber(n.number)}
                                      />
                                      <span className="font-mono text-sm flex-1">{n.localized || n.number}</span>
                                      {!alreadyAdded && <RoutingBadge n={n} />}
                                      {alreadyAdded && <span className="text-xs text-neutral-400">{t('alreadyAdded')}</span>}
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>{t('cancel')}</Button>
            {(
              <Button
                onClick={handleAddSelected}
                disabled={isAdding || selectedNumbers.size === 0}
              >
                {isAdding && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {t('addSelected', { count: selectedNumbers.size })}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('activePhoneNumbers')}</p>
            <p className="text-2xl font-bold">{phoneNumbers.length}</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {phoneNumbers.filter(p => !p.assistants && !p.call_scenarios).length} {t('unassigned')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('addPhoneNumber')}
            </Button>
            <Phone className="h-8 w-8 text-neutral-400" />
          </div>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.phoneNumber')}</TableHead>
              <TableHead>{t('table.assistant')}</TableHead>
              <TableHead>{t('table.assignedDate')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {phoneNumbers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2 text-neutral-500">
                    <Phone className="h-14 w-14 text-neutral-400" />
                    <p>{t('empty.title')}</p>
                    <p className="text-sm">{t('empty.description')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayItems.map((item) => {
                if (item.kind === 'block-header') {
                  const isExpanded = expandedBlocks.has(item.blockId)
                  const assigned = item.numbers.filter(n => n.assistants || n.call_scenarios).length
                  return (
                    <TableRow
                      key={`block-${item.blockId}`}
                      className="bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                      onClick={() => toggleBlock(item.blockId)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ChevronRight
                            className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                          <span className="font-mono font-medium">{formatPhoneNumber(item.prefix)}</span>
                          <span className="text-xs text-neutral-500 bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded">
                            {item.blockLabel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-neutral-500">
                          {t('numbers', { count: item.numbers.length })}
                          {assigned > 0 && `, ${t('numbersAssigned', { assigned })}`}
                        </span>
                      </TableCell>
                      <TableCell />
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-neutral-400 hover:text-red-500"
                          title="Block löschen"
                          onClick={() => handleDeleteBlock(item.blockId, item.numbers)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                }

                const phoneNumber = item.kind === 'single' ? item.num : item.num
                const isBlockRow = item.kind === 'block-row'
                return (
                  <TableRow key={phoneNumber.id} className={isBlockRow ? 'border-l-2 border-l-neutral-200 dark:border-l-neutral-700' : undefined}>
                    <TableCell>
                      <span className={`font-mono font-medium ${isBlockRow ? 'pl-6 text-sm' : ''}`}>
                        {formatPhoneNumber(phoneNumber.phone_number)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {phoneNumber.call_scenarios ? (
                        <div className="flex items-center gap-1.5">
                          <GitBranch className="h-3.5 w-3.5 text-violet-500" />
                          <span className="text-sm">{phoneNumber.call_scenarios.name}</span>
                        </div>
                      ) : phoneNumber.assistants ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-sm">{phoneNumber.assistants.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {phoneNumber.assigned_at ? (
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {new Date(phoneNumber.assigned_at).toLocaleDateString(locale, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-neutral-400 hover:text-red-500"
                          title="Rufnummer löschen"
                          onClick={() => handleDelete(phoneNumber.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {renderAssignPopover(phoneNumber)}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
