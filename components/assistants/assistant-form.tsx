'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  X,
  Plus,
  Book,
  Server,
  Settings,
  Database,
  Variable,
  Webhook,
  Check,
  Loader2,
  Bot,
  Search,
  ChevronsUpDown,
  ChevronDown,
  Sliders,
  BarChart2,
  Target,
  Zap,
  RotateCcw,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getModelsByProvider, getDefaultModel, type LLMProviderType } from '@/lib/models'
import { createAssistant, updateAssistant, deployAssistant, revertAssistant } from '@/lib/actions/assistants'
import { AssistantHistorySheet } from '@/components/assistants/assistant-history-sheet'
import { toast } from 'sonner'
import {
  getOrganizationKnowledgeBases,
  getAssistantKnowledgeBases,
  assignKnowledgeBaseToAssistant,
  unassignKnowledgeBaseFromAssistant,
} from '@/lib/actions/knowledge-base'
import {
  getOrganizationMCPServers,
  getAssistantMCPServers,
  assignMCPServerToAssistant,
  unassignMCPServerFromAssistant,
} from '@/lib/actions/mcp-servers'
import {
  getPhonemeSets,
  getAssistantPhonemeSets,
  assignPhonemeSetToAssistant,
  removePhonemeSetFromAssistant,
} from '@/lib/actions/phoneme-sets'
import {
  getOrganizationWebhookTools,
  getAssistantWebhookTools,
} from '@/lib/actions/webhook-tools'
import type { PhonemeSet } from '@/types/phoneme-sets'
import { VariableDefinitionsSection } from '@/components/variables/variable-definitions-section'
import { WebhookConfigSection } from '@/components/variables/webhook-config-section'
import { ContextWebhookSection } from '@/components/variables/context-webhook-section'
import { CallToolsSection } from '@/components/calls/call-tools/call-tools-section'
import { BargeInSection } from '@/components/calls/call-tools/barge-in-section'
import { WebhookToolsSection } from '@/components/assistants/webhook-tools-section'
import { AssistantCriteriaList } from '@/components/calls/call-criteria/assistant-criteria-list'
import { PromptEditor } from '@/components/assistants/prompt-editor'
import { PromptVersionHistory } from '@/components/assistants/prompt-version-history'
import { ModelComparisonDialog } from '@/components/assistants/model-comparison-dialog'
import { AZURE_VOICES, ELEVENLABS_VOICES, type VoiceOption } from '@/lib/constants/voices'

// ─── Section state persistence ───────────────────────────────────────────────

const SECTION_IDS = {
  GENERAL_BASIC: 'general-basic',
  GENERAL_FEATURES: 'general-features',
  GENERAL_OPENING: 'general-opening',
  GENERAL_PROMPT: 'general-prompt',
  PROPS_VOICE: 'props-voice',
  PROPS_STT: 'props-stt',
  PROPS_PHONEME: 'props-phoneme',
  PROPS_LLM: 'props-llm',
  PROPS_BARGEIN: 'props-bargein',
  KW_KB: 'kw-kb',
  KW_MCP: 'kw-mcp',
  KW_WEBHOOK_TOOLS: 'kw-webhook-tools',
  KW_TOOLS: 'kw-tools',
  KW_CONTEXT: 'kw-context',
  ANA_VARS: 'ana-vars',
  ANA_WEBHOOKS: 'ana-webhooks',
  ANA_CRITERIA: 'ana-criteria',
} as const

// Erste Section jedes Tabs aufgeklappt, alle anderen zugeklappt
const DEFAULT_OPEN: Record<string, boolean> = {
  [SECTION_IDS.GENERAL_BASIC]: true,
  [SECTION_IDS.GENERAL_FEATURES]: false,
  [SECTION_IDS.GENERAL_OPENING]: false,
  [SECTION_IDS.GENERAL_PROMPT]: false,
  [SECTION_IDS.PROPS_VOICE]: true,
  [SECTION_IDS.PROPS_STT]: false,
  [SECTION_IDS.PROPS_PHONEME]: false,
  [SECTION_IDS.PROPS_LLM]: false,
  [SECTION_IDS.PROPS_BARGEIN]: false,
  [SECTION_IDS.KW_KB]: true,
  [SECTION_IDS.KW_MCP]: false,
  [SECTION_IDS.KW_WEBHOOK_TOOLS]: false,
  [SECTION_IDS.KW_TOOLS]: false,
  [SECTION_IDS.KW_CONTEXT]: false,
  [SECTION_IDS.ANA_VARS]: true,
  [SECTION_IDS.ANA_WEBHOOKS]: false,
  [SECTION_IDS.ANA_CRITERIA]: false,
}

const STORAGE_KEY = 'assistant-sections-open'

function loadSectionState(): Record<string, boolean> {
  if (typeof window === 'undefined') return DEFAULT_OPEN
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...DEFAULT_OPEN, ...JSON.parse(stored) }
  } catch {}
  return DEFAULT_OPEN
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getVoicesForProvider(provider: string): VoiceOption[] {
  return provider === 'azure' ? AZURE_VOICES : ELEVENLABS_VOICES
}

function findVoice(provider: string, voiceId: string): VoiceOption | undefined {
  return getVoicesForProvider(provider).find((v) => v.id === voiceId)
}

// ─── SectionCollapsible ───────────────────────────────────────────────────────

function SectionCollapsible({
  id,
  title,
  hint,
  preview,
  open,
  onToggle,
  children,
  className,
  headerExtra,
}: {
  id: string
  title: string
  hint?: string
  preview?: React.ReactNode
  open: boolean
  onToggle: (id: string) => void
  children: React.ReactNode
  className?: string
  headerExtra?: React.ReactNode
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={() => onToggle(id)}
      className={cn('space-y-0', className)}
    >
      <div className="flex items-start justify-between w-full py-2 group text-left">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex-1 min-w-0 text-left cursor-pointer"
          >
            <h3 className="text-base font-semibold group-hover:text-foreground text-foreground/90 leading-tight">
              {title}
            </h3>
            {!open && preview && (
              <div className="mt-1">{preview}</div>
            )}
          </button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2 ml-2 shrink-0 mt-0.5">
          {headerExtra}
          <CollapsibleTrigger asChild>
            <button type="button" className="cursor-pointer">
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  !open && '-rotate-90'
                )}
              />
            </button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent forceMount className={cn('pb-2', !open && 'hidden')}>
        {hint && open && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{hint}</p>
        )}
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Preview helpers ──────────────────────────────────────────────────────────

function PreviewText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground truncate max-w-lg">{children}</p>
  )
}

