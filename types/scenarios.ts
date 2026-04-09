import type { Node, Edge } from '@xyflow/react'

export type ScenarioNodeType = 'entry_agent' | 'agent'

export type ScenarioNodeData = {
  assistant_id: string | null
  label: string
  avatar_url: string | null
  transfer_instruction: string
  inherit_voice: boolean
  send_greeting: boolean
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
  version: number
  is_published: boolean
  deployed_at: string | null
  phone_number: string | null
  created_at: string
  updated_at: string
}

export interface ScenarioVersion {
  id: string
  version: number
  published_at: string
  created_by: string | null
}

export interface ScenarioSummary {
  id: string
  name: string
  description: string | null
  is_published: boolean
  version: number
  node_count: number
  phone_number: string | null
  created_at: string
  updated_at: string
}
