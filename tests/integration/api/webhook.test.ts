/**
 * Integration tests für POST /api/sipgate/webhook/[orgId]
 *
 * Abgedeckt:
 * - Signatur-Verifikation: Token-basiert, HMAC-SHA256, kein Secret
 * - Event-Routing: jedes Event wird an den richtigen Handler weitergeleitet
 * - user_barge_in: direktes Handling ohne externe Handler
 * - Unbekannte Event-Typen: 200 OK
 * - Ungültiger JSON-Body: 500
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

// ─── Handler mocks ────────────────────────────────────────────────────────────

vi.mock('@/app/api/sipgate/webhook/handlers/session-start', () => ({
  handleSessionStart: vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: 'speak' }), { status: 200 })),
}))
vi.mock('@/app/api/sipgate/webhook/handlers/user-speak', () => ({
  handleUserSpeak: vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: 'speak' }), { status: 200 })),
}))
vi.mock('@/app/api/sipgate/webhook/handlers/session-end', () => ({
  handleSessionEnd: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
}))
vi.mock('@/app/api/sipgate/webhook/handlers/assistant-speech-ended', () => ({
  handleAssistantSpeechEnded: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
}))
vi.mock('@/lib/services/pending-mcp-state', () => ({
  cancelPendingMCP: vi.fn(),
}))

import { POST } from '@/app/api/sipgate/webhook/[orgId]/route'
import { handleSessionStart } from '@/app/api/sipgate/webhook/handlers/session-start'
import { handleUserSpeak } from '@/app/api/sipgate/webhook/handlers/user-speak'
import { handleSessionEnd } from '@/app/api/sipgate/webhook/handlers/session-end'
import { handleAssistantSpeechEnded } from '@/app/api/sipgate/webhook/handlers/assistant-speech-ended'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-test-123'
const PARAMS = { params: Promise.resolve({ orgId: ORG_ID }) }

function makeSession(id = 'sess-1') {
  return {
    id,
    account_id: 'acc-1',
    phone_number: '+49123',
    direction: 'inbound' as const,
    from_phone_number: '+49111',
    to_phone_number: '+49123',
  }
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const bodyStr = JSON.stringify(body)
  return new NextRequest(`http://localhost/api/sipgate/webhook/${ORG_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: bodyStr,
  })
}

function computeHmac(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.SIPGATE_WEBHOOK_TOKEN
  delete process.env.SIPGATE_WEBHOOK_SECRET
})

// ─── Signatur-Verifikation ────────────────────────────────────────────────────

describe('Webhook Signatur-Verifikation', () => {
  it('lehnt Requests ab wenn weder Token noch Secret in production konfiguriert sind', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const req = makeRequest({ type: 'session_start', session: makeSession() })
    const res = await POST(req, PARAMS)
    expect(res.status).toBe(401)
    vi.unstubAllEnvs()
  })

  it('erlaubt Requests wenn weder Token noch Secret in development konfiguriert sind', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const req = makeRequest({ type: 'session_start', session: makeSession() })
    const res = await POST(req, PARAMS)
    expect(res.status).not.toBe(401)
    vi.unstubAllEnvs()
  })

  it('erlaubt Requests mit korrektem x-api-token', async () => {
    process.env.SIPGATE_WEBHOOK_TOKEN = 'secret-token'
    const req = makeRequest(
      { type: 'session_start', session: makeSession() },
      { 'x-api-token': 'secret-token' }
    )
    const res = await POST(req, PARAMS)
    expect(res.status).not.toBe(401)
  })

  it('lehnt Requests mit falschem x-api-token ab', async () => {
    process.env.SIPGATE_WEBHOOK_TOKEN = 'secret-token'
    const req = makeRequest(
      { type: 'session_start', session: makeSession() },
      { 'x-api-token': 'wrong-token' }
    )
    const res = await POST(req, PARAMS)
    expect(res.status).toBe(401)
  })

  it('erlaubt Requests mit korrekter HMAC-SHA256 Signatur', async () => {
    process.env.SIPGATE_WEBHOOK_SECRET = 'hmac-secret'
    const body = JSON.stringify({ type: 'session_start', session: makeSession() })
    const sig = computeHmac('hmac-secret', body)
    const req = new NextRequest(`http://localhost/api/sipgate/webhook/${ORG_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sipgate-signature': sig },
      body,
    })
    const res = await POST(req, PARAMS)
    expect(res.status).not.toBe(401)
  })

  it('lehnt Requests mit falscher HMAC-Signatur ab', async () => {
    process.env.SIPGATE_WEBHOOK_SECRET = 'hmac-secret'
    const req = makeRequest(
      { type: 'session_start', session: makeSession() },
      { 'x-sipgate-signature': 'sha256=wrongsignature' }
    )
    const res = await POST(req, PARAMS)
    expect(res.status).toBe(401)
  })

  it('lehnt Requests ohne Signatur ab wenn HMAC Secret konfiguriert ist', async () => {
    process.env.SIPGATE_WEBHOOK_SECRET = 'hmac-secret'
    const req = makeRequest({ type: 'session_start', session: makeSession() })
    // kein x-sipgate-signature Header
    const res = await POST(req, PARAMS)
    expect(res.status).toBe(401)
  })
})

// ─── Event-Routing ────────────────────────────────────────────────────────────

describe('Webhook Event-Routing', () => {
  it('leitet session_start an handleSessionStart weiter', async () => {
    const event = { type: 'session_start', session: makeSession() }
    const req = makeRequest(event)
    await POST(req, PARAMS)
    expect(handleSessionStart).toHaveBeenCalledOnce()
    expect(vi.mocked(handleSessionStart).mock.calls[0][1]).toBe(ORG_ID)
  })

  it('leitet user_speak an handleUserSpeak weiter', async () => {
    const event = { type: 'user_speak', session: makeSession(), text: 'Hallo' }
    const req = makeRequest(event)
    await POST(req, PARAMS)
    expect(handleUserSpeak).toHaveBeenCalledOnce()
  })

  it('leitet session_end an handleSessionEnd weiter', async () => {
    const event = { type: 'session_end', session: makeSession() }
    const req = makeRequest(event)
    await POST(req, PARAMS)
    expect(handleSessionEnd).toHaveBeenCalledOnce()
  })

  it('leitet assistant_speech_ended an handleAssistantSpeechEnded weiter', async () => {
    const event = { type: 'assistant_speech_ended', session: makeSession() }
    const req = makeRequest(event)
    await POST(req, PARAMS)
    expect(handleAssistantSpeechEnded).toHaveBeenCalledOnce()
  })

  it('gibt 200 OK für unbekannte Event-Typen zurück', async () => {
    const req = makeRequest({ type: 'unknown_future_event', session: makeSession() })
    const res = await POST(req, PARAMS)
    expect(res.status).toBe(200)
    expect(handleSessionStart).not.toHaveBeenCalled()
  })
})

// ─── user_barge_in (direktes Handling) ───────────────────────────────────────

describe('user_barge_in', () => {
  it('gibt 200 zurück ohne externe Handler aufzurufen', async () => {
    const event = { type: 'user_barge_in', session: makeSession('sess-barge') }
    const req = makeRequest(event)
    const res = await POST(req, PARAMS)

    expect(res.status).toBe(200)
    expect(handleSessionStart).not.toHaveBeenCalled()
    expect(handleUserSpeak).not.toHaveBeenCalled()
  })
})

// ─── Fehlerbehandlung ─────────────────────────────────────────────────────────

describe('Webhook Fehlerbehandlung', () => {
  it('gibt 500 bei ungültigem JSON-Body zurück', async () => {
    const req = new NextRequest(`http://localhost/api/sipgate/webhook/${ORG_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json {{{',
    })
    const res = await POST(req, PARAMS)
    expect(res.status).toBe(500)
  })

  it('wirft die Handler-Exception durch (kein await im switch-case)', async () => {
    // Die Route verwendet `return handleSessionStart(...)` ohne await — der try/catch
    // fängt nur await-Rejections. Eine nicht-awaited Rejection propagiert als
    // rejected Promise vom POST-Handler selbst.
    vi.mocked(handleSessionStart).mockRejectedValueOnce(new Error('DB connection failed'))
    const req = makeRequest({ type: 'session_start', session: makeSession() })
    await expect(POST(req, PARAMS)).rejects.toThrow('DB connection failed')
  })
})

// ─── user_speak Locking ────────────────────────────────────────────────────────

describe('user_speak Serialisierung', () => {
  it('verarbeitet mehrere user_speak Events sequenziell (kein Race Condition)', async () => {
    const callOrder: number[] = []
    let resolveFirst!: () => void

    vi.mocked(handleUserSpeak)
      .mockImplementationOnce(() => new Promise<NextResponse>(res => {
        resolveFirst = () => { callOrder.push(1); res(NextResponse.json(null, { status: 200 })) }
      }))
      .mockImplementationOnce(() => {
        callOrder.push(2)
        return Promise.resolve(NextResponse.json(null, { status: 200 }))
      })

    const event = { type: 'user_speak', session: makeSession('sess-lock'), text: 'Hallo' }

    // p1 starten und genug Microtask-Ticks abwarten, bis der Handler aufgerufen
    // wird und resolveFirst gesetzt ist (await params → text() → crypto → lock setup)
    const p1 = POST(makeRequest(event), PARAMS)
    await new Promise(resolve => setTimeout(resolve, 0))

    // Jetzt liest p2 den von p1 gesetzten Lock aus sessionState
    const p2 = POST(makeRequest(event), PARAMS)

    // Ersten Handler freigeben → p1 löst auf, danach läuft p2
    resolveFirst()
    await Promise.all([p1, p2])

    expect(callOrder).toEqual([1, 2])
  })
})
