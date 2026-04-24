/**
 * Integration tests für POST /api/test-chat/send
 *
 * Abgedeckt:
 * - Eingabe-Validierung: fehlende Felder, zu lange Nachricht
 * - Session nicht gefunden → 404
 * - Inaktiver Assistent → 400
 * - Erfolgreicher Durchlauf: Nachricht speichern, LLM aufrufen, Antwort zurückgeben
 * - LLM-Fehler → Fehler-Antwort mit Fallback-Message
 * - Szenario-Transfer wird in Response eingebettet
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], setAll: () => {} }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/actions/test-chat', () => ({
  addTestTranscriptMessage: vi.fn(),
  getNextSequenceNumber: vi.fn(),
  getTestSessionHistory: vi.fn(),
}))

vi.mock('@/lib/services/llm-conversation', () => ({
  generateLLMResponse: vi.fn(),
}))

vi.mock('@/lib/actions/scenarios', () => ({
  getScenarioByIdServiceRole: vi.fn(),
}))

import { POST } from '@/app/api/test-chat/send/route'
import { createClient } from '@/lib/supabase/server'
import {
  addTestTranscriptMessage,
  getNextSequenceNumber,
  getTestSessionHistory,
} from '@/lib/actions/test-chat'
import { generateLLMResponse } from '@/lib/services/llm-conversation'
import { clearPendingTurn, setPendingTurn } from '@/lib/services/pending-turn-state'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/test-chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeSupabaseMock(sessionData: unknown, sessionError: unknown = null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: sessionData, error: sessionError }),
      update: vi.fn().mockReturnThis(),
    }),
  }
}

const VALID_BODY = {
  test_session_id: 'sess-1',
  message: 'Hallo',
  organization_id: 'org-1',
}

const ACTIVE_ASSISTANT = { id: 'asst-1', name: 'Test Bot', is_active: true }

const SESSION_DATA = {
  id: 'sess-1',
  organization_id: 'org-1',
  assistant_id: 'asst-1',
  metadata: null,
  assistants: ACTIVE_ASSISTANT,
}

beforeEach(() => {
  vi.clearAllMocks()
  clearPendingTurn('sess-1')

  // Standard-Mocks für den Erfolgsfall
  vi.mocked(createClient).mockResolvedValue(makeSupabaseMock(SESSION_DATA) as never)

  vi.mocked(getNextSequenceNumber).mockResolvedValue({ sequenceNumber: 1, error: null } as never)

  vi.mocked(addTestTranscriptMessage).mockResolvedValue({
    transcript: { id: 'msg-1', content: 'Hallo', timestamp: '2026-01-01T00:00:00.000Z' },
    error: null,
  } as never)

  vi.mocked(getTestSessionHistory).mockResolvedValue({
    history: [{ role: 'user', content: 'Hallo', sequence_number: 1 }],
    error: null,
  } as never)

  vi.mocked(generateLLMResponse).mockResolvedValue({
    response: 'Hallo! Wie kann ich helfen?',
    error: null,
    usage: { totalTokens: 50 },
  } as never)
})

// ─── Eingabe-Validierung ──────────────────────────────────────────────────────

describe('POST /api/test-chat/send — Validierung', () => {
  it('gibt 400 zurück wenn test_session_id fehlt', async () => {
    const res = await POST(makeRequest({ message: 'Hi', organization_id: 'org-1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('gibt 400 zurück wenn message fehlt', async () => {
    const res = await POST(makeRequest({ test_session_id: 'sess-1', organization_id: 'org-1' }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück wenn organization_id fehlt', async () => {
    const res = await POST(makeRequest({ test_session_id: 'sess-1', message: 'Hi' }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück wenn Nachricht länger als 2000 Zeichen ist', async () => {
    const res = await POST(makeRequest({
      ...VALID_BODY,
      message: 'x'.repeat(2001),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/too long/i)
  })

  it('akzeptiert Nachrichten von genau 2000 Zeichen', async () => {
    // addTestTranscriptMessage wird aufgerufen → Mock gibt zweite Nachricht zurück
    vi.mocked(addTestTranscriptMessage)
      .mockResolvedValueOnce({ transcript: { id: 'u', content: 'x'.repeat(2000), timestamp: '2026-01-01T00:00:00.000Z' }, error: null } as never)
      .mockResolvedValueOnce({ transcript: { id: 'a', content: 'ok', timestamp: '2026-01-01T00:00:00.000Z' }, error: null } as never)

    const res = await POST(makeRequest({ ...VALID_BODY, message: 'x'.repeat(2000) }))
    expect(res.status).not.toBe(400)
  })
})

// ─── Session / Assistent nicht gefunden ──────────────────────────────────────

describe('POST /api/test-chat/send — Session & Assistent', () => {
  it('gibt 404 zurück wenn die Session nicht existiert', async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock(null, { message: 'not found' }) as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('gibt 400 zurück wenn der Assistent inaktiv ist', async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({
      ...SESSION_DATA,
      assistants: { ...ACTIVE_ASSISTANT, is_active: false },
    }) as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück wenn kein Assistent mit der Session verknüpft ist', async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({
      ...SESSION_DATA,
      assistants: null,
    }) as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(400)
  })
})

// ─── Erfolgreicher Durchlauf ──────────────────────────────────────────────────

describe('POST /api/test-chat/send — Erfolg', () => {
  it('gibt user_message und assistant_message zurück', async () => {
    vi.mocked(addTestTranscriptMessage)
      .mockResolvedValueOnce({ transcript: { id: 'u1', content: 'Hallo', timestamp: '2026-01-01T00:00:00.000Z' }, error: null } as never)
      .mockResolvedValueOnce({ transcript: { id: 'a1', content: 'Hallo! Wie kann ich helfen?', timestamp: '2026-01-01T00:01:00.000Z' }, error: null } as never)

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.user_message).toBeDefined()
    expect(body.user_message.id).toBe('u1')
    expect(body.assistant_message).toBeDefined()
    expect(body.assistant_message.content).toBe('Hallo! Wie kann ich helfen?')
  })

  it('ruft generateLLMResponse mit der korrekten assistantId auf', async () => {
    vi.mocked(addTestTranscriptMessage)
      .mockResolvedValueOnce({ transcript: { id: 'u', content: 'Hi', timestamp: '' }, error: null } as never)
      .mockResolvedValueOnce({ transcript: { id: 'a', content: 'ok', timestamp: '' }, error: null } as never)

    await POST(makeRequest(VALID_BODY))

    expect(generateLLMResponse).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(generateLLMResponse).mock.calls[0][0]
    expect(callArgs.assistantId).toBe('asst-1')
    expect(callArgs.organizationId).toBe('org-1')
    expect(callArgs.testSessionId).toBe('sess-1')
    expect(callArgs.sessionId).toBeUndefined()
  })

  it('enthält kein greeting_message wenn kein Transfer stattfand', async () => {
    vi.mocked(addTestTranscriptMessage)
      .mockResolvedValueOnce({ transcript: { id: 'u', content: 'Hi', timestamp: '' }, error: null } as never)
      .mockResolvedValueOnce({ transcript: { id: 'a', content: 'ok', timestamp: '' }, error: null } as never)

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(body.greeting_message).toBeUndefined()
    expect(body.transfer).toBeNull()
  })

  it('behandelt wait_for_turn ohne Fallback-Fehlerantwort', async () => {
    vi.mocked(generateLLMResponse).mockResolvedValue({
      response: 'Mhm',
      waitForTurn: true,
      waitForTurnFiller: 'Mhm',
      error: null,
    } as never)

    vi.mocked(addTestTranscriptMessage)
      .mockResolvedValueOnce({ transcript: { id: 'u', content: 'Ich wollte', timestamp: '2026-01-01T00:00:00.000Z' }, error: null } as never)
      .mockResolvedValueOnce({ transcript: { id: 'a', content: 'Mhm', timestamp: '2026-01-01T00:00:01.000Z' }, error: null } as never)

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.wait_for_turn).toBe(true)
    expect(body.assistant_message?.content).toBe('Mhm')
    expect(body.error).toBeUndefined()
  })

  it('kombiniert einen ausstehenden partial turn mit der nächsten Nachricht', async () => {
    setPendingTurn('sess-1', 'Ich wollte')

    vi.mocked(addTestTranscriptMessage)
      .mockResolvedValueOnce({ transcript: { id: 'u', content: 'Ich wollte Hallo', timestamp: '2026-01-01T00:00:00.000Z' }, error: null } as never)
      .mockResolvedValueOnce({ transcript: { id: 'a', content: 'ok', timestamp: '2026-01-01T00:00:01.000Z' }, error: null } as never)

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(body.user_message.content).toBe('Ich wollte Hallo')
  })
})

// ─── LLM-Fehler ──────────────────────────────────────────────────────────────

describe('POST /api/test-chat/send — LLM-Fehler', () => {
  it('gibt Fallback-Fehlermeldung zurück wenn LLM einen Fehler liefert', async () => {
    vi.mocked(generateLLMResponse).mockResolvedValue({
      response: null,
      error: 'LLM timeout',
      usage: null,
    } as never)

    // User-Nachricht + Error-Nachricht
    vi.mocked(addTestTranscriptMessage)
      .mockResolvedValueOnce({ transcript: { id: 'u', content: 'Hi', timestamp: '' }, error: null } as never)
      .mockResolvedValueOnce({ transcript: { id: 'err', timestamp: '' }, error: null } as never)

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200) // kein 500 — Fehler ist graceful

    const body = await res.json()
    expect(body.error).toBe('LLM timeout')
    expect(body.assistant_message).toBeDefined()
    expect(body.assistant_message.content).toMatch(/error|problem|try again/i)
  })
})
