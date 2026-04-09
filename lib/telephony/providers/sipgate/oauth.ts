import type { TelephonyTokens, TelephonyAccountInfo, TelephonyProvider } from '../../types'

const AUTHORIZATION_URL = 'https://login.sipgate.com/auth/realms/third-party/protocol/openid-connect/auth'
const TOKEN_URL = 'https://api.sipgate.com/login/third-party/protocol/openid-connect/token'
const USERINFO_URL = 'https://api.sipgate.com/v2/authorization/userinfo'

const SCOPES = 'openid profile email account:read numbers:read all'

export class SipgateProvider implements TelephonyProvider {
  readonly id = 'sipgate'
  readonly name = 'sipgate'

  private clientId: string
  private clientSecret: string

  constructor() {
    this.clientId = process.env.SIPGATE_OAUTH_CLIENT_ID!
    this.clientSecret = process.env.SIPGATE_OAUTH_CLIENT_SECRET!
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      state,
    })
    return `${AUTHORIZATION_URL}?${params.toString()}`
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TelephonyTokens> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`sipgate token exchange failed: ${response.status} ${text}`)
    }

    const data = await response.json()
    return tokensFromResponse(data)
  }

  async refreshTokens(refreshToken: string): Promise<TelephonyTokens> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`sipgate token refresh failed: ${response.status} ${text}`)
    }

    const data = await response.json()
    return tokensFromResponse(data)
  }

  async getUserInfo(accessToken: string): Promise<TelephonyAccountInfo> {
    const response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`sipgate userinfo failed: ${response.status}`)
    }

    const data = await response.json()

    // sipgate's userinfo endpoint often omits email — fall back to JWT claims
    const jwtClaims = decodeJwtPayload(accessToken)
    const email = (data.email ?? jwtClaims?.email ?? jwtClaims?.preferred_username) as string | undefined

    return {
      id: (data.sub ?? jwtClaims?.sub) as string,
      email: email ?? '',
      name: (data.name ?? jwtClaims?.name ?? data.preferred_username ?? jwtClaims?.preferred_username ?? email) as string,
      rawData: data,
    }
  }

}

// ─── helpers ──────────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = Buffer.from(payload, 'base64url').toString('utf-8')
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function tokensFromResponse(data: Record<string, unknown>): TelephonyTokens {
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 300
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  }
}
