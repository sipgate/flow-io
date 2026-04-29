/**
 * Unit tests for the MCP OAuth 2.1 helper module.
 * Mocks `fetch` to verify discovery, DCR, PKCE, and token exchange behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  discoverMetadata,
  registerClient,
  createPkcePair,
  buildAuthorizeUrl,
  exchangeCode,
  refreshAccessToken,
  generateState,
  deriveBrandName,
  type OAuthAuthorizationServerMetadata,
} from '@/lib/mcp/oauth'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response)
}

function unauthorizedWithMetadata(metadataUrl: string) {
  return Promise.resolve({
    ok: false,
    status: 401,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'www-authenticate'
          ? `Bearer error="invalid_token", resource_metadata="${metadataUrl}"`
          : null,
    },
    json: async () => ({}),
    text: async () => '',
  } as unknown as Response)
}

describe('discoverMetadata', () => {
  it('honors WWW-Authenticate resource_metadata URL from the MCP probe', async () => {
    fetchMock
      // 1. Probe → 401 with resource_metadata pointing at exact PRM URL
      .mockReturnValueOnce(unauthorizedWithMetadata('https://mcp.example.com/.well-known/oauth-protected-resource/my'))
      // 2. PRM → returns auth server URL
      .mockReturnValueOnce(jsonResponse({
        resource: 'https://mcp.example.com/my',
        authorization_servers: ['https://mcp.example.com/my/auth'],
        scopes_supported: ['mcp.read'],
      }))
      // 3. AS metadata (path-appended)
      .mockReturnValueOnce(jsonResponse({
        issuer: 'https://mcp.example.com/my/auth',
        authorization_endpoint: 'https://mcp.example.com/my/auth/authorize',
        token_endpoint: 'https://mcp.example.com/my/auth/token',
      }))

    const result = await discoverMetadata('https://mcp.example.com/my/mcp')

    expect(result.authServer.token_endpoint).toBe('https://mcp.example.com/my/auth/token')
    expect(fetchMock.mock.calls[1][0]).toBe('https://mcp.example.com/.well-known/oauth-protected-resource/my')
  })

  it('falls back to path-aware PRM lookup when probe lacks WWW-Authenticate', async () => {
    fetchMock
      // 1. Probe — 200, no WWW-Authenticate hint
      .mockReturnValueOnce(jsonResponse({}, true, 200))
      // 2. First PRM candidate (path-appended) → 200
      .mockReturnValueOnce(jsonResponse({
        resource: 'https://mcp.example.com',
        authorization_servers: ['https://auth.example.com'],
      }))
      // 3. AS metadata
      .mockReturnValueOnce(jsonResponse({
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
      }))

    const result = await discoverMetadata('https://mcp.example.com/my/mcp')
    expect(result.authServer.token_endpoint).toBe('https://auth.example.com/token')
  })

  it('falls back to origin when no PRM is reachable', async () => {
    fetchMock
      .mockReturnValueOnce(jsonResponse({}, true, 200)) // probe
      .mockReturnValueOnce(jsonResponse({}, false, 404)) // PRM #1
      .mockReturnValueOnce(jsonResponse({}, false, 404)) // PRM #2
      .mockReturnValueOnce(jsonResponse({
        issuer: 'https://mcp.example.com',
        authorization_endpoint: 'https://mcp.example.com/authorize',
        token_endpoint: 'https://mcp.example.com/token',
      }))

    const result = await discoverMetadata('https://mcp.example.com/mcp')
    expect(result.authServer.authorization_endpoint).toBe('https://mcp.example.com/authorize')
  })

  it('throws when neither PRM nor AS metadata are reachable', async () => {
    fetchMock.mockReturnValue(jsonResponse({}, false, 404))
    await expect(discoverMetadata('https://mcp.example.com/mcp')).rejects.toThrow(/Could not discover/)
  })

  it('throws when AS metadata lacks required endpoints', async () => {
    fetchMock
      .mockReturnValueOnce(jsonResponse({}, true, 200)) // probe
      .mockReturnValueOnce(jsonResponse({}, false, 404)) // PRM #1
      .mockReturnValueOnce(jsonResponse({}, false, 404)) // PRM #2
      .mockReturnValueOnce(jsonResponse({ issuer: 'x' }))

    await expect(discoverMetadata('https://mcp.example.com/mcp')).rejects.toThrow(/missing required endpoints/)
  })
})

describe('registerClient', () => {
  it('issues a POST to registration_endpoint and returns credentials', async () => {
    fetchMock.mockReturnValue(
      jsonResponse({ client_id: 'abc', client_secret: 'shh', client_id_issued_at: 1 })
    )

    const metadata: OAuthAuthorizationServerMetadata = {
      issuer: '',
      authorization_endpoint: 'x',
      token_endpoint: 'y',
      registration_endpoint: 'https://auth.example.com/register',
      token_endpoint_auth_methods_supported: ['none'],
    }
    const creds = await registerClient(metadata, {
      redirectUri: 'https://app.example.com/cb',
      scope: 'mcp.read',
    })

    expect(creds.client_id).toBe('abc')
    const callArgs = fetchMock.mock.calls[0]
    expect(callArgs[0]).toBe('https://auth.example.com/register')
    expect(callArgs[1].method).toBe('POST')
    const body = JSON.parse(callArgs[1].body as string)
    expect(body.redirect_uris).toEqual(['https://app.example.com/cb'])
    expect(body.token_endpoint_auth_method).toBe('none')
    expect(body.scope).toBe('mcp.read')
  })

  it('omits token_endpoint_auth_method when server does not list "none"', async () => {
    fetchMock.mockReturnValue(jsonResponse({ client_id: 'abc', client_secret: 'shh' }))

    const metadata: OAuthAuthorizationServerMetadata = {
      issuer: '',
      authorization_endpoint: 'x',
      token_endpoint: 'y',
      registration_endpoint: 'https://auth.example.com/register',
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    }
    await registerClient(metadata, { redirectUri: 'https://app.example.com/cb' })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.token_endpoint_auth_method).toBeUndefined()
  })

  it('throws when registration_endpoint is missing', async () => {
    const metadata: OAuthAuthorizationServerMetadata = {
      issuer: '',
      authorization_endpoint: 'x',
      token_endpoint: 'y',
    }
    await expect(
      registerClient(metadata, { redirectUri: 'https://app.example.com/cb' })
    ).rejects.toThrow(/dynamic client registration/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('createPkcePair', () => {
  it('generates an S256 verifier/challenge pair', async () => {
    const pair = await createPkcePair()

    expect(pair.method).toBe('S256')
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43)
    expect(pair.challenge).not.toEqual(pair.verifier)
  })
})

describe('buildAuthorizeUrl', () => {
  it('includes all required params', () => {
    const metadata: OAuthAuthorizationServerMetadata = {
      issuer: '',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
    }

    const url = buildAuthorizeUrl(metadata, {
      clientId: 'cid',
      redirectUri: 'https://app.example.com/cb',
      state: 'xyz',
      codeChallenge: 'chal',
      scope: 'mcp.read',
      resource: 'https://mcp.example.com',
    })

    const parsed = new URL(url)
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('client_id')).toBe('cid')
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example.com/cb')
    expect(parsed.searchParams.get('state')).toBe('xyz')
    expect(parsed.searchParams.get('code_challenge')).toBe('chal')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
    expect(parsed.searchParams.get('scope')).toBe('mcp.read')
    expect(parsed.searchParams.get('resource')).toBe('https://mcp.example.com')
  })
})

describe('exchangeCode', () => {
  it('POSTs application/x-www-form-urlencoded to token endpoint', async () => {
    fetchMock.mockReturnValue(
      jsonResponse({ access_token: 'a', refresh_token: 'r', expires_in: 3600, token_type: 'Bearer' })
    )

    const metadata: OAuthAuthorizationServerMetadata = {
      issuer: '',
      authorization_endpoint: 'x',
      token_endpoint: 'https://auth.example.com/token',
    }

    const tokens = await exchangeCode(metadata, {
      code: 'CODE',
      codeVerifier: 'VER',
      clientId: 'cid',
      redirectUri: 'https://app.example.com/cb',
    })

    expect(tokens.access_token).toBe('a')
    expect(tokens.refresh_token).toBe('r')
    const args = fetchMock.mock.calls[0]
    expect(args[1].method).toBe('POST')
    expect((args[1].headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded'
    )
    const body = new URLSearchParams(args[1].body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('CODE')
    expect(body.get('code_verifier')).toBe('VER')
    expect(body.get('client_id')).toBe('cid')
    expect(body.get('redirect_uri')).toBe('https://app.example.com/cb')
  })

  it('throws on non-2xx token endpoint response', async () => {
    fetchMock.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 400,
        text: async () => '{"error":"invalid_grant"}',
      } as unknown as Response)
    )

    const metadata: OAuthAuthorizationServerMetadata = {
      issuer: '',
      authorization_endpoint: 'x',
      token_endpoint: 'https://auth.example.com/token',
    }

    await expect(
      exchangeCode(metadata, {
        code: 'c',
        codeVerifier: 'v',
        clientId: 'cid',
        redirectUri: 'r',
      })
    ).rejects.toThrow(/Token endpoint error: HTTP 400/)
  })
})

describe('refreshAccessToken', () => {
  it('POSTs grant_type=refresh_token', async () => {
    fetchMock.mockReturnValue(
      jsonResponse({ access_token: 'new', expires_in: 3600, token_type: 'Bearer' })
    )

    const metadata: OAuthAuthorizationServerMetadata = {
      issuer: '',
      authorization_endpoint: 'x',
      token_endpoint: 'https://auth.example.com/token',
    }

    const tokens = await refreshAccessToken(metadata, {
      refreshToken: 'old-refresh',
      clientId: 'cid',
    })

    expect(tokens.access_token).toBe('new')
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('old-refresh')
    expect(body.get('client_id')).toBe('cid')
  })
})

describe('generateState', () => {
  it('generates URL-safe random strings of expected length', () => {
    const a = generateState()
    const b = generateState()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a.length).toBeGreaterThanOrEqual(32)
  })
})

describe('deriveBrandName', () => {
  it('extracts brand from common subdomain.brand.tld pattern', () => {
    expect(deriveBrandName('https://mcp.craft.do/my/mcp')).toBe('Craft')
    expect(deriveBrandName('https://api.notion.com/v1/foo')).toBe('Notion')
    expect(deriveBrandName('https://mcp.example.io/x')).toBe('Example')
  })

  it('handles bare brand.tld', () => {
    expect(deriveBrandName('https://example.com')).toBe('Example')
    expect(deriveBrandName('https://acme.org/path')).toBe('Acme')
  })

  it('strips public second-level TLDs like co.uk', () => {
    expect(deriveBrandName('https://example.co.uk/mcp')).toBe('Example')
    expect(deriveBrandName('https://api.something.co.uk')).toBe('Something')
  })

  it('returns localhost / single-label hosts verbatim', () => {
    expect(deriveBrandName('http://localhost:3000')).toBe('localhost')
    expect(deriveBrandName('http://internalbox')).toBe('internalbox')
  })

  it('returns IP literals verbatim', () => {
    expect(deriveBrandName('http://192.168.1.10:8080/x')).toBe('192.168.1.10')
  })

  it('returns input on parse failure', () => {
    expect(deriveBrandName('not a url')).toBe('not a url')
  })
})
