import { debug } from '@/lib/utils/logger'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  createMCPSessionManager,
  convertMCPToolsToLLMTools,
  parseNamespacedToolName,
  isMCPTool,
} from '@/lib/mcp'
import type { MCPSessionManager, MCPServerConfig, MCPTool } from '@/lib/mcp'
import type { LLMTool } from '@/lib/llm/types'

/**
 * MCP Tool Executor
 * Handles tool discovery, caching, and execution for a call session
 *
 * IMPORTANT: Uses cached tool signatures from the database for fast initialization.
 * Tools are cached when testMCPServer() is called (via UI "Test Connection" button).
 * This avoids slow MCP server initialization on every request.
 */
export class MCPToolExecutor {
  private sessionManager: MCPSessionManager
  private serverConfigs: Map<string, MCPServerConfig> = new Map()
  private toolsDiscovered: LLMTool[] = []
  private initialized = false

  constructor() {
    this.sessionManager = createMCPSessionManager()
  }

  /**
   * Initialize: Load MCP servers for assistant and use CACHED tool signatures
   * This is fast because it only reads from the database, no MCP server calls.
   *
   * Note: If tools are not cached (cached_tools is null), the server is skipped.
   * Users should click "Test Connection" in the MCP server UI to cache tools.
   */
  async initialize(
    assistantId: string,
    organizationId: string
  ): Promise<{
    tools: LLMTool[]
    errors: Array<{ serverName: string; error: string }>
  }> {
    if (this.initialized) {
      return { tools: this.toolsDiscovered, errors: [] }
    }

    const supabase = createServiceRoleClient()

    // Fetch assigned MCP servers for this assistant (including cached tools)
    const { data: assignments, error: assignmentError } = await supabase
      .from('assistant_mcp_servers')
      .select(`
        mcp_server_id,
        priority,
        mcp_servers (*)
      `)
      .eq('assistant_id', assistantId)
      .order('priority', { ascending: false })

    if (assignmentError) {
      console.error('[MCP Tool Executor] Failed to fetch assignments:', assignmentError)
      return { tools: [], errors: [] }
    }

    if (!assignments || assignments.length === 0) {
      debug('[MCP Tool Executor] No MCP servers assigned to assistant:', assistantId)
      return { tools: [], errors: [] }
    }

    const errors: Array<{ serverName: string; error: string }> = []
    const serverToolsList: Array<{ serverName: string; tools: MCPTool[] }> = []

    // Use cached tools from each server (NO MCP server calls here!)
    for (const assignment of assignments) {
      const server = assignment.mcp_servers as unknown as {
        id: string
        name: string
        url: string
        auth_type: 'none' | 'bearer' | 'api_key' | 'oauth2'
        auth_config: Record<string, unknown>
        headers: Record<string, unknown>
        timeout_ms: number
        is_active: boolean
        cached_tools: MCPTool[] | null
        tools_fetched_at: string | null
      }

      // Skip inactive servers
      if (!server || !server.is_active) {
        continue
      }

      const config: MCPServerConfig = {
        id: server.id,
        name: server.name,
        url: server.url,
        authType: server.auth_type,
        authConfig: server.auth_config as MCPServerConfig['authConfig'],
        headers: server.headers as Record<string, string>,
        timeoutMs: server.timeout_ms,
        onTokensRefreshed:
          server.auth_type === 'oauth2'
            ? async (tokens) => {
                const merged = {
                  ...(server.auth_config || {}),
                  accessToken: tokens.accessToken,
                  ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
                  expiresAt: tokens.expiresAt,
                }
                await (supabase.from('mcp_servers') as unknown as {
                  update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<unknown> }
                })
                  .update({
                    auth_config: merged,
                    oauth_token_expires_at: tokens.expiresAt
                      ? new Date(tokens.expiresAt).toISOString()
                      : null,
                  })
                  .eq('id', server.id)
              }
            : undefined,
      }

      // Store config for later execution
      this.serverConfigs.set(server.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 30), config)

