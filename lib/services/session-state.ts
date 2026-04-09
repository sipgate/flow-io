import type { NextResponse } from 'next/server'
import type { ScenarioNode, ScenarioEdge } from '@/types/scenarios'
import type { PhonemeReplacement } from '@/types/phoneme-sets'

/**
 * Pending call control actions — deferred until assistant finishes speaking.
 * When the LLM returns a hangup or transfer, we first speak the farewell/handoff message
 * and only execute the action after assistant_speech_ended so TTS completes.
 */
export interface PendingCallAction {
  type: 'hangup' | 'transfer'
  targetPhoneNumber?: string
  callerIdName?: string
  callerIdNumber?: string
  /** When true, the click audio has already been played; next step is the actual action. */
  clickPlayed?: boolean
}

/** Per-session barge-in configuration, loaded once at session_start. */
export interface BargeInConfig {
  strategy: 'none' | 'manual' | 'minimum_characters' | 'immediate'
  minimum_characters?: number
  allow_after_ms?: number
}

/**
 * Per-session scenario state — only present for calls routed through a Call Scenario.
 * Tracks the currently active agent node so the LLM can transfer between agents.
 */
export interface ScenarioSessionState {
  scenarioId: string
  activeNodeId: string
  entryNodeId: string
  /** Voice config of the entry agent, used when a node has inherit_voice=true */
  entryVoiceConfig: {
    voice_provider: string | null
    voice_id: string | null
    voice_language: string | null
  }
  nodes: ScenarioNode[]
  edges: ScenarioEdge[]
  /** Greeting queued for the new agent — spoken on AssistantSpeechEnded in the new agent's voice */
  pendingGreeting?: {
    assistantId: string
    /** Pre-started promise so the LLM call runs in parallel with assistant speech */
    textPromise: Promise<string | null>
  }
}

/**
 * Centralised in-memory state for all active sipgate call sessions.
 *
 * Each Map is keyed by the sipgate session ID.
 *
 * Production note: these Maps live in the Node.js module scope and are lost on
 * process restart or when a different serverless instance handles the request.
 * For multi-instance deployments, migrate to Redis.
 *
 * Lifecycle:
 * - session_start: initialise bargeIn, scenarioState, phonemeReplacements
 * - user_speak:    locks acquired and released per event; pendingCallActions set
 * - session_end:   call cleanup() — clears all state except locks (locks self-manage)
 * - user_barge_in: only pendingCallActions is cleared (use deletePendingAction)
 */
export class SessionStateManager {
  /**
   * Per-session lock — serialises concurrent user_speak events so each one
   * sees the updated conversation history from the previous event.
   * NOT cleared by cleanup() — the lock chain is self-managing: the POST
   * handler deletes the lock once no further events are queued behind it.
   */
  private locks = new Map<string, Promise<NextResponse>>()

  /** Deferred hangup/transfer — executed after assistant_speech_ended */
  private pendingActions = new Map<string, PendingCallAction>()

  /** Barge-in strategy per session */
  private bargeInConfigs = new Map<string, BargeInConfig>()

  /** Scenario routing state per session */
  private scenarioStates = new Map<string, ScenarioSessionState>()

  /** ElevenLabs phoneme replacement rules per session */
  private phonemeReplacements = new Map<string, PhonemeReplacement[]>()

  /** Sessions where the user interrupted the assistant (barge-in) before the next user_speak */
  private bargeInOccurred = new Set<string>()

  // ── Locks ────────────────────────────────────────────────────────────────

  getLock(sessionId: string): Promise<NextResponse> | undefined {
    return this.locks.get(sessionId)
  }

  setLock(sessionId: string, lock: Promise<NextResponse>): void {
    this.locks.set(sessionId, lock)
  }

  deleteLock(sessionId: string): void {
    this.locks.delete(sessionId)
  }

  // ── Pending call actions ─────────────────────────────────────────────────

  getPendingAction(sessionId: string): PendingCallAction | undefined {
    return this.pendingActions.get(sessionId)
  }

  setPendingAction(sessionId: string, action: PendingCallAction): void {
    this.pendingActions.set(sessionId, action)
  }

  deletePendingAction(sessionId: string): void {
    this.pendingActions.delete(sessionId)
  }

  // ── Barge-in config ──────────────────────────────────────────────────────

  getBargeInConfig(sessionId: string): BargeInConfig | undefined {
    return this.bargeInConfigs.get(sessionId)
  }

  setBargeInConfig(sessionId: string, config: BargeInConfig): void {
    this.bargeInConfigs.set(sessionId, config)
  }

  // ── Scenario state ────────────────────────────────────────────────────────

  getScenarioState(sessionId: string): ScenarioSessionState | undefined {
    return this.scenarioStates.get(sessionId)
  }

  setScenarioState(sessionId: string, state: ScenarioSessionState): void {
    this.scenarioStates.set(sessionId, state)
  }

  deleteScenarioState(sessionId: string): void {
    this.scenarioStates.delete(sessionId)
  }

  // ── Phoneme replacements ─────────────────────────────────────────────────

  getPhonemeReplacements(sessionId: string): PhonemeReplacement[] {
    return this.phonemeReplacements.get(sessionId) ?? []
  }

  setPhonemeReplacements(sessionId: string, replacements: PhonemeReplacement[]): void {
    this.phonemeReplacements.set(sessionId, replacements)
  }

  // ── Barge-in occurred flag ────────────────────────────────────────────────

  /** Mark that the user interrupted the assistant for the given session. */
  setBargeInOccurred(sessionId: string): void {
    this.bargeInOccurred.add(sessionId)
  }

  /** Returns true if user interrupted since the last time this was cleared. */
  wasBargeInOccurred(sessionId: string): boolean {
    return this.bargeInOccurred.has(sessionId)
  }

  /** Clear the barge-in flag after reading it. */
  clearBargeInOccurred(sessionId: string): void {
    this.bargeInOccurred.delete(sessionId)
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Remove all session state on session_end.
   * Locks are intentionally excluded — they self-manage in the POST handler.
   */
  cleanup(sessionId: string): void {
    this.pendingActions.delete(sessionId)
    this.bargeInConfigs.delete(sessionId)
    this.scenarioStates.delete(sessionId)
    this.phonemeReplacements.delete(sessionId)
    this.bargeInOccurred.delete(sessionId)
  }
}

/** Module-level singleton — same lifetime as the Node.js process */
export const sessionState = new SessionStateManager()
