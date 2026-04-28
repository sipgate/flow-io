import type { Node, Edge } from '@xyflow/react'

export type ScenarioNodeType =
  | 'entry_agent'
  | 'agent'
  | 'dtmf_collect'
  | 'dtmf_menu'
  | 'phone_transfer'

export type ScenarioNodeData = {
  label: string
  // Agent-specific fields (absent on DTMF nodes)
  assistant_id?: string | null
  avatar_url?: string | null
  transfer_instruction?: string
  inherit_voice?: boolean
  send_greeting?: boolean
  // dtmf_collect fields
  prompt?: string
  timeout_seconds?: number
  max_digits?: number
  terminator?: string
  variable_name?: string
  // dtmf_menu fields
  max_retries?: number
  error_prompt?: string
  // phone_transfer fields
  target_phone_number?: string
  caller_id_name?: string
  caller_id_number?: string
}

export type ScenarioNode = Node<ScenarioNodeData, ScenarioNodeType>
export type ScenarioEdge = Edge

export interface CallScenario {
  id: string
  organization_id: string
  name: string
  description: string | null
  nodes: ScenarioNode[]
  edges: ScenarioEdge[]
  variables: Record<string, unknown> | null
  version: number
  is_published: boolean
  deployed_at: string | null
  has_undeployed_changes: boolean
  enable_csat: boolean
  phone_number: string | null
  /** Scenario-level voice — used for DTMF announcements and as base for inherit_voice agents. */
  voice_provider: string | null
  voice_id: string | null
  voice_language: string | null
  created_at: string
  updated_at: string
}

export interface ScenarioVersion {
  id: string
  version: number
  published_at: string
  created_by: string | null
  restored_from_version: number | null
  change_summary: ScenarioVersionChange[]
}

export type ScenarioVersionChange =
  | 'initial'
  | 'assistant'
  | 'instructions'
  | 'routing'
  | 'nodes'
  | 'voice'
  | 'settings'

export interface ScenarioSummary {
  id: string
  name: string
  description: string | null
  is_published: boolean
  version: number
  deployed_at: string | null
  has_undeployed_changes: boolean
  node_count: number
  phone_number: string | null
  created_at: string
  updated_at: string
}