function PreviewChips({ items }: { items: string[] }) {
  if (items.length === 0) return <PreviewText>—</PreviewText>
  return (
    <p className="text-xs text-muted-foreground">
      {items.join(' · ')}
    </p>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssistantFormDefaults {
  name?: string
  description?: string
  voice_provider?: string
  voice_id?: string
  voice_language?: string
  llm_provider?: string
  llm_model?: string
  llm_temperature?: number
  system_prompt?: string
  opening_message?: string
}

interface AssistantFormProps {
  organizationId: string
  orgSlug: string
  assistant?: {
    id: string
    name: string
    description: string | null
    voice_provider: string | null
    voice_id: string | null
    voice_language: string | null
    llm_provider: string | null
    llm_model: string | null
    llm_temperature: number | null
    thinking_level: string | null
    system_prompt: string | null
    opening_message: string | null
    is_active: boolean | null
    avatar_url: string | null
    enable_hesitation: boolean | null
    enable_semantic_eot: boolean | null
    stt_provider: string | null
    stt_languages: string[] | null
    deployed_at: string | null
    updated_at: string
    has_undeployed_changes: boolean
  }
  defaultValues?: AssistantFormDefaults
}

// ─── AssistantForm ────────────────────────────────────────────────────────────

export function AssistantForm({
  organizationId,
  orgSlug,
  assistant,
  defaultValues,
}: AssistantFormProps) {
  const router = useRouter()
  const t = useTranslations('assistants.form')
  const tCommon = useTranslations('common')
  const tForm = useTranslations('assistantForm')

  const tDeploy = useTranslations('assistants.form.deploy')

  const [isLoading, setIsLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')
  const [hasUndeployedChanges, setHasUndeployedChanges] = useState<boolean>(
    !!assistant?.has_undeployed_changes
  )
  const [deploying, setDeploying] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const pendingNavRef = useRef<string | null>(null)
  const bypassGuardRef = useRef(false)

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(assistant?.name || defaultValues?.name || '')
  const [description, setDescription] = useState(assistant?.description || defaultValues?.description || '')
  const [voiceProvider, setVoiceProvider] = useState(
    assistant?.voice_provider || defaultValues?.voice_provider || 'azure'
  )
  const [voiceId, setVoiceId] = useState(assistant?.voice_id || defaultValues?.voice_id || 'en-US-JennyNeural')
  const [voiceLanguage, setVoiceLanguage] = useState(
    assistant?.voice_language || defaultValues?.voice_language || 'en-US'
  )
  const [llmProvider, setLlmProvider] = useState(
    assistant?.llm_provider || defaultValues?.llm_provider || 'openai'
  )
  const [llmModel, setLlmModel] = useState(assistant?.llm_model || defaultValues?.llm_model || 'gpt-5')
  const [llmTemperature, setLlmTemperature] = useState(
    assistant?.llm_temperature ?? defaultValues?.llm_temperature ?? 0.7
  )
  const [thinkingLevel, setThinkingLevel] = useState<string>(assistant?.thinking_level || 'auto')
  const [systemPrompt, setSystemPrompt] = useState(
    assistant?.system_prompt || defaultValues?.system_prompt || ''
  )
  const [openingMessage, setOpeningMessage] = useState(
    assistant?.opening_message || defaultValues?.opening_message || ''
  )
  const [isActive, setIsActive] = useState(assistant?.is_active ?? true)
  const [enableHesitation, setEnableHesitation] = useState(assistant?.enable_hesitation ?? false)
  const [enableSemanticEot, setEnableSemanticEot] = useState(assistant?.enable_semantic_eot ?? false)
  const [sttProvider, setSttProvider] = useState(assistant?.stt_provider || 'auto')
  const [sttLanguages, setSttLanguages] = useState<string[]>(assistant?.stt_languages || [])
  const [createScenarioChecked, setCreateScenarioChecked] = useState(!assistant)

  const handleProviderChange = (provider: string) => {
    setLlmProvider(provider)
    setLlmModel(getDefaultModel(provider as LLMProviderType))
  }

  // ── Dirty tracking ──────────────────────────────────────────────────────────
  const initialValuesRef = useRef({
    name: assistant?.name || defaultValues?.name || '',
    description: assistant?.description || defaultValues?.description || '',
    voiceProvider: assistant?.voice_provider || defaultValues?.voice_provider || 'azure',
    voiceId: assistant?.voice_id || defaultValues?.voice_id || 'en-US-JennyNeural',
    voiceLanguage: assistant?.voice_language || defaultValues?.voice_language || 'en-US',
    llmProvider: assistant?.llm_provider || defaultValues?.llm_provider || 'openai',
    llmModel: assistant?.llm_model || defaultValues?.llm_model || 'gpt-5',
    llmTemperature: assistant?.llm_temperature ?? defaultValues?.llm_temperature ?? 0.7,
    thinkingLevel: assistant?.thinking_level || 'auto',
    systemPrompt: assistant?.system_prompt || defaultValues?.system_prompt || '',
    openingMessage: assistant?.opening_message || defaultValues?.opening_message || '',
    isActive: assistant?.is_active ?? true,
    enableHesitation: assistant?.enable_hesitation ?? false,
    enableSemanticEot: assistant?.enable_semantic_eot ?? false,
    sttProvider: assistant?.stt_provider || 'auto',
    sttLanguages: assistant?.stt_languages || [],
  })

  const isDirty =
    name !== initialValuesRef.current.name ||
    description !== initialValuesRef.current.description ||
    voiceProvider !== initialValuesRef.current.voiceProvider ||
    voiceId !== initialValuesRef.current.voiceId ||
    voiceLanguage !== initialValuesRef.current.voiceLanguage ||
    llmProvider !== initialValuesRef.current.llmProvider ||
    llmModel !== initialValuesRef.current.llmModel ||
    llmTemperature !== initialValuesRef.current.llmTemperature ||
    thinkingLevel !== initialValuesRef.current.thinkingLevel ||
    systemPrompt !== initialValuesRef.current.systemPrompt ||
    openingMessage !== initialValuesRef.current.openingMessage ||
    isActive !== initialValuesRef.current.isActive ||
    enableHesitation !== initialValuesRef.current.enableHesitation ||
    enableSemanticEot !== initialValuesRef.current.enableSemanticEot ||
    sttProvider !== initialValuesRef.current.sttProvider ||
    JSON.stringify(sttLanguages) !== JSON.stringify(initialValuesRef.current.sttLanguages)

  // ── beforeunload guard ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // ── In-app navigation guard ─────────────────────────────────────────────────
  const [showNavDialog, setShowNavDialog] = useState(false)
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)

  useEffect(() => {
    if (!isDirty) return

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      // Only intercept links that navigate away from the current page
      const targetPath = new URL(href, window.location.origin).pathname
      if (targetPath === window.location.pathname) return

      e.preventDefault()
      e.stopPropagation()
      setPendingNavHref(href)
      setShowNavDialog(true)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isDirty])

  // ── Tab management ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('general')

  function handleTabChange(newTab: string) {
    if (!assistant && newTab !== 'general') return
    setActiveTab(newTab)
  }

  // ── Discard ─────────────────────────────────────────────────────────────────
  function handleDiscard() {
    const init = initialValuesRef.current
    setName(init.name)
    setDescription(init.description)
    setVoiceProvider(init.voiceProvider)
    setVoiceId(init.voiceId)
    setVoiceLanguage(init.voiceLanguage)
    setLlmProvider(init.llmProvider)
    setLlmModel(init.llmModel)
    setLlmTemperature(init.llmTemperature)
    setThinkingLevel(init.thinkingLevel)
    setSystemPrompt(init.systemPrompt)
    setOpeningMessage(init.openingMessage)
    setIsActive(init.isActive)
    setEnableHesitation(init.enableHesitation)
  }

  // ── Navigation guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDirty && !hasUndeployedChanges) return

    const savedPath = window.location.pathname + window.location.search

    const handleAnchorClick = (e: MouseEvent) => {
      if (bypassGuardRef.current) return
      const anchor = (e.target as Element).closest('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      try {
        const targetPath = new URL(href, window.location.href).pathname
        if (targetPath !== window.location.pathname) {
          e.preventDefault()
          pendingNavRef.current = href
          setShowLeaveConfirm(true)
        }
      } catch { /* invalid href */ }
    }

    const handlePopState = () => {
      if (bypassGuardRef.current) return
      const newPath = window.location.pathname + window.location.search
      if (newPath !== savedPath) {
        window.history.pushState(null, '', savedPath)
        pendingNavRef.current = newPath
        setShowLeaveConfirm(true)
      }
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }

    document.addEventListener('click', handleAnchorClick, { capture: true })
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('click', handleAnchorClick, { capture: true })
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty, hasUndeployedChanges])

  const handleLeaveWithoutDeploy = () => {
    setShowLeaveConfirm(false)
    bypassGuardRef.current = true
    const target = pendingNavRef.current ?? `/${orgSlug}/assistants`
    pendingNavRef.current = null
    router.push(target)
  }

  const handleLeaveAndDeploy = async () => {
    setShowLeaveConfirm(false)
    setDeploying(true)
    if (isDirty) {
      // Save first
      const data = {
        name, description: description || undefined,
        voice_provider: voiceProvider, voice_id: voiceId, voice_language: voiceLanguage,
        llm_provider: llmProvider, llm_model: llmModel, llm_temperature: llmTemperature,
        system_prompt: systemPrompt || undefined, opening_message: openingMessage || undefined,
        is_active: isActive, enable_hesitation: enableHesitation, enable_semantic_eot: enableSemanticEot,
        stt_provider: sttProvider === 'auto' ? null : sttProvider, stt_languages: sttLanguages.length > 0 ? sttLanguages : null,
      }
      await updateAssistant(assistant!.id, data)
    }
    const { error: deployError } = await deployAssistant(assistant!.id)
    setDeploying(false)
    if (deployError) {
      toast.error(tDeploy('deployError'))
    } else {
      bypassGuardRef.current = true
      const target = pendingNavRef.current ?? `/${orgSlug}/assistants`
      pendingNavRef.current = null
      router.push(target)
    }
  }

  const handleDeploy = async () => {
    setDeploying(true)
    const { error: deployError } = await deployAssistant(assistant!.id)
    setDeploying(false)
    if (deployError) {
      toast.error(tDeploy('deployError'))
    } else {
      toast.success(tDeploy('deploySuccess'))
      setHasUndeployedChanges(false)
      router.refresh()
    }
  }

  const handleRevert = async () => {
    setReverting(true)
    setShowRevertConfirm(false)
    const { error: revertError } = await revertAssistant(assistant!.id)
    setReverting(false)
    if (revertError) {
      toast.error(tDeploy('revertError'))
    } else {
      toast.success(tDeploy('revertSuccess'))
      setHasUndeployedChanges(false)
      router.refresh()
    }
  }

  // ── Collapsible section state ─────────────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(DEFAULT_OPEN)

  useEffect(() => {
    setOpenSections(loadSectionState())
  }, [])

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  // ── Sub-component summary state (for collapsed previews) ────────────────────
  const [toolsSummary, setToolsSummary] = useState('—')
  const [bargeInSummary, setBargeInSummary] = useState('—')
  const [contextSummary, setContextSummary] = useState('—')
  const [varsSummary, setVarsSummary] = useState('—')
  const [webhookSummary, setWebhookSummary] = useState('—')
  const [criteriaSummary, setCriteriaSummary] = useState('—')

  // ── Voice selector state ────────────────────────────────────────────────────
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceSearch, setVoiceSearch] = useState('')

  // ── Knowledge Base state ────────────────────────────────────────────────────
  const [orgKnowledgeBases, setOrgKnowledgeBases] = useState<{ id: string; name: string; description?: string | null }[]>([])
  const [assignedKBs, setAssignedKBs] = useState<{ id: string; name: string; description?: string | null }[]>([])
  const [selectedKBToAdd, setSelectedKBToAdd] = useState<string>('')
  const [kbLoading, setKbLoading] = useState(false)

  // ── MCP Server state ────────────────────────────────────────────────────────
  const [orgMCPServers, setOrgMCPServers] = useState<{ id: string; name: string; description?: string | null }[]>([])
  const [assignedMCPServers, setAssignedMCPServers] = useState<{ id: string; name: string; description?: string | null }[]>([])
  const [selectedMCPToAdd, setSelectedMCPToAdd] = useState<string>('')
  const [mcpLoading, setMcpLoading] = useState(false)

  // ── Webhook Tools state ─────────────────────────────────────────────────────
  const [orgWebhookTools, setOrgWebhookTools] = useState<import('@/types/webhook-tools').WebhookTool[]>([])
  const [assignedWebhookTools, setAssignedWebhookTools] = useState<import('@/types/webhook-tools').WebhookTool[]>([])

  // ── Phoneme Sets state ──────────────────────────────────────────────────────
  const [orgPhonemeSets, setOrgPhonemeSets] = useState<PhonemeSet[]>([])
  const [assignedPhonemeSetIds, setAssignedPhonemeSetIds] = useState<Set<string>>(new Set())
  const [phonemeLoading, setPhonemeLoading] = useState(false)

  // ── Data loaders ────────────────────────────────────────────────────────────
  const loadKnowledgeBases = async () => {
    setKbLoading(true)
    const [orgKBResult, assignedKBResult] = await Promise.all([
      getOrganizationKnowledgeBases(organizationId),
      getAssistantKnowledgeBases(assistant!.id),
    ])
    setOrgKnowledgeBases(orgKBResult.knowledgeBases as unknown as { id: string; name: string; description?: string | null }[])
    setAssignedKBs(assignedKBResult.knowledgeBases as unknown as { id: string; name: string; description?: string | null }[])
    setKbLoading(false)
  }

  const loadMCPServers = async () => {
    setMcpLoading(true)
    const [orgResult, assignedResult] = await Promise.all([
      getOrganizationMCPServers(organizationId),
      getAssistantMCPServers(assistant!.id),
    ])
    setOrgMCPServers(orgResult.servers)
    setAssignedMCPServers(assignedResult.servers)
    setMcpLoading(false)
  }

  const loadPhonemeSets = async () => {
    setPhonemeLoading(true)
    const [orgResult, assignedResult] = await Promise.all([
      getPhonemeSets(organizationId),
      getAssistantPhonemeSets(assistant!.id),
    ])
    setOrgPhonemeSets(orgResult.sets)
    setAssignedPhonemeSetIds(new Set(assignedResult.assignments.map((a) => a.phoneme_set_id)))
    setPhonemeLoading(false)
  }

  const loadWebhookTools = async () => {
    const [orgResult, assignedResult] = await Promise.all([
      getOrganizationWebhookTools(organizationId),
      getAssistantWebhookTools(assistant!.id),
    ])
    setOrgWebhookTools(orgResult.tools)
    setAssignedWebhookTools(assignedResult.tools)
  }

  useEffect(() => {
    if (assistant?.id) {
      loadKnowledgeBases()
      loadMCPServers()
      loadPhonemeSets()
      loadWebhookTools()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistant?.id])

  const availableKBs = orgKnowledgeBases.filter(
    (kb) => !assignedKBs.some((a) => a.id === kb.id)
  )

  const availableWebhookTools = orgWebhookTools.filter(
    (t) => !assignedWebhookTools.some((a) => a.id === t.id)
  )
  const availableMCPServers = orgMCPServers.filter(
    (s) => !assignedMCPServers.some((a) => a.id === s.id)
  )

  const handleAssignKB = async () => {
    if (!selectedKBToAdd || !assistant?.id) return
    setKbLoading(true)
    await assignKnowledgeBaseToAssistant(assistant.id, selectedKBToAdd)
    setSelectedKBToAdd('')
    await loadKnowledgeBases()
    setKbLoading(false)
  }

  const handleUnassignKB = async (kbId: string) => {
    if (!assistant?.id) return
    setKbLoading(true)
    await unassignKnowledgeBaseFromAssistant(assistant.id, kbId)
    await loadKnowledgeBases()
    setKbLoading(false)
  }

  const handleAssignMCP = async () => {
    if (!selectedMCPToAdd || !assistant?.id) return
    setMcpLoading(true)
    await assignMCPServerToAssistant(assistant.id, selectedMCPToAdd)
    setSelectedMCPToAdd('')
    await loadMCPServers()
    setMcpLoading(false)
  }

  const handleUnassignMCP = async (serverId: string) => {
    if (!assistant?.id) return
    setMcpLoading(true)
    await unassignMCPServerFromAssistant(assistant.id, serverId)
    await loadMCPServers()
    setMcpLoading(false)
  }

  const handleTogglePhonemeSet = async (setId: string, currentlyAssigned: boolean) => {
    if (!assistant?.id) return
    setPhonemeLoading(true)
    if (currentlyAssigned) {
      await removePhonemeSetFromAssistant(assistant.id, setId)
      setAssignedPhonemeSetIds((prev) => {
        const next = new Set(prev)
        next.delete(setId)
        return next
      })
    } else {
      const position = assignedPhonemeSetIds.size
      await assignPhonemeSetToAssistant(assistant.id, setId, position)
      setAssignedPhonemeSetIds((prev) => new Set([...prev, setId]))
    }
    setPhonemeLoading(false)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const data = {
      name,
      description: description || undefined,
      voice_provider: voiceProvider,
      voice_id: voiceId,
      voice_language: voiceLanguage,
      llm_provider: llmProvider,
      llm_model: llmModel,
      llm_temperature: llmTemperature,
      thinking_level: thinkingLevel === 'auto' ? null : thinkingLevel,
      system_prompt: systemPrompt || undefined,
      opening_message: openingMessage || undefined,
      is_active: isActive,
      enable_hesitation: enableHesitation,
      enable_semantic_eot: enableSemanticEot,
      stt_provider: sttProvider === 'auto' ? null : sttProvider,
      stt_languages: sttLanguages.length > 0 ? sttLanguages : null,
    }

    const result = assistant
      ? await updateAssistant(assistant.id, data)
      : await createAssistant(organizationId, { ...data, create_scenario: createScenarioChecked })

    if ('error' in result && result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      if (assistant) {
        setIsLoading(false)
        setSaveSuccess(true)
        // Update initial values so isDirty resets
        initialValuesRef.current = {
          name,
          description,
          voiceProvider,
          voiceId,
          voiceLanguage,
          llmProvider,
          llmModel,
          llmTemperature,
          thinkingLevel,
          systemPrompt,
          openingMessage,
          isActive,
          enableHesitation,
          enableSemanticEot,
          sttProvider,
          sttLanguages,
        }
        setHasUndeployedChanges(true)
        router.refresh()
        setTimeout(() => setSaveSuccess(false), 2000)
      } else {
        router.push(`/${orgSlug}/assistants`)
        router.refresh()
      }
    }
  }

  // ── Disabled tab wrapper ────────────────────────────────────────────────────
  function DisabledTabTrigger({
    value,
    icon,
    label,
  }: {
    value: string
    icon: React.ReactNode
    label: string
  }) {
    const isDisabled = !assistant

    if (!isDisabled) {
      return (
        <TabsTrigger value={value} className="flex items-center gap-1.5">
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </TabsTrigger>
      )
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex flex-1">
            <TabsTrigger
              value={value}
              disabled
              className="flex items-center gap-1.5 flex-1 opacity-50 cursor-not-allowed"
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('saveFirst')}</TooltipContent>
      </Tooltip>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit}>
      {/* Navigation-away guard */}
      <AlertDialog open={showNavDialog} onOpenChange={setShowNavDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unsavedChanges.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('unsavedChanges.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowNavDialog(false); setPendingNavHref(null) }}>
              {tCommon('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowNavDialog(false)
                if (pendingNavHref) router.push(pendingNavHref)
              }}
            >
              {t('unsavedChanges.leave')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-900">
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          {/* Allgemein */}
          <TabsTrigger value="general" className="flex items-center gap-1.5">
            <Settings className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{t('tabs.general')}</span>
          </TabsTrigger>

          {/* Eigenschaften */}
          <DisabledTabTrigger
            value="properties"
            icon={<Sliders className="h-4 w-4 shrink-0" />}
            label={t('tabs.properties')}
          />

          {/* Kontext & Wissen */}
          <DisabledTabTrigger
            value="knowledge"
            icon={<Database className="h-4 w-4 shrink-0" />}
            label={t('tabs.knowledge')}
          />

          {/* Analyse */}
          <DisabledTabTrigger
            value="analysis"
            icon={<BarChart2 className="h-4 w-4 shrink-0" />}
            label={t('tabs.analysis')}
          />
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: ALLGEMEIN                                                      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="general" className="space-y-0">
          {/* Grundinformationen */}
          <SectionCollapsible
            id={SECTION_IDS.GENERAL_BASIC}
            title={t('basicInfo')}
            open={openSections[SECTION_IDS.GENERAL_BASIC]}
            onToggle={toggleSection}
            preview={
              <PreviewText>
                {name || '—'}
                {description ? ` · ${description.length > 50 ? description.substring(0, 50) + '…' : description}` : ''}
              </PreviewText>
            }
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {assistant?.avatar_url ? (
                  <img
                    src={assistant.avatar_url}
                    alt={assistant.name}
                    className="w-14 h-14 rounded-full object-cover shrink-0"
                  />
                ) : assistant ? (
                  <div className="w-14 h-14 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0">
                    <Bot className="h-7 w-7 text-neutral-400" />
                  </div>
                ) : null}
                <div className="flex-1 min-w-0">
                  <Label htmlFor="name">{t('name')} *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('namePlaceholder')}
                    required
                    disabled={isLoading}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">{t('description')}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  rows={2}
                  disabled={isLoading}
                />
              </div>
            </div>
          </SectionCollapsible>

          {/* Funktionen */}
          <SectionCollapsible
            id={SECTION_IDS.GENERAL_FEATURES}
            title={t('featuresSection')}
            open={openSections[SECTION_IDS.GENERAL_FEATURES]}
            onToggle={toggleSection}
            className="border-t mt-4 pt-4"
            preview={
              <PreviewChips items={[
                ...(isActive ? [t('activeCanReceiveCalls').replace(' (kann Anrufe empfangen)', '')] : []),
                ...(enableHesitation ? ['Tool-Ankündigung'] : []),
              ]} />
            }
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="is_active" className="font-medium cursor-pointer">
                    {t('activeCanReceiveCalls')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('activeDescription')}</p>
                </div>
                <Switch
                  id="is_active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={isLoading}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="enable_hesitation" className="font-medium cursor-pointer">
                    {t('enableHesitation')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('hesitationDescription')}</p>
                </div>
                <Switch
                  id="enable_hesitation"
                  checked={enableHesitation}
                  onCheckedChange={setEnableHesitation}
                  disabled={isLoading}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="enable_semantic_eot" className="font-medium cursor-pointer">
                    {t('enableSemanticEot')}{' '}
                    <span className="text-xs font-normal text-muted-foreground">{t('experimental')}</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('semanticEotDescription')}</p>
                </div>
                <Switch
                  id="enable_semantic_eot"
                  checked={enableSemanticEot}
                  onCheckedChange={setEnableSemanticEot}
                  disabled={isLoading}
                />
              </div>
            </div>
          </SectionCollapsible>

          {/* Eröffnungsnachricht */}
          <SectionCollapsible
            id={SECTION_IDS.GENERAL_OPENING}
            title={t('openingMessage')}
            hint={t('openingMessageHint')}
            open={openSections[SECTION_IDS.GENERAL_OPENING]}
            onToggle={toggleSection}
            className="border-t mt-4 pt-4"
            preview={
              openingMessage
                ? <PreviewText>&bdquo;{openingMessage.length > 70 ? openingMessage.substring(0, 70) + '…' : openingMessage}&ldquo;</PreviewText>
                : <PreviewText>—</PreviewText>
            }
          >
            <Textarea
              id="opening_message"
              value={openingMessage}
              onChange={(e) => setOpeningMessage(e.target.value)}
              placeholder={t('openingMessagePlaceholder')}
              rows={3}
              disabled={isLoading}
            />
          </SectionCollapsible>

          {/* System Prompt */}
          <SectionCollapsible
            id={SECTION_IDS.GENERAL_PROMPT}
            title={t('systemPrompt')}
            hint={t('systemPromptHint')}
            open={openSections[SECTION_IDS.GENERAL_PROMPT]}
            onToggle={toggleSection}
            className="border-t mt-4 pt-4"
            preview={
              systemPrompt
                ? <PreviewText>{systemPrompt.length > 90 ? systemPrompt.substring(0, 90) + '…' : systemPrompt}</PreviewText>
                : <PreviewText>—</PreviewText>
            }
            headerExtra={
              openSections[SECTION_IDS.GENERAL_PROMPT] ? (
                assistant ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <PromptVersionHistory
                      assistantId={assistant.id}
                      currentPrompt={systemPrompt}
                      onRestore={() => router.refresh()}
                    />
                    <ModelComparisonDialog systemPrompt={systemPrompt} disabled={isLoading} />
                  </div>
                ) : (
                  <div onClick={(e) => e.stopPropagation()}>
                    <ModelComparisonDialog systemPrompt={systemPrompt} disabled={isLoading} />
                  </div>
                )
              ) : undefined
            }
          >
            <PromptEditor
              value={systemPrompt}
              onChange={setSystemPrompt}
              placeholder={t('systemPromptPlaceholder')}
              disabled={isLoading}
              organizationId={organizationId}
            />
          </SectionCollapsible>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: EIGENSCHAFTEN                                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {assistant && (
          <TabsContent value="properties" className="space-y-0" forceMount hidden={activeTab !== 'properties'}>
            {/* Stimme */}
            <SectionCollapsible
              id={SECTION_IDS.PROPS_VOICE}
              title={t('voiceSettings')}
              open={openSections[SECTION_IDS.PROPS_VOICE]}
              onToggle={toggleSection}
              preview={(() => {
                const voice = findVoice(voiceProvider, voiceId)
                const providerLabel = voiceProvider === 'azure' ? 'Azure' : 'ElevenLabs'
                const voiceLabel = voice ? `${voice.flag ? voice.flag + ' ' : ''}${voice.name}` : voiceId
                return <PreviewChips items={[providerLabel, voiceLabel, voiceLanguage]} />
              })()}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="voice_provider">{t('voiceProvider')}</Label>
                  <Select value={voiceProvider} onValueChange={setVoiceProvider} disabled={isLoading}>
                    <SelectTrigger id="voice_provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="azure">{tForm('voiceProviderAzure')}</SelectItem>
                      <SelectItem value="elevenlabs">{tForm('voiceProviderElevenLabs')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('voiceId')}</Label>
                  <Popover open={voiceOpen} onOpenChange={(open) => {
                    setVoiceOpen(open)
                    if (!open) setVoiceSearch('')
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={voiceOpen}
                        disabled={isLoading}
                        className="w-full justify-between font-normal h-9"
                      >
                        {(() => {
                          const voice = findVoice(voiceProvider, voiceId)
                          if (voice) {
                            return <span>{voice.flag ? `${voice.flag} ` : ''}{voice.name} ({voice.gender})</span>
                          }
                          return <span className="text-muted-foreground">{t('voiceId')}...</span>
                        })()}
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <div className="flex items-center border-b px-3 py-2">
                        <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
                        <input
                          className="flex h-7 w-full rounded-sm bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          placeholder={t('voiceId') + '...'}
                          value={voiceSearch}
                          onChange={(e) => setVoiceSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto p-1">
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
                            return <p className="py-4 text-center text-sm text-muted-foreground">{tForm('noVoicesFound')}</p>
                          }
                          return filtered.map((voice) => (
                            <button
                              key={voice.id}
                              type="button"
                              className={cn(
                                'w-full text-left rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
                                voiceId === voice.id && 'bg-accent text-accent-foreground'
                              )}
                              onClick={() => {
                                setVoiceId(voice.id)
                                if (voice.lang) setVoiceLanguage(voice.lang)
                                setVoiceOpen(false)
                                setVoiceSearch('')
                              }}
                            >
                              <div className="flex items-center gap-1">
                                {voice.flag && <span>{voice.flag}</span>}
                                <span className="font-medium">{voice.name}</span>
                                <span className="text-muted-foreground">({voice.gender})</span>
                                {voiceId === voice.id && <Check className="ml-auto h-4 w-4" />}
                              </div>
                              {voice.desc && (
                                <p className="text-xs text-muted-foreground ml-0.5">{voice.desc}</p>
                              )}
                            </button>
                          ))
                        })()}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="voice_language">{t('voiceLanguage')}</Label>
                  <Select value={voiceLanguage} onValueChange={setVoiceLanguage} disabled={isLoading}>
                    <SelectTrigger id="voice_language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de-DE">{tForm('languageDe')}</SelectItem>
                      <SelectItem value="en-US">{tForm('languageEnUS')}</SelectItem>
                      <SelectItem value="en-GB">{tForm('languageEnGB')}</SelectItem>
                      <SelectItem value="es-ES">{tForm('languageEs')}</SelectItem>
                      <SelectItem value="fr-FR">{tForm('languageFr')}</SelectItem>
                      <SelectItem value="it-IT">{tForm('languageIt')}</SelectItem>
                      <SelectItem value="nl-NL">{tForm('languageNl')}</SelectItem>
                      <SelectItem value="pl-PL">{tForm('languagePl')}</SelectItem>
                      <SelectItem value="pt-BR">{tForm('languagePt')}</SelectItem>
                      <SelectItem value="tr-TR">{tForm('languageTr')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SectionCollapsible>

            {/* STT-Einstellungen */}
            <SectionCollapsible
              id={SECTION_IDS.PROPS_STT}
              title={t('sttSettings')}
              hint={t('sttSettingsHint')}
              open={openSections[SECTION_IDS.PROPS_STT]}
              onToggle={toggleSection}
              className="border-t mt-4 pt-4"
              preview={(() => {
                if (sttProvider === 'auto') return <PreviewChips items={[t('sttProviderAuto')]} />
                const langs = sttLanguages.length > 0 ? sttLanguages : [t('sttLanguageAuto')]
                return <PreviewChips items={[sttProvider, ...langs]} />
              })()}
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="stt_provider">{t('sttProvider')}</Label>
                  <Select
                    value={sttProvider}
                    onValueChange={(val) => {
                      setSttProvider(val)
                      setSttLanguages([])
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="stt_provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t('sttProviderAuto')}</SelectItem>
                      <SelectItem value="AZURE">{t('sttProviderAzure')}</SelectItem>
                      <SelectItem value="DEEPGRAM">{t('sttProviderDeepgram')}</SelectItem>
                      <SelectItem value="ELEVEN_LABS">{t('sttProviderElevenLabs')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sttProvider !== 'auto' && (
                  <div className="space-y-1.5">
                    <Label>{t('sttLanguages')}</Label>
                    <p className="text-xs text-muted-foreground">{t(sttProvider === 'AZURE' ? 'sttLanguagesHintAzure' : 'sttLanguagesHintSingle')}</p>
                    {sttProvider === 'AZURE' ? (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { code: 'de-DE', label: tForm('languageDe') },
                          { code: 'en-US', label: tForm('languageEnUS') },
                          { code: 'en-GB', label: tForm('languageEnGB') },
                          { code: 'fr-FR', label: tForm('languageFr') },
                          { code: 'es-ES', label: tForm('languageEs') },
                          { code: 'it-IT', label: tForm('languageIt') },
                          { code: 'nl-NL', label: tForm('languageNl') },
                          { code: 'pl-PL', label: tForm('languagePl') },
                          { code: 'pt-BR', label: tForm('languagePt') },
                          { code: 'tr-TR', label: tForm('languageTr') },
                        ].map(({ code, label }) => {
                          const checked = sttLanguages.includes(code)
                          const atLimit = sttLanguages.length >= 4
                          return (
                            <label key={code} className={cn('flex items-center gap-2 text-sm cursor-pointer', !checked && atLimit && 'opacity-40 cursor-not-allowed')}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isLoading || (!checked && atLimit)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSttLanguages((prev) => [...prev, code])
                                  } else {
                                    setSttLanguages((prev) => prev.filter((l) => l !== code))
                                  }
                                }}
                              />
                              {label}
                            </label>
                          )
                        })}
                      </div>
                    ) : (
                      <Select
                        value={sttLanguages[0] || 'auto'}
                        onValueChange={(val) => setSttLanguages(val === 'auto' ? [] : [val])}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">{t('sttLanguageAuto')}</SelectItem>
                          <SelectItem value="de-DE">{tForm('languageDe')}</SelectItem>
                          <SelectItem value="en-US">{tForm('languageEnUS')}</SelectItem>
                          <SelectItem value="en-GB">{tForm('languageEnGB')}</SelectItem>
                          <SelectItem value="fr-FR">{tForm('languageFr')}</SelectItem>
                          <SelectItem value="es-ES">{tForm('languageEs')}</SelectItem>
                          <SelectItem value="it-IT">{tForm('languageIt')}</SelectItem>
                          <SelectItem value="nl-NL">{tForm('languageNl')}</SelectItem>
                          <SelectItem value="pl-PL">{tForm('languagePl')}</SelectItem>
                          <SelectItem value="pt-BR">{tForm('languagePt')}</SelectItem>
                          <SelectItem value="tr-TR">{tForm('languageTr')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            </SectionCollapsible>

            {/* Aussprache-Sets (ElevenLabs only) */}
            {voiceProvider === 'elevenlabs' && (
              <SectionCollapsible
                id={SECTION_IDS.PROPS_PHONEME}
                title={t('phonemeSets')}
                hint={t('phonemeSetsHint')}
                open={openSections[SECTION_IDS.PROPS_PHONEME]}
                onToggle={toggleSection}
                className="border-t mt-4 pt-4"
                preview={
                  <PreviewText>
                    {assignedPhonemeSetIds.size > 0
                      ? `${assignedPhonemeSetIds.size} ${assignedPhonemeSetIds.size === 1 ? 'Set' : 'Sets'} aktiv`
                      : '—'}
                  </PreviewText>
                }
              >
                {phonemeLoading ? (
                  <p className="text-sm text-muted-foreground">{t('phonemeSetsLoading')}</p>
                ) : orgPhonemeSets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('phonemeSetsNone')}</p>
                ) : (
                  <div className="space-y-2">
                    {orgPhonemeSets.map((ps) => {
                      const isAssigned = assignedPhonemeSetIds.has(ps.id)
                      const entryCount = (ps.entries ?? []).filter((e) => e.is_active).length
                      return (
                        <div key={ps.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{ps.name}</p>
                            {ps.description && (
                              <p className="text-xs text-muted-foreground">{ps.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {t('phonemeSetsActiveEntries', { count: entryCount })}
                            </p>
                          </div>
                          <Switch
                            checked={isAssigned}
                            onCheckedChange={() => handleTogglePhonemeSet(ps.id, isAssigned)}
                            disabled={phonemeLoading}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCollapsible>
            )}

            {/* KI-Modell */}
            <SectionCollapsible
              id={SECTION_IDS.PROPS_LLM}
              title={t('llmSettings')}
              open={openSections[SECTION_IDS.PROPS_LLM]}
              onToggle={toggleSection}
              className="border-t mt-4 pt-4"
              preview={
                <PreviewChips items={[
                  llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1),
                  llmModel,
                  `T: ${llmTemperature.toFixed(1)}`,
                ]} />
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="llm_provider">{t('llmProvider')}</Label>
                    <Select value={llmProvider} onValueChange={handleProviderChange} disabled={isLoading}>
                      <SelectTrigger id="llm_provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">{tForm('llmProviderOpenAI')}</SelectItem>
                        <SelectItem value="google">{tForm('llmProviderGoogle')}</SelectItem>
                        <SelectItem value="mistral">{tForm('llmProviderMistral')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="llm_model">{t('llmModel')}</Label>
                    <Select value={llmModel} onValueChange={setLlmModel} disabled={isLoading}>
                      <SelectTrigger id="llm_model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getModelsByProvider(llmProvider as LLMProviderType).map(({ model, label }) => (
                          <SelectItem key={model} value={model}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="llm_temperature">
                        {t('temperature')}
                      </Label>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {llmTemperature.toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      id="llm_temperature"
                      min={0}
                      max={2}
                      step={0.1}
                      value={[llmTemperature]}
                      onValueChange={([v]) => setLlmTemperature(v)}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t('temperatureHint')}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="thinking_level">
                      {t('thinkingLevel')}
                    </Label>
                    <Select
                      value={thinkingLevel}
                      onValueChange={setThinkingLevel}
                      disabled={isLoading || llmProvider !== 'google'}
                    >
                      <SelectTrigger id="thinking_level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">{t('thinkingLevelAuto')}</SelectItem>
                        <SelectItem value="minimal">{t('thinkingLevelMinimal')}</SelectItem>
                        <SelectItem value="low">{t('thinkingLevelLow')}</SelectItem>
                        <SelectItem value="medium">{t('thinkingLevelMedium')}</SelectItem>
                        <SelectItem value="high">{t('thinkingLevelHigh')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {llmProvider !== 'google'
                        ? 'Nur für Google-Modelle verfügbar'
                        : t('thinkingLevelHint')}
                    </p>
                  </div>
                </div>
              </div>
            </SectionCollapsible>

            {/* Gesprächsverhalten (Barge-In) */}
            <SectionCollapsible
              id={SECTION_IDS.PROPS_BARGEIN}
              title={t('bargeInSection')}
              hint={t('bargeInSectionHint')}
              open={openSections[SECTION_IDS.PROPS_BARGEIN]}
              onToggle={toggleSection}
              className="border-t mt-4 pt-4"
              preview={<PreviewText>{bargeInSummary}</PreviewText>}
            >
              <BargeInSection assistantId={assistant.id} organizationId={organizationId} onSummaryChange={setBargeInSummary} />
            </SectionCollapsible>
          </TabsContent>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: KONTEXT & WISSEN                                               */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {assistant && (
          <TabsContent value="knowledge" className="space-y-0" forceMount hidden={activeTab !== 'knowledge'}>
            {/* Wissensdatenbanken */}
            <SectionCollapsible
              id={SECTION_IDS.KW_KB}
              title={t('knowledgeBase')}
              hint={t('knowledgeBaseHint')}
              open={openSections[SECTION_IDS.KW_KB]}
              onToggle={toggleSection}
              preview={
                <PreviewText>
                  {assignedKBs.length > 0
                    ? assignedKBs.map((kb) => kb.name).join(', ')
                    : '—'}
                </PreviewText>
              }
              headerExtra={
                assignedKBs.length > 0 ? (
                  <Badge variant="secondary">{assignedKBs.length} {t('assigned')}</Badge>
                ) : undefined
              }
            >
              {assignedKBs.length > 0 && (
                <div className="space-y-2 mb-3">
                  {assignedKBs.map((kb) => (
                    <div
                      key={kb.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50"
                    >
                      <div className="flex items-center gap-2">
                        <Book className="h-4 w-4 text-neutral-400 shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{kb.name}</p>
                          {kb.description && <p className="text-xs text-neutral-500">{kb.description}</p>}
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleUnassignKB(kb.id)} disabled={kbLoading}>
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {availableKBs.length > 0 && (
                <div className="flex gap-2">
                  <Select value={selectedKBToAdd} onValueChange={setSelectedKBToAdd} disabled={kbLoading}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t('selectKnowledgeBase')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableKBs.map((kb) => (
                        <SelectItem key={kb.id} value={kb.id}>{kb.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={handleAssignKB} disabled={!selectedKBToAdd || kbLoading}>
                    <Plus className="h-4 w-4 mr-2" />{tCommon('add')}
                  </Button>
                </div>
              )}
              {assignedKBs.length === 0 && availableKBs.length === 0 && (
                <div className="text-center py-8 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700">
                  <Book className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
                  <p className="text-sm text-neutral-500">{t('noKnowledgeBases')}</p>
                  <p className="text-xs text-neutral-400 mt-1">{t('createKnowledgeBaseFirst')}</p>
                </div>
              )}
            </SectionCollapsible>

            {/* MCP-Server */}
            <SectionCollapsible
              id={SECTION_IDS.KW_MCP}
              title={t('mcpServer')}
              hint={t('mcpServerHint')}
              open={openSections[SECTION_IDS.KW_MCP]}
              onToggle={toggleSection}
              className="border-t mt-4 pt-4"
              preview={
                <PreviewText>
                  {assignedMCPServers.length > 0
                    ? assignedMCPServers.map((s) => s.name).join(', ')
                    : '—'}
                </PreviewText>
              }
              headerExtra={
                assignedMCPServers.length > 0 ? (
                  <Badge variant="secondary">{assignedMCPServers.length} {t('connected')}</Badge>
                ) : undefined
              }
            >
              {assignedMCPServers.length > 0 && (
                <div className="space-y-2 mb-3">
                  {assignedMCPServers.map((server) => (
                    <div
                      key={server.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50"
                    >
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-neutral-400 shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{server.name}</p>
                          {server.description && <p className="text-xs text-neutral-500">{server.description}</p>}
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleUnassignMCP(server.id)} disabled={mcpLoading}>
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {availableMCPServers.length > 0 && (
                <div className="flex gap-2">
                  <Select value={selectedMCPToAdd} onValueChange={setSelectedMCPToAdd} disabled={mcpLoading}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t('selectMcpServer')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMCPServers.map((server) => (
                        <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={handleAssignMCP} disabled={!selectedMCPToAdd || mcpLoading}>
                    <Plus className="h-4 w-4 mr-2" />{tCommon('add')}
                  </Button>
                </div>
              )}
              {assignedMCPServers.length === 0 && availableMCPServers.length === 0 && (
                <div className="text-center py-8 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700">
                  <Server className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
                  <p className="text-sm text-neutral-500">{t('noMcpServers')}</p>
                  <p className="text-xs text-neutral-400 mt-1">{t('createMcpServerFirst')}</p>
                </div>
              )}
            </SectionCollapsible>

            {/* HTTP-Webhook-Tools */}
            <SectionCollapsible
              id={SECTION_IDS.KW_WEBHOOK_TOOLS}
              title={t('webhookTools')}
              hint={t('webhookToolsHint')}
              open={openSections[SECTION_IDS.KW_WEBHOOK_TOOLS]}
              onToggle={toggleSection}
              className="border-t mt-4 pt-4"
              preview={
                <PreviewText>
                  {assignedWebhookTools.length > 0
                    ? assignedWebhookTools.map(wt => wt.name).join(', ')
                    : '—'}
                </PreviewText>
              }
              headerExtra={
                assignedWebhookTools.length > 0 ? (
                  <Badge variant="secondary">{assignedWebhookTools.length} {t('connected')}</Badge>
                ) : undefined
              }
            >
              <WebhookToolsSection
                assistantId={assistant.id}
                assignedTools={assignedWebhookTools}
                availableTools={availableWebhookTools}
                orgSlug={orgSlug}
              />
            </SectionCollapsible>

            {/* Anruf-Tools */}
            <SectionCollapsible
              id={SECTION_IDS.KW_TOOLS}
              title={t('callTools')}
              hint={t('callToolsHint')}
              open={openSections[SECTION_IDS.KW_TOOLS]}
              onToggle={toggleSection}
              className="border-t mt-4 pt-4"
              preview={<PreviewText>{toolsSummary}</PreviewText>}
            >
              <CallToolsSection assistantId={assistant.id} organizationId={organizationId} onSummaryChange={setToolsSummary} />
            </SectionCollapsible>

            {/* Kontext-Webhooks */}
            <SectionCollapsible
              id={SECTION_IDS.KW_CONTEXT}
              title={t('contextWebhooks')}
              hint={t('contextWebhooksHint')}
              open={openSections[SECTION_IDS.KW_CONTEXT]}
              onToggle={toggleSection}
              className="border-t mt-4 pt-4"
              preview={<PreviewText>{contextSummary}</PreviewText>}
            >
              <ContextWebhookSection assistantId={assistant.id} organizationId={organizationId} onSummaryChange={setContextSummary} />
            </SectionCollapsible>
          </TabsContent>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: ANALYSE                                                        */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {assistant && (
          <TabsContent value="analysis" className="space-y-0" forceMount hidden={activeTab !== 'analysis'}>
            {/* Variablen */}
            <SectionCollapsible
              id={SECTION_IDS.ANA_VARS}
              title={t('variables')}
              open={openSections[SECTION_IDS.ANA_VARS]}
              onToggle={toggleSection}
              preview={<PreviewText>{varsSummary}</PreviewText>}
            >
              <VariableDefinitionsSection assistantId={assistant.id} organizationId={organizationId} onSummaryChange={setVarsSummary} />
            </SectionCollapsible>

            {/* Datenübertragung */}
            <SectionCollapsible
              id={SECTION_IDS.ANA_WEBHOOKS}
              title={t('dataTransfer')}
              hint={t('dataTransferHint')}
              open={openSections[SECTION_IDS.ANA_WEBHOOKS]}
              onToggle={toggleSection}
              className="border-t mt-4 pt-4"
              preview={<PreviewText>{webhookSummary}</PreviewText>}
            >
              <WebhookConfigSection assistantId={assistant.id} organizationId={organizationId} onSummaryChange={setWebhookSummary} />
            </SectionCollapsible>

            {/* Anrufkriterien */}
            <SectionCollapsible
              id={SECTION_IDS.ANA_CRITERIA}
              title={t('criteriaSection')}
              hint={t('criteriaSectionHint')}
              open={openSections[SECTION_IDS.ANA_CRITERIA]}
              onToggle={toggleSection}
              className="border-t mt-4 pt-4"
              preview={<PreviewText>{criteriaSummary}</PreviewText>}
            >
              <AssistantCriteriaList organizationId={organizationId} assistantId={assistant.id} onSummaryChange={setCriteriaSummary} />
            </SectionCollapsible>
          </TabsContent>
        )}
      </Tabs>

      {/* Create-Modus: normaler Submit-Button */}
      {!assistant && (
        <div className="pt-6 mt-6 border-t space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="create-scenario"
              checked={createScenarioChecked}
              onCheckedChange={(v) => setCreateScenarioChecked(!!v)}
            />
            <Label htmlFor="create-scenario" className="font-normal cursor-pointer">
              {t('autoCreateScenario')}
            </Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/${orgSlug}/assistants`)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{tCommon('creating')}</>
              ) : (
                t('createAssistant')
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Sticky Save Bar – bei ungespeicherten Änderungen */}
      {assistant && isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{t('unsavedChanges.hint')}</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={isLoading}
              >
                {t('unsavedChanges.discard')}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
                className={saveSuccess ? 'bg-lime-600 hover:bg-lime-600' : ''}
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{tCommon('saving')}</>
                ) : saveSuccess ? (
                  <><Check className="h-4 w-4 mr-2" />{tCommon('saved')}</>
                ) : (
                  tCommon('saveChanges')
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Deploy Bar – gespeichert aber noch nicht deployed */}
      {assistant && !isDirty && hasUndeployedChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{tDeploy('undeployedHint')}</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="h-4 w-4 mr-1" />
                {tDeploy('history')}
              </Button>
              {assistant.deployed_at && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRevertConfirm(true)}
                  disabled={reverting}
                >
                  {reverting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-1" />
                  )}
                  {tDeploy('revert')}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleDeploy}
                disabled={deploying}
                className="animate-pulse bg-orange-500/90 hover:bg-orange-500/80 hover:animate-none text-white border-0"
              >
                {deploying ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-1" />
                )}
                {tDeploy('deployButton')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Revert confirmation */}
      <AlertDialog open={showRevertConfirm} onOpenChange={setShowRevertConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tDeploy('revertConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{tDeploy('revertConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevert}>{tDeploy('revert')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave with undeployed changes */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tDeploy('leaveConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{tDeploy('leaveConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <Button variant="outline" onClick={handleLeaveWithoutDeploy}>
              {tDeploy('leaveWithoutDeploy')}
            </Button>
            <AlertDialogAction onClick={handleLeaveAndDeploy} disabled={deploying}>
              {deploying && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {tDeploy('leaveAndDeploy')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deploy history */}
      <AssistantHistorySheet
        assistantId={assistant?.id ?? ''}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestore={() => {
          setHasUndeployedChanges(false)
          router.refresh()
        }}
      />
    </form>
  )
}
