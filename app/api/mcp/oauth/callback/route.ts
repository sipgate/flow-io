import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getAppUrl } from '@/lib/utils/app-url'
import { exchangeCode } from '@/lib/mcp/oauth'
import { testMCPServer } from '@/lib/actions/mcp-servers'

interface OAuthStateRow {
  state: string
  mcp_server_id: string
  organization_id: string
  user_id: string
  code_verifier: string
  redirect_uri: string
  return_to: string | null
  created_at: string
  expires_at: string
}

interface MCPServerOAuthRow {
  id: string
  oauth_client_id: string | null
  oauth_authorization_endpoint: string | null
  oauth_token_endpoint: string | null
  oauth_scope: string | null
  oauth_resource: string | null
  auth_config: Record<string, unknown> | null
}

/**
 * GET /api/mcp/oauth/callback?code=...&state=...
 *
 * OAuth 2.1 redirect target. Exchanges the authorization code for tokens
 * and persists them on mcp_servers.auth_config.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  const fallbackReturn = '/'

  if (errorParam) {
    return errorRedirect(fallbackReturn, errorParam)
  }
  if (!code || !state) {
    return errorRedirect(fallbackReturn, 'missing_code_or_state')
  }

  const service = createServiceRoleClient()

  // Look up pending state
  const statesTable = service.from('mcp_oauth_states') as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        single: () => Promise<{ data: OAuthStateRow | null; error: { message: string } | null }>
      }
    }
    delete: () => { eq: (col: string, val: string) => Promise<unknown> }
  }

  const { data: pending, error: stateErr } = await statesTable.select('*').eq('state', state).single()

  if (stateErr || !pending) {
    return errorRedirect(fallbackReturn, 'invalid_state')
  }

  // Always consume the state row (one-shot)
  await statesTable.delete().eq('state', state)

  if (new Date(pending.expires_at).getTime() < Date.now()) {
    return errorRedirect(pending.return_to || fallbackReturn, 'state_expired')
  }

  // Load server config for token endpoint + client credentials
  const { data: serverRaw, error: serverErr } = await service
    .from('mcp_servers')
    .select('*')
    .eq('id', pending.mcp_server_id)
    .single()

  if (serverErr || !serverRaw) {
    return errorRedirect(pending.return_to || fallbackReturn, 'server_missing')
  }

  const server = serverRaw as unknown as MCPServerOAuthRow

  if (!server.oauth_token_endpoint || !server.oauth_client_id) {
    return errorRedirect(pending.return_to || fallbackReturn, 'oauth_not_configured')
  }

  try {
    const tokens = await exchangeCode(
      {
        issuer: '',
        authorization_endpoint: server.oauth_authorization_endpoint || '',
        token_endpoint: server.oauth_token_endpoint,
      },
      {
        code,
        codeVerifier: pending.code_verifier,
        clientId: server.oauth_client_id,
        clientSecret: server.auth_config?.clientSecret as string | undefined,
        redirectUri: pending.redirect_uri,
        resource: server.oauth_resource || undefined,
      }
    )

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    const existingAuthConfig = server.auth_config || {}

    const newAuthConfig: Record<string, unknown> = {
      ...existingAuthConfig,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? existingAuthConfig.refreshToken,
      tokenEndpoint: server.oauth_token_endpoint,
      clientId: server.oauth_client_id,
      scope: server.oauth_scope || tokens.scope || undefined,
      resource: server.oauth_resource || undefined,
      expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
    }

    await (service.from('mcp_servers') as unknown as {
      update: (payload: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<unknown> }
    }).update({
      auth_type: 'oauth2',
      auth_config: newAuthConfig,
      oauth_token_expires_at: expiresAt,
      oauth_connected_at: new Date().toISOString(),
    }).eq('id', server.id)

    // Pull serverInfo + tools so the human-readable name and cached_tools land
    // in the row before we redirect the user back. Failures here aren't fatal —
    // the user can retry via the "Test connection" button.
    try {
      await testMCPServer(server.id)
    } catch (e) {
      console.warn('[MCP OAuth] Post-connect test failed:', e)
    }

    const target = pending.return_to || fallbackReturn
    return NextResponse.redirect(`${getAppUrl()}${target}${target.includes('?') ? '&' : '?'}mcp_oauth=success`)
  } catch (error) {
    console.error('[MCP OAuth] Token exchange failed:', error)
    return errorRedirect(pending.return_to || fallbackReturn, 'token_exchange_failed')
  }
}

function errorRedirect(returnTo: string, code: string) {
  const target = `${getAppUrl()}${returnTo}${returnTo.includes('?') ? '&' : '?'}mcp_oauth_error=${encodeURIComponent(code)}`
  return NextResponse.redirect(target, { status: 302 })
}
