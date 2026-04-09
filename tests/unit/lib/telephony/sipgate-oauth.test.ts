/**
 * Unit tests for SipgateProvider (OAuth-Logik).
 *
 * Abgedeckt:
 * - getAuthorizationUrl: URL-Aufbau, Parameter, Scopes
 * - exchangeCode: fetch-Aufruf, Token-Mapping, Fehlerbehandlung
 * - refreshTokens: fetch-Aufruf, Token-Mapping, Fehlerbehandlung
 * - getUserInfo: Hauptpfad, JWT-Fallback bei fehlendem email, Fehlerbehandlung
 * - decodeJwtPayload (indirekt): gültig, malformed, fehlende Segmente
 * - tokensFromResponse (indirekt): expires_in-Fallback, Typ-Konvertierung
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SipgateProvider } from '@/lib/telephony/providers/sipgate/oauth'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Erzeugt einen minimalen JWT-Token mit den gegebenen Claims im Payload. */
function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.fakesignature`
}

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

function mockFetchError(status: number, text = 'Bad Request') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(text),
  })
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.unstubAllGlobals()
  process.env.SIPGATE_OAUTH_CLIENT_ID = 'test-client-id'
  process.env.SIPGATE_OAUTH_CLIENT_SECRET = 'test-client-secret'
})

// ─── getAuthorizationUrl ──────────────────────────────────────────────────────

describe('SipgateProvider.getAuthorizationUrl', () => {
  it('gibt eine gültige URL zurück', () => {
    const provider = new SipgateProvider()
    const url = provider.getAuthorizationUrl('state123', 'https://app.example.com/callback')
    expect(() => new URL(url)).not.toThrow()
  })

  it('enthält den richtigen Authorization-Endpoint', () => {
    const provider = new SipgateProvider()
    const url = provider.getAuthorizationUrl('s', 'https://example.com/cb')
    expect(url).toContain('login.sipgate.com')
  })

  it('enthält alle erforderlichen Query-Parameter', () => {
    const provider = new SipgateProvider()
    const url = new URL(provider.getAuthorizationUrl('mystate', 'https://example.com/cb'))
    expect(url.searchParams.get('client_id')).toBe('test-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/cb')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('mystate')
  })

  it('enthält den scope-Parameter mit "all"', () => {
    const provider = new SipgateProvider()
    const url = new URL(provider.getAuthorizationUrl('s', 'https://example.com/cb'))
    expect(url.searchParams.get('scope')).toContain('all')
  })

  it('enthält "openid" im scope', () => {
    const provider = new SipgateProvider()
    const url = new URL(provider.getAuthorizationUrl('s', 'https://example.com/cb'))
    expect(url.searchParams.get('scope')).toContain('openid')
  })

  it('kodiert Sonderzeichen in der redirect_uri', () => {
    const provider = new SipgateProvider()
    const url = new URL(provider.getAuthorizationUrl('s', 'https://example.com/cb?foo=bar'))
    // URL.searchParams decoded die URL automatisch — Hauptsache es ist ein gültiger Wert
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/cb?foo=bar')
  })
})

// ─── exchangeCode ─────────────────────────────────────────────────────────────

describe('SipgateProvider.exchangeCode', () => {
  it('gibt TelephonyTokens zurück bei erfolgreichem Token-Exchange', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      access_token: 'access-tok',
      refresh_token: 'refresh-tok',
      expires_in: 3600,
    }))
    const provider = new SipgateProvider()
    const tokens = await provider.exchangeCode('auth-code', 'https://example.com/cb')

    expect(tokens.accessToken).toBe('access-tok')
    expect(tokens.refreshToken).toBe('refresh-tok')
    expect(tokens.expiresAt).toBeInstanceOf(Date)
    expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('setzt expiresAt korrekt basierend auf expires_in', async () => {
    const before = Date.now()
    vi.stubGlobal('fetch', mockFetchOk({
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
    }))
    const provider = new SipgateProvider()
    const tokens = await provider.exchangeCode('code', 'https://example.com/cb')
    const after = Date.now()

    // expiresAt sollte ~1h in der Zukunft liegen
    const expiresMs = tokens.expiresAt.getTime()
    expect(expiresMs).toBeGreaterThanOrEqual(before + 3600 * 1000)
    expect(expiresMs).toBeLessThanOrEqual(after + 3600 * 1000)
  })

  it('verwendet 300s als expires_in-Fallback wenn nicht angegeben', async () => {
    const before = Date.now()
    vi.stubGlobal('fetch', mockFetchOk({
      access_token: 'a',
      refresh_token: 'r',
      // kein expires_in
    }))
    const provider = new SipgateProvider()
    const tokens = await provider.exchangeCode('code', 'https://example.com/cb')

    const expiresMs = tokens.expiresAt.getTime()
    expect(expiresMs).toBeGreaterThanOrEqual(before + 300 * 1000)
    expect(expiresMs).toBeLessThanOrEqual(Date.now() + 300 * 1000)
  })

  it('wirft einen Fehler bei HTTP-Fehler-Response', async () => {
    vi.stubGlobal('fetch', mockFetchError(400, 'invalid_grant'))
    const provider = new SipgateProvider()

    await expect(provider.exchangeCode('bad-code', 'https://example.com/cb'))
      .rejects.toThrow(/sipgate token exchange failed.*400/)
  })

  it('sendet grant_type=authorization_code im Request-Body', async () => {
    const mockFetch = mockFetchOk({ access_token: 'a', refresh_token: 'r', expires_in: 100 })
    vi.stubGlobal('fetch', mockFetch)
    const provider = new SipgateProvider()
    await provider.exchangeCode('mycode', 'https://example.com/cb')

    const callArgs = mockFetch.mock.calls[0]
    const body = new URLSearchParams(callArgs[1].body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('mycode')
    expect(body.get('client_id')).toBe('test-client-id')
    expect(body.get('client_secret')).toBe('test-client-secret')
  })
})

// ─── refreshTokens ────────────────────────────────────────────────────────────

describe('SipgateProvider.refreshTokens', () => {
  it('gibt neue TelephonyTokens zurück', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 1800,
    }))
    const provider = new SipgateProvider()
    const tokens = await provider.refreshTokens('old-refresh-token')

    expect(tokens.accessToken).toBe('new-access')
    expect(tokens.refreshToken).toBe('new-refresh')
  })

  it('wirft einen Fehler bei abgelaufenem Refresh-Token', async () => {
    vi.stubGlobal('fetch', mockFetchError(401, 'invalid_token'))
    const provider = new SipgateProvider()

    await expect(provider.refreshTokens('expired-token'))
      .rejects.toThrow(/sipgate token refresh failed.*401/)
  })

  it('sendet grant_type=refresh_token im Request-Body', async () => {
    const mockFetch = mockFetchOk({ access_token: 'a', refresh_token: 'r', expires_in: 100 })
    vi.stubGlobal('fetch', mockFetch)
    const provider = new SipgateProvider()
    await provider.refreshTokens('my-refresh-token')

    const callArgs = mockFetch.mock.calls[0]
    const body = new URLSearchParams(callArgs[1].body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('my-refresh-token')
  })
})

// ─── getUserInfo ──────────────────────────────────────────────────────────────

describe('SipgateProvider.getUserInfo', () => {
  it('gibt AccountInfo zurück wenn der Endpoint email liefert', async () => {
    const jwt = makeJwt({ sub: 'user-123', email: 'jwt@example.com', name: 'JWT User' })
    vi.stubGlobal('fetch', mockFetchOk({
      sub: 'user-123',
      email: 'userinfo@example.com',
      name: 'UserInfo User',
    }))
    const provider = new SipgateProvider()
    const info = await provider.getUserInfo(jwt)

    expect(info.id).toBe('user-123')
    expect(info.email).toBe('userinfo@example.com') // Userinfo hat Vorrang
    expect(info.name).toBe('UserInfo User')
  })

  it('fällt auf JWT-Claims zurück wenn email in Userinfo fehlt', async () => {
    const jwt = makeJwt({ sub: 'u1', email: 'jwt@example.com', name: 'JWT Name' })
    vi.stubGlobal('fetch', mockFetchOk({
      sub: 'u1',
      // kein email im Userinfo
      name: 'Userinfo Name',
    }))
    const provider = new SipgateProvider()
    const info = await provider.getUserInfo(jwt)

    expect(info.email).toBe('jwt@example.com') // aus JWT
  })

  it('fällt auf preferred_username zurück wenn email und JWT-email fehlen', async () => {
    const jwt = makeJwt({ sub: 'u1', preferred_username: 'sipgateuser' })
    vi.stubGlobal('fetch', mockFetchOk({ sub: 'u1' }))
    const provider = new SipgateProvider()
    const info = await provider.getUserInfo(jwt)

    expect(info.email).toBe('sipgateuser')
  })

  it('gibt leeren String für email zurück wenn kein Fallback verfügbar', async () => {
    const jwt = makeJwt({ sub: 'u1' }) // kein email, kein preferred_username
    vi.stubGlobal('fetch', mockFetchOk({ sub: 'u1' }))
    const provider = new SipgateProvider()
    const info = await provider.getUserInfo(jwt)

    expect(info.email).toBe('')
  })

  it('wirft Fehler bei HTTP-Fehler vom Userinfo-Endpoint', async () => {
    const jwt = makeJwt({ sub: 'u1' })
    vi.stubGlobal('fetch', mockFetchError(401))
    const provider = new SipgateProvider()

    await expect(provider.getUserInfo(jwt)).rejects.toThrow(/sipgate userinfo failed.*401/)
  })

  it('bevorzugt JWT sub wenn Userinfo kein sub hat', async () => {
    const jwt = makeJwt({ sub: 'jwt-sub', email: 'a@b.com' })
    vi.stubGlobal('fetch', mockFetchOk({ email: 'a@b.com' })) // kein sub
    const provider = new SipgateProvider()
    const info = await provider.getUserInfo(jwt)

    expect(info.id).toBe('jwt-sub')
  })
})

// ─── decodeJwtPayload (indirekt via getUserInfo) ──────────────────────────────

describe('JWT-Dekodierung (indirekt via getUserInfo)', () => {
  it('verarbeitet valide JWT-Tokens korrekt', async () => {
    const claims = { sub: 'abc', email: 'test@example.com', name: 'Test User' }
    const jwt = makeJwt(claims)
    vi.stubGlobal('fetch', mockFetchOk({ sub: 'abc' })) // kein email in Userinfo
    const provider = new SipgateProvider()
    const info = await provider.getUserInfo(jwt)

    expect(info.email).toBe('test@example.com') // aus JWT-Payload
  })

  it('fällt graceful zurück bei malformed JWT (kein Payload-Segment)', async () => {
    const malformedJwt = 'not.a.valid.jwt.at.all'
    // Buffer.from('not', 'base64url') → JSON.parse wird fehlschlagen → null returned
    vi.stubGlobal('fetch', mockFetchOk({ sub: 'u1', email: 'direct@example.com' }))
    const provider = new SipgateProvider()

    // Sollte nicht werfen — decodeJwtPayload gibt null zurück, getUserInfo nutzt Userinfo-Daten
    const info = await provider.getUserInfo(malformedJwt)
    expect(info.email).toBe('direct@example.com')
  })

  it('fällt graceful zurück bei leerem Token', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ sub: 'u1', email: 'x@y.com' }))
    const provider = new SipgateProvider()

    await expect(provider.getUserInfo('')).resolves.toBeDefined()
  })

  it('fällt graceful zurück bei Token mit nur einem Segment', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ sub: 'u1', email: 'x@y.com' }))
    const provider = new SipgateProvider()

    await expect(provider.getUserInfo('onlyone')).resolves.toBeDefined()
  })
})
