'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type OnConnect,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, Loader2, ArrowLeft, Zap, Check, RotateCcw, History, Settings, Hash, ListTree, Bot, ChevronDown, PhoneForwarded } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { ScenarioNode, ScenarioEdge, CallScenario } from '@/types/scenarios'
import { ScenarioNodeComponent, PhoneNumberNodeComponent, DTMFCollectNodeComponent, DTMFMenuNodeComponent, PhoneTransferNodeComponent } from './scenario-node'
import { ScenarioNodeConfig } from './scenario-node-config'
import { DTMFMenuEdge, DTMFEdgeClickContext } from './dtmf-menu-edge'
import { DTMFKeypadWheel } from './dtmf-keypad-wheel'
import { ScenarioHistorySheet } from './scenario-history-sheet'
import { ScenarioSettingsSheet } from './scenario-settings-sheet'
import { updateScenario, deployScenario, revertScenario } from '@/lib/actions/scenarios'
import type { ToolModelConfig } from '@/lib/tool-model'
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

const PHONE_NODE_ID = '__phone_number__'
const PHONE_EDGE_ID = '__phone_to_entry__'

interface AssistantOption {
  id: string
  name: string
  avatar_url: string | null
  transfer_instruction: string | null
}

interface ScenarioBuilderProps {
  scenario: CallScenario
  assistants: AssistantOption[]
  orgSlug: string
  toolModel: ToolModelConfig
}

const nodeTypes = {
  entry_agent: ScenarioNodeComponent,
  agent: ScenarioNodeComponent,
  dtmf_collect: DTMFCollectNodeComponent,
  dtmf_menu: DTMFMenuNodeComponent,
  phone_transfer: PhoneTransferNodeComponent,
  phone_number: PhoneNumberNodeComponent,
}

const edgeTypes = {
  dtmf_menu_edge: DTMFMenuEdge,
}

function buildPhoneNode(phoneNumber: string, entryNode?: ScenarioNode): ScenarioNode {
  return {
    id: PHONE_NODE_ID,
    type: 'phone_number' as ScenarioNode['type'],
    position: entryNode
      ? { x: entryNode.position.x + 16, y: entryNode.position.y - 90 }
      : { x: 116, y: 110 },
    data: { phone_number: phoneNumber } as unknown as ScenarioNode['data'],
    draggable: false,
    selectable: false,
    deletable: false,
  }
}