      // Use cached tools - NO MCP server call needed!
      if (server.cached_tools && Array.isArray(server.cached_tools) && server.cached_tools.length > 0) {
        serverToolsList.push({
          serverName: server.name,
          tools: server.cached_tools,
        })

        debug('[MCP Tool Executor] Using cached tools from server:', {
          server: server.name,
          toolCount: server.cached_tools.length,
          cachedAt: server.tools_fetched_at,
        })
      } else {
        // No cached tools - skip this server but log a warning
        console.warn('[MCP Tool Executor] No cached tools for server:', {
          server: server.name,
          hint: 'Click "Test Connection" in the MCP server UI to cache tools',
        })

        errors.push({
          serverName: server.name,
          error: 'No cached tools. Please test the server connection to cache tools.',
        })
      }
    }

    // Convert all tools to LLM format
    this.toolsDiscovered = convertMCPToolsToLLMTools(serverToolsList)
    this.initialized = true

    debug('[MCP Tool Executor] Initialization complete (using cached tools):', {
      totalTools: this.toolsDiscovered.length,
      servers: serverToolsList.length,
      errors: errors.length,
    })

    return { tools: this.toolsDiscovered, errors }
  }

  /**
   * Execute a tool call
   */
  async executeTool(
    namespacedToolName: string,
    args: Record<string, unknown>,
    organizationId: string,
    assistantId: string,
    callSessionId?: string,
    testSessionId?: string
  ): Promise<string> {
    const startTime = Date.now()

    // Check if this is an MCP tool
    if (!isMCPTool(namespacedToolName)) {
      return `Error: "${namespacedToolName}" is not an MCP tool`
    }

    const { serverName, toolName } = parseNamespacedToolName(namespacedToolName)

    // Find server config by sanitized name
    const config = this.serverConfigs.get(serverName)
    if (!config) {
      console.error('[MCP Tool Executor] Server not found:', { serverName, availableServers: Array.from(this.serverConfigs.keys()) })
      return `Error: MCP server "${serverName}" not found or not initialized`
    }

    try {
      // Execute the tool
      const result = await this.sessionManager.callTool(config, toolName, args)

      const duration = Date.now() - startTime

      // Track analytics
      await this.trackToolCall({
        organizationId,
        assistantId,
        serverId: config.id,
        callSessionId,
        testSessionId,
        toolName: namespacedToolName,
        arguments: args,
        result,
        duration,
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = String(error)

      // Track failed call
      await this.trackToolCall({
        organizationId,
        assistantId,
        serverId: config.id,
        callSessionId,
        testSessionId,
        toolName: namespacedToolName,
        arguments: args,
        error: errorMessage,
        duration,
      })

      console.error('[MCP Tool Executor] Tool execution failed:', {
        server: serverName,
        tool: toolName,
        error: errorMessage,
        duration,
      })

      return `Error executing tool "${toolName}" on server "${config.name}": ${errorMessage}`
    }
  }

  /**
   * Track tool call analytics
   */
  private async trackToolCall(data: {
    organizationId: string
    assistantId: string
    serverId: string
    callSessionId?: string
    testSessionId?: string
    toolName: string
    arguments: Record<string, unknown>
    result?: string
    error?: string
    duration: number
  }) {
    try {
      const supabase = createServiceRoleClient()

      await supabase.from('mcp_tool_call_events').insert({
        organization_id: data.organizationId,
        assistant_id: data.assistantId,
        mcp_server_id: data.serverId,
        call_session_id: data.callSessionId || null,
        test_session_id: data.testSessionId || null,
        tool_name: data.toolName,
        arguments: data.arguments,
        result: data.result ? { text: data.result.substring(0, 10000) } : null, // Limit result size
        error: data.error,
        duration_ms: data.duration,
      })
    } catch (error) {
      // Silent fail - analytics shouldn't break functionality
      console.error('[MCP Tool Executor] Failed to track analytics:', error)
    }
  }

  /**
   * Get all discovered tools
   */
  getTools(): LLMTool[] {
    return this.toolsDiscovered
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Get server config by sanitized name
   */
  getServerConfig(sanitizedName: string): MCPServerConfig | undefined {
    return this.serverConfigs.get(sanitizedName)
  }

  /**
   * Get all server configs
   */
  getAllServerConfigs(): MCPServerConfig[] {
    return Array.from(this.serverConfigs.values())
  }

  /**
   * Cleanup: Close all sessions
   */
  async cleanup() {
    await this.sessionManager.closeAll()
    this.serverConfigs.clear()
    this.toolsDiscovered = []
    this.initialized = false
  }
}

/**
 * Create a new MCP tool executor
 */
export function createMCPToolExecutor(): MCPToolExecutor {
  return new MCPToolExecutor()
}

/**
 * Quick check if an assistant has MCP servers configured
 * This is a fast database-only check that doesn't do full initialization
 */
export async function hasAssistantMCPServers(assistantId: string): Promise<boolean> {
  const supabase = createServiceRoleClient()

  const { count, error } = await supabase
    .from('assistant_mcp_servers')
    .select('*', { count: 'exact', head: true })
    .eq('assistant_id', assistantId)

  if (error) {
    console.error('[MCP Tool Executor] Failed to check MCP servers:', error)
    return false
  }

  return (count ?? 0) > 0
}
