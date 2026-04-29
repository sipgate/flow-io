'use server'

import { debug } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createMCPClient, validateMCPServerURL } from '@/lib/mcp'
import { deriveBrandName } from '@/lib/mcp/oauth'
import type { MCPServerConfig } from '@/lib/mcp'

// Types for MCP server data
export interface MCPServerData {
  id: string
  organization_id: string
  name: string
  description: string | null
  url: string
  auth_type: 'none' | 'bearer' | 'api_key' | 'oauth2'
  auth_config: Record<string, unknown>
  headers: Record<string, unknown>
  timeout_ms: number
  is_active: boolean
  last_health_check: string | null
  health_status: 'healthy' | 'unhealthy' | 'unknown'
  created_at: string
  updated_at: string
}

/**
 * Get all MCP servers in an organization
 */
export async function getOrganizationMCPServers(organizationId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching MCP servers:', error)
    return { servers: [], error: error.message }
  }

  return { servers: data as unknown as MCPServerData[], error: null }
}

/**
 * Get a single MCP server by ID
 */
export async function getMCPServer(serverId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('id', serverId)
    .single()

  if (error) {
    console.error('Error fetching MCP server:', error)
    return { server: null, error: error.message }
  }

  return { server: data as unknown as MCPServerData, error: null }
}

/**
 * Get all MCP servers assigned to an assistant
 */
export async function getAssistantMCPServers(assistantId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('assistant_mcp_servers')
    .select(`
      mcp_server_id,
      priority,
      mcp_servers (*)
    `)
    .eq('assistant_id', assistantId)
    .order('priority', { ascending: false })

  if (error) {
    console.error('Error fetching assistant MCP servers:', error)
    return { servers: [], error: error.message }
  }

  // Flatten structure to return just the server objects
  const typedData = data as unknown as { mcp_servers: MCPServerData }[]
  const servers = typedData?.map((item) => item.mcp_servers) || []

  return { servers, error: null }
}

/**
 * Create a new MCP server
 */
