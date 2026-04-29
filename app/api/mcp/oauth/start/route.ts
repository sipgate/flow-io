import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getAppUrl } from '@/lib/utils/app-url'
import {
  buildAuthorizeUrl,
  createPkcePair,
  discoverMetadata,
  generateState,
  registerClient,
  type OAuthAuthorizationServerMetadata,
} from '@/lib/mcp/oauth'

interface MCPServerOAuthRow {
  id: string
  organization_id: string
  url: string
  oauth_client_id: string | null
  oauth_authorization_endpoint: string | null
  oauth_token_endpoint: string | null
  oauth_registration_endpoint: string | null
  oauth_scope: string | null
  oauth_resource: string | null
}

/**
 * GET /api/mcp/oauth/start?serverId=<uuid>&returnTo=<path>
 *
 * Starts an OAuth 2.1 authorization-code + PKCE flow for the given MCP server.
 * Persists pending state into mcp_oauth_states, then redirects to the
 * authorization endpoint of the MCP server's auth provider.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const serverId = url.searchParams.get('serverId')
  const returnTo = url.searchParams.get('returnTo')

  if (!serverId) {
    return NextResponse.json({ error: 'serverId is required' }, { status: 400 })
  }

  // Authenticate user via session cookie
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service role for cross-table writes that bypass RLS for the state table
  const service = createServiceRoleClient()

  // Load server (RLS-checked via user client) to verify access + get URL
  const { data: serverRaw, error: serverErr } = await supabase
    .from('mcp_servers')
    .select('id, organization_id, url, oauth_client_id, oauth_authorization_endpoint, oauth_token_endpoint, oauth_registration_endpoint, oauth_scope, oauth_resource')
    .eq('id', serverId)
    .single()

  if (serverErr || !serverRaw) {
    return NextResponse.json({ error: 'MCP server not found or access denied' }, { status: 404 })
  }
  const server = serverRaw as unknown as MCPServerOAuthRow

  const redirectUri = `${getAppUrl()}/api/mcp/oauth/callback`

  try {
    // Discover OAuth metadata (or reuse persisted endpoints if already discovered)
    let authServer: OAuthAuthorizationServerMetadata
    let resourceUrl: string | undefined = server.oauth_resource || undefined
    let scope: string | undefined = server.oauth_scope || undefined

    if (server.oauth_authorization_endpoint && server.oauth_token_endpoint) {
      authServer = {
        issuer: '',
        authorization_endpoint: server.oauth_authorization_endpoint,
        token_endpoint: server.oauth_token_endpoint,
        registration_endpoint: server.oauth_registration_endpoint || undefined,
      }
    } else {
      const discovery = await discoverMetadata(server.url)
      authServer = discovery.authServer
      if (!resourceUrl && discovery.resource?.resource) resourceUrl = discovery.resource.resource
      if (!scope && discovery.resource?.scopes_supported?.length) {
        scope = discovery.resource.scopes_supported.join(' ')
      } else if (!scope && discovery.authServer.scopes_supported?.length) {
        scope = discovery.authServer.scopes_supported.join(' ')
      }
    }

    // Resolve client_id (run dynamic registration if we don't have one yet)
    let clientId = server.oauth_client_id || undefined
    let clientSecret: string | undefined

    if (!clientId) {
      const creds = await registerClient(authServer, {
        redirectUri,
        clientName: 'flow-io',
        scope,
      })
      clientId = creds.client_id
      clientSecret = creds.client_secret
    }

    // PKCE + state
    const pkce = await createPkcePair()
    const state = generateState()

    // Persist pending state (10-minute TTL handled by DB default)
    const { error: insertErr } = await (service.from('mcp_oauth_states') as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    }).insert({
      state,
      mcp_server_id: server.id,
      organization_id: server.organization_id,
      user_id: user.id,
      code_verifier: pkce.verifier,
      redirect_uri: redirectUri,
      return_to: returnTo,
    })

    if (insertErr) {
      console.error('[MCP OAuth] Failed to persist state:', insertErr)
      return NextResponse.json({ error: 'Failed to start OAuth flow' }, { status: 500 })
    }

    // Persist newly-discovered metadata + clientId/secret on the server row
    const updatePayload: Record<string, unknown> = {
      oauth_authorization_endpoint: authServer.authorization_endpoint,
      oauth_token_endpoint: authServer.token_endpoint,
    }
    if (authServer.registration_endpoint) updatePayload.oauth_registration_endpoint = authServer.registration_endpoint
    if (scope) updatePayload.oauth_scope = scope
    if (resourceUrl) updatePayload.oauth_resource = resourceUrl
    if (clientId && clientId !== server.oauth_client_id) updatePayload.oauth_client_id = clientId
    if (clientSecret) {
      // Merge client_secret into auth_config JSONB without overwriting other fields
      const { data: current } = await service
        .from('mcp_servers')
        .select('auth_config')
        .eq('id', server.id)
        .single()
      const merged = {
        ...((current as { auth_config?: Record<string, unknown> } | null)?.auth_config || {}),
        clientSecret,
      }
      updatePayload.auth_config = merged
    }
    await (service.from('mcp_servers') as unknown as {
      update: (payload: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<unknown> }
    }).update(updatePayload).eq('id', server.id)

    const authorizeUrl = buildAuthorizeUrl(authServer, {
      clientId: clientId!,
      redirectUri,
      state,
      codeChallenge: pkce.challenge,
      scope,
      resource: resourceUrl,
    })

    return NextResponse.redirect(authorizeUrl, { status: 302 })
  } catch (error) {
    console.error('[MCP OAuth] Start failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
