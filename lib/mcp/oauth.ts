/**
 * OAuth 2.1 client for MCP servers
 * Implements MCP Authorization spec (2025-03-26) on top of Streamable-HTTP transport.
 *
 * Flow:
 *  1. discoverMetadata(serverUrl) – RFC 9728 protected-resource → RFC 8414 auth-server metadata
 *  2. registerClient(metadata, redirectUri) – RFC 7591 dynamic client registration (if supported)
 *  3. createPkcePair() – S256 PKCE challenge/verifier
 *  4. buildAuthorizeUrl() – redirect user to authorization_endpoint
 *  5. exchangeCode() – POST to token_endpoint with code + verifier → access/refresh token
 *  6. refreshAccessToken() – POST refresh_token grant
 */

export interface OAuthAuthorizationServerMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint?: string
  scopes_supported?: string[]
  response_types_supported?: string[]
  grant_types_supported?: string[]
  token_endpoint_auth_methods_supported?: string[]
  code_challenge_methods_supported?: string[]
}

export interface OAuthProtectedResourceMetadata {
  resource: string
  authorization_servers?: string[]
  scopes_supported?: string[]
}

export interface OAuthDiscoveryResult {
  authServer: OAuthAuthorizationServerMetadata
  resource?: OAuthProtectedResourceMetadata
}

export interface OAuthClientCredentials {
  client_id: string
  client_secret?: string
  client_id_issued_at?: number
  client_secret_expires_at?: number
}

export interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

export interface PkcePair {
  verifier: string
  challenge: string
  method: 'S256'
}

/**
 * Discover OAuth metadata for an MCP server (MCP Auth spec 2025-03-26).
 *
 * Strategy:
 *  1. Probe the MCP URL — a compliant unauthenticated server must reply 401
 *     with a `WWW-Authenticate: Bearer ... resource_metadata="<url>"` header
 *     pointing at its RFC 9728 protected-resource metadata. We honor that URL.
 *  2. Fall back to path-aware `.well-known/oauth-protected-resource` lookups.
 *  3. From PRM, take `authorization_servers[0]` and fetch its RFC 8414
 *     metadata, trying both path-appended and path-prefixed `.well-known`
 *     locations as well as the OpenID Connect discovery endpoint.
 */
export async function discoverMetadata(serverUrl: string): Promise<OAuthDiscoveryResult> {
  let resource: OAuthProtectedResourceMetadata | undefined
  let resourceMetadataUrl: string | null = null

  // 1. Probe the MCP server itself for a `WWW-Authenticate: ... resource_metadata=...` header
  try {
    const probe = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', clientInfo: { name: 'flow-io', version: '1.0.0' }, capabilities: {} },
      }),
    })
    if (probe.status === 401) {
      const wwwAuth = probe.headers.get('www-authenticate') || probe.headers.get('WWW-Authenticate')
      if (wwwAuth) {
        const match = wwwAuth.match(/resource_metadata="([^"]+)"/i)
        if (match) resourceMetadataUrl = match[1]
      }
    }
  } catch {
    // Network errors don't matter here — we'll try the fallback paths.
  }

  // 2. Fallback PRM URLs if probe didn't reveal one
  const url = new URL(serverUrl)
  const candidatePrmUrls = resourceMetadataUrl
    ? [resourceMetadataUrl]
    : [
        // path-aware: append the resource path under .well-known
        `${url.origin}/.well-known/oauth-protected-resource${url.pathname.replace(/\/$/, '')}`,
        // root
        `${url.origin}/.well-known/oauth-protected-resource`,
      ]

  for (const prmUrl of candidatePrmUrls) {
    try {
      const prmRes = await fetch(prmUrl, { headers: { Accept: 'application/json' } })
      if (prmRes.ok) {
        resource = (await prmRes.json()) as OAuthProtectedResourceMetadata
        break
      }
    } catch {
      // continue
    }
  }

  // 3. Pick auth server URLs (PRM-supplied if available, else server origin)
  const authServerUrls = resource?.authorization_servers?.length
    ? resource.authorization_servers
    : [url.origin]

  let authServer: OAuthAuthorizationServerMetadata | null = null
  let lastError = 'no candidates'

  for (const issuerUrl of authServerUrls) {
    const issuer = new URL(issuerUrl)
    const issuerPath = issuer.pathname.replace(/\/$/, '')
    const candidates = [
      // RFC 8414 path-appended (issuer + /.well-known/...) — most common
      `${issuer.origin}${issuerPath}/.well-known/oauth-authorization-server`,
      `${issuer.origin}${issuerPath}/.well-known/openid-configuration`,
      // RFC 8414 path-prefixed (.well-known/.../path) — formally correct
      `${issuer.origin}/.well-known/oauth-authorization-server${issuerPath}`,
      `${issuer.origin}/.well-known/openid-configuration${issuerPath}`,
    ]
    for (const candidate of candidates) {
      try {
        const res = await fetch(candidate, { headers: { Accept: 'application/json' } })
        if (res.ok) {
          authServer = (await res.json()) as OAuthAuthorizationServerMetadata
          break
        }
        lastError = `${candidate}: HTTP ${res.status}`
      } catch (e) {
        lastError = `${candidate}: ${String(e)}`
      }
    }
    if (authServer) break
  }

  if (!authServer) {
    throw new Error(`Could not discover OAuth authorization server metadata: ${lastError}`)
  }

  if (!authServer.authorization_endpoint || !authServer.token_endpoint) {
    throw new Error('Authorization server metadata is missing required endpoints')
  }

  return { authServer, resource }
}