export async function createMCPServer(data: {
  organizationId: string
  name: string
  description?: string
  url: string
  authType?: 'none' | 'bearer' | 'api_key' | 'oauth2'
  authConfig?: Record<string, unknown>
  headers?: Record<string, unknown>
  timeoutMs?: number
}) {
  const supabase = await createClient()

  // Validate URL
  const urlValidation = validateMCPServerURL(data.url)
  if (!urlValidation.valid) {
    return { server: null, error: urlValidation.error }
  }

  const { data: server, error } = await supabase
    .from('mcp_servers')
    .insert({
      organization_id: data.organizationId,
      name: data.name,
      description: data.description || null,
      url: urlValidation.sanitizedUrl,
      auth_type: data.authType || 'none',
      auth_config: data.authConfig || {},
      headers: data.headers || {},
      timeout_ms: data.timeoutMs || 30000,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating MCP server:', error)
    return { server: null, error: error.message }
  }

  return { server: server as unknown as MCPServerData, error: null }
}

/**
 * Create a minimal OAuth-typed MCP server from just a URL.
 * Used by the quick-add popover: derives a sensible default name from
 * the URL host, sets auth_type='oauth2', and returns the new server id
 * so the caller can immediately start the OAuth flow.
 */
export async function createMCPServerForOAuth(data: {
  organizationId: string
  url: string
}) {
  const supabase = await createClient()

  const urlValidation = validateMCPServerURL(data.url)
  if (!urlValidation.valid || !urlValidation.sanitizedUrl) {
    return { server: null, error: urlValidation.error || 'Invalid URL' }
  }

  const defaultName = deriveBrandName(urlValidation.sanitizedUrl)

  const { data: server, error } = await supabase
    .from('mcp_servers')
    .insert({
      organization_id: data.organizationId,
      name: defaultName,
      url: urlValidation.sanitizedUrl,
      auth_type: 'oauth2',
      auth_config: {},
      headers: {},
      timeout_ms: 30000,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating OAuth MCP server:', error)
    return { server: null, error: error.message }
  }

  return { server: server as unknown as MCPServerData, error: null }
}

/**
 * Update an MCP server
 */
export async function updateMCPServer(
  serverId: string,
  data: {
    name?: string
    description?: string | null
    url?: string
    authType?: 'none' | 'bearer' | 'api_key' | 'oauth2'
    authConfig?: Record<string, unknown>
    headers?: Record<string, unknown>
    timeoutMs?: number
    isActive?: boolean
  }
) {
  const supabase = await createClient()

  // Validate URL if provided
  if (data.url) {
    const urlValidation = validateMCPServerURL(data.url)
    if (!urlValidation.valid) {
      return { server: null, error: urlValidation.error }
    }
    data.url = urlValidation.sanitizedUrl
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.url !== undefined) updateData.url = data.url
  if (data.authType !== undefined) updateData.auth_type = data.authType
  if (data.authConfig !== undefined) updateData.auth_config = data.authConfig
  if (data.headers !== undefined) updateData.headers = data.headers
  if (data.timeoutMs !== undefined) updateData.timeout_ms = data.timeoutMs
  if (data.isActive !== undefined) updateData.is_active = data.isActive

  const { data: server, error } = await supabase
    .from('mcp_servers')
    .update(updateData)
    .eq('id', serverId)
    .select()
    .single()

  if (error) {
    console.error('Error updating MCP server:', error)
    return { server: null, error: error.message }
  }

  return { server: server as unknown as MCPServerData, error: null }
}

/**
 * Delete an MCP server
 */
export async function deleteMCPServer(serverId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('mcp_servers')
    .delete()
    .eq('id', serverId)

  if (error) {
    console.error('Error deleting MCP server:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Test MCP server connection, discover tools, and cache them
 * This is the primary way to fetch and cache tool signatures
 */
export async function testMCPServer(serverId: string) {
  const serviceClient = createServiceRoleClient()

  // Fetch server config
  const { data: server, error: fetchError } = await serviceClient
    .from('mcp_servers')
    .select('*')
    .eq('id', serverId)
    .single()

  if (fetchError || !server) {
    return { success: false, error: 'Server not found' }
  }

  const typedServer = server as unknown as MCPServerData

  try {
    const config: MCPServerConfig = {
      id: typedServer.id,
      name: typedServer.name,
      url: typedServer.url,
      authType: typedServer.auth_type,
      authConfig: typedServer.auth_config as MCPServerConfig['authConfig'],
      headers: typedServer.headers as Record<string, string>,
      timeoutMs: typedServer.timeout_ms,
      onTokensRefreshed:
        typedServer.auth_type === 'oauth2'
          ? async (tokens) => {
              const merged = {
                ...(typedServer.auth_config || {}),
                accessToken: tokens.accessToken,
                ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
                expiresAt: tokens.expiresAt,
              }
              await (serviceClient.from('mcp_servers') as unknown as {
                update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<unknown> }
              })
                .update({
                  auth_config: merged,
                  oauth_token_expires_at: tokens.expiresAt
                    ? new Date(tokens.expiresAt).toISOString()
                    : null,
                })
                .eq('id', typedServer.id)
            }
          : undefined,
    }

    const client = createMCPClient(config)

    // Test initialize
    const initResult = await client.initialize()

    // Test tool discovery
    const tools = await client.listTools()

    // Close client
    await client.close()

    // Adopt server-supplied name if the user hasn't set their own.
    // Quick-add seeds the name with the URL hostname; if the current name
    // still matches that default, prefer the human-friendly name from the
    // MCP server's initialize response.
    const updatePayload: Record<string, unknown> = {
      health_status: 'healthy',
      last_health_check: new Date().toISOString(),
      cached_tools: tools,
      tools_fetched_at: new Date().toISOString(),
    }

    // MCP spec ≥ 2025-06-18 introduces serverInfo.title as a human-readable
    // display name, separate from serverInfo.name (technical identifier).
    // We only adopt `title` — never `name`, since that's typically a kebab-
    // case slug like "craft-workflow-links" that doesn't belong in a UI label.
    const serverTitle = initResult.serverInfo?.title?.trim()
    if (serverTitle) {
      let urlHost: string | null = null
      try {
        urlHost = new URL(typedServer.url).host
      } catch {
        // ignore — keep urlHost null
      }
      const brandDefault = deriveBrandName(typedServer.url)
      const currentIsDefault =
        !typedServer.name ||
        typedServer.name === urlHost ||
        typedServer.name === brandDefault ||
        typedServer.name === typedServer.url
      if (currentIsDefault && serverTitle !== typedServer.name) {
        updatePayload.name = serverTitle
      }
    }

    await serviceClient
      .from('mcp_servers')
      .update(updatePayload)
      .eq('id', serverId)

    debug(`[MCP] Cached ${tools.length} tools for server ${updatePayload.name ?? typedServer.name}`)

    return {
      success: true,
      serverInfo: initResult.serverInfo,
      capabilities: initResult.capabilities,
      toolCount: tools.length,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: Object.keys(t.inputSchema.properties || {}),
      })),
    }
  } catch (error) {
    // Update health status to unhealthy (keep existing cached tools)
    await serviceClient
      .from('mcp_servers')
      .update({
        health_status: 'unhealthy',
        last_health_check: new Date().toISOString(),
      })
      .eq('id', serverId)

    console.error('MCP server test failed:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Refresh cached tools for an MCP server
 * Call this when you need to update the cached tool signatures
 */
export async function refreshMCPServerTools(serverId: string) {
  return testMCPServer(serverId)
}

/**
 * Assign an MCP server to an assistant
 */
export async function assignMCPServerToAssistant(
  assistantId: string,
  serverId: string,
  priority: number = 0
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('assistant_mcp_servers')
    .insert({
      assistant_id: assistantId,
      mcp_server_id: serverId,
      priority,
    })

  if (error) {
    // Check for unique constraint violation
    if (error.code === '23505') {
      return { error: 'This MCP server is already assigned to this assistant' }
    }
    console.error('Error assigning MCP server:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Unassign an MCP server from an assistant
 */
export async function unassignMCPServerFromAssistant(
  assistantId: string,
  serverId: string
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('assistant_mcp_servers')
    .delete()
    .eq('assistant_id', assistantId)
    .eq('mcp_server_id', serverId)

  if (error) {
    console.error('Error unassigning MCP server:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Update MCP server priority for an assistant
 */
export async function updateMCPServerPriority(
  assistantId: string,
  serverId: string,
  priority: number
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('assistant_mcp_servers')
    .update({ priority })
    .eq('assistant_id', assistantId)
    .eq('mcp_server_id', serverId)

  if (error) {
    console.error('Error updating MCP server priority:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Get MCP analytics summary for an organization
 */
export async function getMCPAnalyticsSummary(organizationId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mcp_analytics_summary')
    .select('*')
    .eq('organization_id', organizationId)
    .order('total_calls', { ascending: false })

  if (error) {
    console.error('Error fetching MCP analytics:', error)
    return { analytics: [], error: error.message }
  }

  return { analytics: data, error: null }
}

/**
 * Get popular tools for a specific MCP server
 */
export async function getMCPPopularTools(serverId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mcp_popular_tools')
    .select('*')
    .eq('mcp_server_id', serverId)
    .order('call_count', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching popular tools:', error)
    return { tools: [], error: error.message }
  }

  return { tools: data, error: null }
}

/**
 * Get recent MCP tool call events for an organization
 */
export async function getMCPRecentEvents(
  organizationId: string,
  limit: number = 50
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mcp_tool_call_events')
    .select(`
      *,
      mcp_servers (name),
      assistants (name)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching MCP events:', error)
    return { events: [], error: error.message }
  }

  return { events: data, error: null }
}