export function ScenarioBuilder({ scenario, assistants, orgSlug, toolModel }: ScenarioBuilderProps) {
  const router = useRouter()
  const t = useTranslations('scenarios')

  const initialNodes = useMemo(() => {
    if (!scenario.phone_number) return scenario.nodes
    const entryNode = scenario.nodes.find((n) => n.type === 'entry_agent')
    return [buildPhoneNode(scenario.phone_number, entryNode), ...scenario.nodes]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState<ScenarioNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<ScenarioEdge>(scenario.edges)
  const [selectedNode, setSelectedNode] = useState<ScenarioNode | null>(null)
  const [editingEdgeLabel, setEditingEdgeLabel] = useState<{ edgeId: string; label: string; x: number; y: number } | null>(null)
  const [deploying, setDeploying] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hasUndeployedChanges, setHasUndeployedChanges] = useState<boolean>(
    scenario.has_undeployed_changes || !scenario.deployed_at
  )
  const [scenarioName, setScenarioName] = useState(scenario.name)
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingNavRef = useRef<string | null>(null)
  const bypassGuardRef = useRef(false)
  const didRunAutoSaveRef = useRef(false)
  const pendingSemanticSaveRef = useRef(false)

  // Nodes/edges without the virtual phone node, used for all DB saves
  const savedNodes = useMemo(
    () => nodes.filter((n) => n.id !== PHONE_NODE_ID),
    [nodes]
  )

  // Phone-to-entry edge — computed, not stored in edges state
  const phoneEdge = useMemo((): ScenarioEdge | null => {
    if (!scenario.phone_number) return null
    const entryNode = nodes.find((n) => n.type === 'entry_agent')
    if (!entryNode) return null
    return {
      id: PHONE_EDGE_ID,
      source: PHONE_NODE_ID,
      target: entryNode.id,
      style: { strokeDasharray: '4 3', stroke: '#94a3b8' },
      selectable: false,
      deletable: false,
    }
  }, [scenario.phone_number, nodes])

  const displayEdges = useMemo(() => {
    const dtmfMenuIds = new Set(nodes.filter((n) => n.type === 'dtmf_menu').map((n) => n.id))
    const typedEdges = edges.map((e) =>
      dtmfMenuIds.has(e.source) ? { ...e, type: 'dtmf_menu_edge' } : e
    )
    return phoneEdge ? [phoneEdge, ...typedEdges] : typedEdges
  }, [phoneEdge, edges, nodes])

  const markScenarioChanged = useCallback(() => {
    pendingSemanticSaveRef.current = true
    setHasUndeployedChanges(true)
  }, [])

  const replaceScenarioDraft = useCallback(
    (restoredNodes: ScenarioNode[], restoredEdges: ScenarioEdge[]) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      pendingSemanticSaveRef.current = false
      const entryNode = restoredNodes.find((n) => n.type === 'entry_agent')
      const nextNodes = scenario.phone_number
        ? [buildPhoneNode(scenario.phone_number, entryNode), ...restoredNodes]
        : restoredNodes
      setNodes(nextNodes)
      setEdges(restoredEdges)
      setSelectedNode((prev) => {
        if (!prev || prev.id === PHONE_NODE_ID) return null
        return nextNodes.find((n) => n.id === prev.id && n.id !== PHONE_NODE_ID) ?? null
      })
      setHasUndeployedChanges(false)
    },
    [scenario.phone_number, setEdges, setNodes]
  )

  // Auto-save on change (debounced 1.5s)
  const triggerAutoSave = useCallback(
    (updatedNodes: ScenarioNode[], updatedEdges: ScenarioEdge[], markUndeployed = false) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(async () => {
        const { error } = await updateScenario(
          scenario.id,
          updatedNodes,
          updatedEdges,
          undefined,
          undefined,
          { markUndeployed }
        )
        if (error) {
          console.error('Auto-save failed:', error)
        }
      }, 1500)
    },
    [scenario.id]
  )

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes)
      // Position, dimension and selection changes are not semantic — don't mark as undeployed
      const hasStructural = changes.some(
        (c) => c.type !== 'position' && c.type !== 'dimensions' && c.type !== 'select'
      )
      if (hasStructural) markScenarioChanged()
    },
    [markScenarioChanged, onNodesChange]
  )

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes)
      const hasStructural = changes.some((c) => c.type !== 'select')
      if (hasStructural) markScenarioChanged()
    },
    [markScenarioChanged, onEdgesChange]
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges((eds) => {
        return addEdge(connection, eds)
      })
      markScenarioChanged()
    },
    [markScenarioChanged, setEdges]
  )

  // Auto-save when nodes/edges change. Position-only moves save layout without changing live-call state.
  useEffect(() => {
    if (!didRunAutoSaveRef.current) {
      didRunAutoSaveRef.current = true
      return
    }
    const markUndeployed = pendingSemanticSaveRef.current
    pendingSemanticSaveRef.current = false
    triggerAutoSave(savedNodes, edges, markUndeployed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedNodes, edges])

  const handleNodeClick: NodeMouseHandler<ScenarioNode> = useCallback((_e, node) => {
    if (node.id === PHONE_NODE_ID) return
    setSelectedNode(node)
  }, [])

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  /** Returns a position just to the right of the existing node cluster, at its vertical midpoint. */
  const nextNodePosition = useCallback((): { x: number; y: number } => {
    const realNodes = nodes.filter((n) => n.id !== PHONE_NODE_ID)
    if (realNodes.length === 0) return { x: 100, y: 200 }
    const maxX = Math.max(...realNodes.map((n) => n.position.x))
    const avgY = realNodes.reduce((sum, n) => sum + n.position.y, 0) / realNodes.length
    return { x: maxX + 220, y: Math.round(avgY) }
  }, [nodes])

  const addAgentNode = useCallback(() => {
    const newNode: ScenarioNode = {
      id: crypto.randomUUID(),
      type: 'agent',
      position: nextNodePosition(),
      data: {
        assistant_id: null,
        label: t('node.unnamedAgent'),
        avatar_url: null,
        transfer_instruction: '',
        inherit_voice: false,
        send_greeting: false,
      },
    }
    setNodes((nds) => [...nds, newNode])
    setSelectedNode(newNode)
    markScenarioChanged()
  }, [markScenarioChanged, nextNodePosition, setNodes, t])

  const addDTMFCollectNode = useCallback(() => {
    const newNode: ScenarioNode = {
      id: crypto.randomUUID(),
      type: 'dtmf_collect',
      position: nextNodePosition(),
      data: {
        label: t('node.dtmfCollect'),
        prompt: '',
        variable_name: '',
        max_digits: 20,
        terminator: '#',
        timeout_seconds: 5,
      },
    }
    setNodes((nds) => [...nds, newNode])
    setSelectedNode(newNode)
    markScenarioChanged()
  }, [markScenarioChanged, nextNodePosition, setNodes, t])

  const addDTMFMenuNode = useCallback(() => {
    const newNode: ScenarioNode = {
      id: crypto.randomUUID(),
      type: 'dtmf_menu',
      position: nextNodePosition(),
      data: {
        label: t('node.dtmfMenu'),
        prompt: '',
        timeout_seconds: 10,
        max_retries: 2,
        error_prompt: '',
      },
    }
    setNodes((nds) => [...nds, newNode])
    setSelectedNode(newNode)
    markScenarioChanged()
  }, [markScenarioChanged, nextNodePosition, setNodes, t])

  const addPhoneTransferNode = useCallback(() => {
    const newNode: ScenarioNode = {
      id: crypto.randomUUID(),
      type: 'phone_transfer',
      position: nextNodePosition(),
      data: {
        label: t('node.phoneTransfer'),
        target_phone_number: '',
        caller_id_name: '',
        caller_id_number: '',
        transfer_instruction: '',
      },
    }
    setNodes((nds) => [...nds, newNode])
    setSelectedNode(newNode)
    markScenarioChanged()
  }, [markScenarioChanged, nextNodePosition, setNodes, t])

  const handleEdgeLabelUpdate = useCallback(
    (edgeId: string, label: string) => {
      setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, label } : e)))
      markScenarioChanged()
    },
    [markScenarioChanged, setEdges]
  )

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      if (nodeId === PHONE_NODE_ID) return
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      markScenarioChanged()
    },
    [markScenarioChanged, setNodes, setEdges]
  )

  const handleNodeUpdate = useCallback(
    (nodeId: string, updates: Partial<ScenarioNode['data']> & { type?: ScenarioNode['type'] }) => {
      markScenarioChanged()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const { type: newType, ...dataUpdates } = updates
          return {
            ...n,
            ...(newType !== undefined ? { type: newType } : {}),
            data: { ...n.data, ...dataUpdates },
          }
        })
      )
      // Update selectedNode too
      setSelectedNode((prev) => {
        if (!prev || prev.id !== nodeId) return prev
        const { type: newType, ...dataUpdates } = updates
        return {
          ...prev,
          ...(newType !== undefined ? { type: newType } : {}),
          data: { ...prev.data, ...dataUpdates },
        }
      })
    },
    [markScenarioChanged, setNodes]
  )

  const handleNameBlur = useCallback(async () => {
    setEditingName(false)
    const trimmed = scenarioName.trim()
    if (!trimmed) {
      setScenarioName(scenario.name)
      return
    }
    if (trimmed === scenario.name) return
    setHasUndeployedChanges(true)
    await updateScenario(scenario.id, savedNodes, edges, trimmed, undefined, {
      markUndeployed: true,
    })
  }, [scenario.id, scenario.name, scenarioName, savedNodes, edges])

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') nameInputRef.current?.blur()
      if (e.key === 'Escape') {
        setScenarioName(scenario.name)
        setEditingName(false)
      }
    },
    [scenario.name]
  )

  // Navigation guard: intercept link clicks, browser back/forward and close when changes are pending
  useEffect(() => {
    if (!hasUndeployedChanges) return

    const savedPath = window.location.pathname + window.location.search

    // Intercept <a> clicks before Next.js Link handles them (capture phase)
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

    // Intercept browser back/forward button
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
  }, [hasUndeployedChanges])

  const handleBack = useCallback(() => {
    if (hasUndeployedChanges) {
      pendingNavRef.current = `/${orgSlug}/scenarios`
      setShowLeaveConfirm(true)
    } else {
      router.push(`/${orgSlug}/scenarios`)
    }
  }, [hasUndeployedChanges, router, orgSlug])

  const handleLeaveWithoutDeploy = useCallback(async () => {
    setShowLeaveConfirm(false)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    pendingSemanticSaveRef.current = false
    const { error } = await updateScenario(scenario.id, savedNodes, edges, undefined, undefined, {
      markUndeployed: true,
    })
    if (error) {
      toast.error(t('saveError'))
      return
    }
    bypassGuardRef.current = true
    const target = pendingNavRef.current ?? `/${orgSlug}/scenarios`
    pendingNavRef.current = null
    router.push(target)
  }, [edges, orgSlug, router, savedNodes, scenario.id, t])

  const handleLeaveAndDeploy = async () => {
    setShowLeaveConfirm(false)
    setDeploying(true)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    await updateScenario(scenario.id, savedNodes, edges, undefined, undefined, {
      markUndeployed: true,
    })
    const { error } = await deployScenario(scenario.id)
    setDeploying(false)
    if (error) {
      toast.error(t('deployError'))
    } else {
      bypassGuardRef.current = true
      const target = pendingNavRef.current ?? `/${orgSlug}/scenarios`
      pendingNavRef.current = null
      router.push(target)
    }
  }

  const handleDeploy = async () => {
    setDeploying(true)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    // Ensure latest changes are saved before deploying
    await updateScenario(scenario.id, savedNodes, edges, undefined, undefined, {
      markUndeployed: true,
    })
    const { error } = await deployScenario(scenario.id)
    setDeploying(false)
    if (error) {
      toast.error(t('deployError'))
    } else {
      toast.success(t('deploySuccess'))
      setHasUndeployedChanges(false)
      router.refresh()
    }
  }

  const handleRevert = async () => {
    setReverting(true)
    setShowRevertConfirm(false)
    const result = await revertScenario(scenario.id)
    setReverting(false)
    if (result.error) {
      toast.error(t('revertError'))
    } else {
      toast.success(t('revertSuccess'))
      if (result.nodes && result.edges) {
        replaceScenarioDraft(result.nodes, result.edges)
      } else {
        setHasUndeployedChanges(false)
      }
      router.refresh()
    }
  }

  const currentSelectedNode = selectedNode
    ? nodes.find((n) => n.id === selectedNode.id) ?? null
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('back')}
          </Button>
          {editingName ? (
            <input
              ref={nameInputRef}
              className="text-sm font-semibold bg-transparent border-b border-neutral-400 dark:border-neutral-500 outline-none text-neutral-700 dark:text-neutral-200 w-48"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              autoFocus
            />
          ) : (
            <button
              className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white cursor-text"
              onClick={() => setEditingName(true)}
              title={t('clickToRename')}
            >
              {scenarioName}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t('addNode')}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={addAgentNode}>
                <Bot className="h-4 w-4 mr-2 text-neutral-400" />
                {t('addAgent')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addDTMFCollectNode}>
                <Hash className="h-4 w-4 mr-2 text-blue-500" />
                {t('addDTMFCollect')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addDTMFMenuNode}>
                <ListTree className="h-4 w-4 mr-2 text-purple-500" />
                {t('addDTMFMenu')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addPhoneTransferNode}>
                <PhoneForwarded className="h-4 w-4 mr-2 text-emerald-500" />
                {t('addPhoneTransfer')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4 mr-1" />
            {t('settings')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-4 w-4 mr-1" />
            {t('history')}
          </Button>
          {hasUndeployedChanges && scenario.deployed_at && (
            <Button
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
              {t('revert')}
            </Button>
          )}
          {hasUndeployedChanges ? (
            <Button
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
              {t('deploy')}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled
              className="text-neutral-400 dark:text-neutral-500"
            >
              <Check className="h-4 w-4 mr-1" />
              {t('deployed')}
            </Button>
          )}
        </div>
      </div>

      {/* Leave with undeployed changes dialog */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leaveConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('leaveConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <Button variant="outline" onClick={handleLeaveWithoutDeploy}>
              {t('leaveWithoutDeploy')}
            </Button>
            <AlertDialogAction onClick={handleLeaveAndDeploy} disabled={deploying}>
              {deploying && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('leaveAndDeploy')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert confirmation dialog */}
      <AlertDialog open={showRevertConfirm} onOpenChange={setShowRevertConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('revertConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('revertConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevert}>{t('revert')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Keypad wheel for dtmf_menu route key assignment */}
      {editingEdgeLabel && (() => {
        // Keys already assigned to sibling edges from the same source node (excluding this edge)
        const sourceId = edges.find((e) => e.id === editingEdgeLabel.edgeId)?.source
        const usedKeys = edges
          .filter((e) => e.source === sourceId && e.id !== editingEdgeLabel.edgeId && e.label)
          .map((e) => String(e.label))
        return (
          <DTMFKeypadWheel
            x={editingEdgeLabel.x}
            y={editingEdgeLabel.y}
            currentLabel={editingEdgeLabel.label}
            usedKeys={usedKeys}
            onSelect={(key) => {
              handleEdgeLabelUpdate(editingEdgeLabel.edgeId, key)
              setEditingEdgeLabel(null)
            }}
            onClear={() => {
              handleEdgeLabelUpdate(editingEdgeLabel.edgeId, '')
              setEditingEdgeLabel(null)
            }}
            onClose={() => setEditingEdgeLabel(null)}
          />
        )
      })()}

      {/* Settings */}
      <ScenarioSettingsSheet
        scenarioId={scenario.id}
        organizationId={scenario.organization_id}
        enableCsat={scenario.enable_csat}
        voiceProvider={scenario.voice_provider}
        voiceId={scenario.voice_id}
        voiceLanguage={scenario.voice_language}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSettingsChange={(requiresApply) => {
          if (requiresApply) setHasUndeployedChanges(true)
          router.refresh()
        }}
      />

      {/* Deploy history */}
      <ScenarioHistorySheet
        scenarioId={scenario.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestore={(restored) => {
          replaceScenarioDraft(restored.nodes, restored.edges)
          router.refresh()
        }}
      />

      {/* Canvas + Config panel */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 h-full">
          <DTMFEdgeClickContext.Provider
            value={(edgeId, label, x, y) => setEditingEdgeLabel({ edgeId, label, x, y })}
          >
            <ReactFlow
              nodes={nodes}
              edges={displayEdges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              className="bg-neutral-50 dark:bg-neutral-950"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                color="#cbd5e1"
                size={1}
              />
              <Controls />
            </ReactFlow>
          </DTMFEdgeClickContext.Provider>
        </div>

        {/* Node config panel */}
        {currentSelectedNode && (
          <div className="absolute top-4 right-4 z-10">
            <ScenarioNodeConfig
              node={currentSelectedNode}
              assistants={assistants}
              edges={edges}
              nodes={savedNodes}
              onUpdate={handleNodeUpdate}
              onDelete={handleNodeDelete}
              onClose={() => setSelectedNode(null)}
              toolModel={toolModel}
            />
          </div>
        )}
      </div>
    </div>
  )
}
