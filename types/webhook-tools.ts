// Webhook Tools: HTTP endpoints callable by the LLM as function-call tools

export type WebhookToolMethod = 'GET' | 'POST' | 'PUT' | 'PATCH'
export type WebhookToolAuthType = 'none' | 'bearer' | 'api_key'

export interface WebhookToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
  required: boolean
  enum?: string[]
}

export interface WebhookToolAuthConfig {
  token?: string          // bearer
  apiKey?: string         // api_key
  headerName?: string     // api_key — default: X-API-Key
}

export interface WebhookTool {
  id: string
  assistant_id: string
  organization_id: string
  name: string
  description: string
  url: string
  method: WebhookToolMethod
  headers: Record<string, string>
  auth_type: WebhookToolAuthType
  auth_config: WebhookToolAuthConfig
  timeout_ms: number
  parameters: WebhookToolParameter[]
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface WebhookToolInsert {
  assistant_id: string
  organization_id: string
  name: string
  description: string
  url: string
  method?: WebhookToolMethod
  headers?: Record<string, string>
  auth_type?: WebhookToolAuthType
  auth_config?: WebhookToolAuthConfig
  timeout_ms?: number
  parameters?: WebhookToolParameter[]
  enabled?: boolean
}

export interface WebhookToolUpdate {
  name?: string
  description?: string
  url?: string
  method?: WebhookToolMethod
  headers?: Record<string, string>
  auth_type?: WebhookToolAuthType
  auth_config?: WebhookToolAuthConfig
  timeout_ms?: number
  parameters?: WebhookToolParameter[]
  enabled?: boolean
}