/**
 * Register a new OAuth client via RFC 7591 dynamic client registration.
 * Throws if the server does not advertise a registration_endpoint.
 */
export async function registerClient(
  metadata: OAuthAuthorizationServerMetadata,
  params: {
    redirectUri: string
    clientName?: string
    scope?: string
  }
): Promise<OAuthClientCredentials> {
  if (!metadata.registration_endpoint) {
    throw new Error(
      'Authorization server does not support dynamic client registration. ' +
        'Pre-registered client_id must be configured manually.'
    )
  }

  // Pick a token-endpoint auth method the server supports.
  // RFC 7591 lets the server choose if we omit this, but some servers reject
  // unknown methods — so we send 'none' only if explicitly supported, otherwise
  // omit and let the server assign one (and possibly issue a client_secret).
  const supported = metadata.token_endpoint_auth_methods_supported
  const tokenAuth = supported?.includes('none') ? 'none' : undefined

  const body: Record<string, unknown> = {
    client_name: params.clientName || 'flow-io',
    redirect_uris: [params.redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: params.scope,
  }
  if (tokenAuth) body.token_endpoint_auth_method = tokenAuth

  const res = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Dynamic client registration failed: HTTP ${res.status} — ${text}`)
  }

  return (await res.json()) as OAuthClientCredentials
}

/**
 * Generate a cryptographically random PKCE code_verifier and S256 code_challenge.
 * Verifier is 43–128 chars of [A-Z a-z 0-9 -._~] per RFC 7636.
 */
export async function createPkcePair(): Promise<PkcePair> {
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64UrlEncode(new Uint8Array(digest))
  return { verifier, challenge, method: 'S256' }
}

/**
 * Build the authorize URL the user should be redirected to.
 */
export function buildAuthorizeUrl(
  metadata: OAuthAuthorizationServerMetadata,
  params: {
    clientId: string
    redirectUri: string
    state: string
    codeChallenge: string
    scope?: string
    resource?: string
  }
): string {
  const url = new URL(metadata.authorization_endpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  if (params.scope) url.searchParams.set('scope', params.scope)
  if (params.resource) url.searchParams.set('resource', params.resource)
  return url.toString()
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCode(
  metadata: OAuthAuthorizationServerMetadata,
  params: {
    code: string
    codeVerifier: string
    clientId: string
    clientSecret?: string
    redirectUri: string
    resource?: string
  }
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    code_verifier: params.codeVerifier,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
  })
  if (params.resource) body.set('resource', params.resource)
  if (params.clientSecret) body.set('client_secret', params.clientSecret)

  return tokenRequest(metadata.token_endpoint, body)
}

/**
 * Use a refresh_token to obtain a new access_token.
 */
export async function refreshAccessToken(
  metadata: OAuthAuthorizationServerMetadata,
  params: {
    refreshToken: string
    clientId: string
    clientSecret?: string
    scope?: string
    resource?: string
  }
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
  })
  if (params.scope) body.set('scope', params.scope)
  if (params.resource) body.set('resource', params.resource)
  if (params.clientSecret) body.set('client_secret', params.clientSecret)

  return tokenRequest(metadata.token_endpoint, body)
}

async function tokenRequest(
  tokenEndpoint: string,
  body: URLSearchParams
): Promise<OAuthTokenResponse> {
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Token endpoint error: HTTP ${res.status} — ${text}`)
  }

  try {
    return JSON.parse(text) as OAuthTokenResponse
  } catch {
    throw new Error(`Invalid JSON from token endpoint: ${text.slice(0, 200)}`)
  }
}

/**
 * Generate a URL-safe random string for use as `state`.
 */
export function generateState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(24)))
}

/**
 * Derive a human-readable brand name from an MCP server URL.
 *
 * Examples:
 *   https://mcp.craft.do/my/mcp     → "Craft"
 *   https://api.notion.com/v1/...   → "Notion"
 *   https://example.com/mcp         → "Example"
 *   https://example.co.uk/mcp       → "Example"
 *   http://localhost:3000           → "localhost"
 *
 * Falls back to the raw host (or the URL itself if parsing fails).
 */
export function deriveBrandName(urlString: string): string {
  let host: string
  try {
    host = new URL(urlString).host
  } catch {
    return urlString
  }
  host = host.split(':')[0] // strip port
  // IP literal or single-label host → return verbatim
  if (/^[\d.]+$/.test(host) || !host.includes('.')) return host

  const parts = host.split('.')
  // Drop TLD
  parts.pop()
  // If the next segment is a generic public second-level TLD (e.g. .co.uk), drop it too
  const sld = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu', 'io'])
  if (parts.length > 1 && sld.has(parts[parts.length - 1])) {
    parts.pop()
  }
  const brand = parts[parts.length - 1] || host
  return brand.charAt(0).toUpperCase() + brand.slice(1)
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
