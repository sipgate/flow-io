// Variable Extraction Types

export type VariableType = 'string' | 'number' | 'boolean' | 'date' | 'phone' | 'email'

export interface VariableDefinition {
  id: string
  assistant_id: string
  organization_id: string
  name: string
  label: string
  description: string
  type: VariableType
  required: boolean
  position: number
  validation_regex?: string | null
  validation_endpoint?: string | null
  validation_error_hint?: string | null
  mandatory_collection: boolean
  confirm_with_caller: boolean
  created_at: string
  updated_at: string
}

export interface VariableDefinitionInsert {
  assistant_id: string
  organization_id: string
  name: string
  label: string
  description: string
  type: VariableType
  required?: boolean
  position?: number
  validation_regex?: string | null
  validation_endpoint?: string | null
  validation_error_hint?: string | null
  mandatory_collection?: boolean
  confirm_with_caller?: boolean
}

export interface VariableDefinitionUpdate {
  name?: string
  label?: string
  description?: string
  type?: VariableType
  required?: boolean
  position?: number
  validation_regex?: string | null
  validation_endpoint?: string | null
  validation_error_hint?: string | null
  mandatory_collection?: boolean
  confirm_with_caller?: boolean
}

export interface ExtractedVariable {
  id: string
  call_session_id: string
  organization_id: string
  variable_definition_id: string | null
  name: string
  label: string
  type: string
  value: string | null
  confidence: number | null
  extracted_at: string
  created_at: string
}

export interface ExtractedVariableInsert {
  call_session_id: string
  organization_id: string
  variable_definition_id?: string | null
  name: string
  label: string
  type: string
  value?: string | null
  confidence?: number | null
}

export interface VariableWebhook {
  id: string
  assistant_id: string
  organization_id: string
  name: string
  url: string
  enabled: boolean
  headers: Record<string, string>
  include_transcript: boolean
  created_at: string
  updated_at: string
}

export interface VariableWebhookInsert {
  assistant_id: string
  organization_id: string
  name: string
  url: string
  enabled?: boolean
  headers?: Record<string, string>
  include_transcript?: boolean
}

export interface VariableWebhookUpdate {
  name?: string
  url?: string
  enabled?: boolean
  headers?: Record<string, string>
  include_transcript?: boolean
}

// LLM extraction result type
export interface LLMExtractionResult {
  variables: Array<{
    name: string
    value: string | null
    confidence: number
  }>
}

// Real-time collection state types
export interface CollectedVariable {
  value: string
  regexValid: boolean | null       // null = no regex configured
  webhookValid: boolean | 'pending' | null  // null = no endpoint configured
  webhookMessage?: string          // message from webhook on failure
  confirmed: boolean | null        // null = no confirmation needed, false = pending, true = confirmed
  attempts: number
  collectedAt: number
}

export interface VariableCollectionState {
  definitions: VariableDefinition[]
  collected: Map<string, CollectedVariable>
  pendingWebhooks: Map<string, Promise<{ valid: boolean; message?: string }>>
  lastValidationContext: string | null  // context string injected into last LLM call
}

// Webhook payload type
export interface VariableWebhookPayload {
  event: 'call_completed'
  timestamp: string
  call_session: {
    id: string
    session_id: string
    caller_number: string
    duration_seconds: number
    status: string
  }
  assistant: {
    id: string
    name: string
  }
  variables: Array<{
    name: string
    label: string
    type: string
    value: string | null
    confidence: number | null
    required: boolean
  }>
  transcript?: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: string
    sequence_number: number
  }>
}
