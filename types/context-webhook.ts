export interface ContextWebhook {
  id: string
  assistant_id: string
  organization_id: string
  name: string
  url: string
  enabled: boolean
  headers: Record<string, string>
  timeout_ms: number
  include_caller_number: boolean
  include_called_number: boolean
  include_call_direction: boolean
  response_variable_prefix: string
  created_at: string
  updated_at: string
}

export interface ContextWebhookInput {
  assistant_id: string
  organization_id: string
  name?: string
  url: string
  enabled?: boolean
  headers?: Record<string, string>
  timeout_ms?: number
  include_caller_number?: boolean
  include_called_number?: boolean
  include_call_direction?: boolean
  response_variable_prefix?: string
}

export interface CallContext {
  id: string
  call_session_id: string
  organization_id: string
  context_webhook_id: string | null
  context_data: Record<string, unknown>
  fetch_duration_ms: number | null
  fetch_status: 'success' | 'error' | 'timeout' | 'skipped'
  error_message: string | null
  fetched_at: string
}

// Request payload sent to the webhook
export interface ContextWebhookRequest {
  event: 'call_start'
  timestamp: string
  call: {
    session_id: string
    caller_number?: string
    called_number?: string
    direction?: 'inbound' | 'outbound'
  }
  assistant: {
    id: string
    name: string
  }
}

// Expected response from the webhook
export interface ContextWebhookResponse {
  // Any key-value pairs that will be available as {{prefix.key}} in prompts
  [key: string]: unknown
}
