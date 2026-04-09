/**
 * Shared type definitions for sipgate webhook handlers.
 * No business logic — only interfaces and type aliases.
 */

// ── sipgate event types ────────────────────────────────────────────────────

interface SipgateSession {
  id: string
  account_id: string
  phone_number: string
  direction: 'inbound' | 'outbound'
  from_phone_number: string
  to_phone_number: string
}

export interface SessionStartEvent {
  type: 'session_start'
  session: SipgateSession
}

export interface UserSpeakEvent {
  type: 'user_speak'
  session: SipgateSession
  text: string
  timestamp?: string
}

export interface SessionEndEvent {
  type: 'session_end'
  session: SipgateSession
  reason?: string
  timestamp?: string
}

export interface AssistantSpeechEndedEvent {
  type: 'assistant_speech_ended'
  session: SipgateSession
}

export interface UserBargeInEvent {
  type: 'user_barge_in'
  session: SipgateSession
}

export type SipgateEvent =
  | SessionStartEvent
  | UserSpeakEvent
  | SessionEndEvent
  | AssistantSpeechEndedEvent
  | UserBargeInEvent

// ── Database / domain types ────────────────────────────────────────────────

export interface PhoneNumberRouting {
  id: string
  phone_number: string
  assistant_id: string | null
  scenario_id: string | null
}

export interface AssistantConfig {
  id: string
  name: string
  organization_id: string
  voice_provider: string | null
  voice_id: string | null
  voice_language: string | null
  llm_provider: string | null
  llm_model: string | null
  llm_temperature: number | null
  system_prompt: string | null
  opening_message: string | null
  is_active: boolean | null
}

export interface CallSessionWithAssistant {
  id: string
  session_id: string
  organization_id: string
  assistant_id: string | null
  phone_number_id: string | null
  scenario_id: string | null
  status: string | null
  caller_number: string | null
  started_at: string | null
  metadata: Record<string, unknown>
  assistants: AssistantConfig
}
