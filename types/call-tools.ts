export interface CallToolConfig {
  id: string
  assistant_id: string
  organization_id: string

  // Hangup tool
  hangup_enabled: boolean
  hangup_instructions: string | null

  // Forward tool
  forward_enabled: boolean
  forward_phone_number: string | null
  forward_caller_id_name: string | null
  forward_caller_id_number: string | null
  forward_instructions: string | null

  // Take note tool
  note_enabled: boolean
  note_instructions: string | null

  // Barge-in (caller interruption)
  barge_in_strategy: 'none' | 'manual' | 'minimum_characters' | 'immediate'
  barge_in_minimum_characters: number | null
  barge_in_allow_after_ms: number | null

  created_at: string
  updated_at: string
}

export interface CallToolConfigInput {
  assistant_id: string
  organization_id: string

  hangup_enabled?: boolean
  hangup_instructions?: string

  forward_enabled?: boolean
  forward_phone_number?: string
  forward_caller_id_name?: string
  forward_caller_id_number?: string
  forward_instructions?: string

  note_enabled?: boolean
  note_instructions?: string

  barge_in_strategy?: 'none' | 'manual' | 'minimum_characters' | 'immediate'
  barge_in_minimum_characters?: number
  barge_in_allow_after_ms?: number
}

export interface CallNote {
  id: string
  call_session_id: string
  organization_id: string
  assistant_id: string | null
  content: string
  category: string | null
  priority: 'low' | 'medium' | 'high' | null
  conversation_context: string | null
  created_at: string
}

export interface CallNoteInput {
  call_session_id: string
  organization_id: string
  assistant_id?: string
  content: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
  conversation_context?: string
}

// Tool call results that indicate special actions
export interface CallToolAction {
  type: 'hangup' | 'forward' | 'note' | 'speak'
  // For hangup
  // For forward
  targetPhoneNumber?: string
  callerIdName?: string
  callerIdNumber?: string
  // For note
  noteContent?: string
  noteCategory?: string
  notePriority?: 'low' | 'medium' | 'high'
  // For speak (normal response)
  message?: string
}
