/**
 * MCP Session Manager
 * Manages MCP client sessions per call, with caching and cleanup
 */

import { debug } from '@/lib/utils/logger'
import { MCPClient, createMCPClient } from './client'
import type { MCPServerConfig, MCPSession, MCPTool } from './types'

/**
 * Manages MCP client sessions for a call
 * Caches initialized clients for the duration of a call session
 */
export class MCPSessionManager {
  private clients: Map<string, MCPClient> = new Map()
  private sessions: Map<string, MCPSession> = new Map()
  private toolsCache: Map<string, MCPTool[]> = new Map()

  /**
   * Get or create MCP client for a server
   * Initializes the client if not already done
   */
  async getClient(config: MCPServerConfig): Promise<MCPClient> {
    const existingClient = this.clients.get(config.id)

    if (existingClient && existingClient.isInitialized()) {
      return existingClient
    }

    // Create new client and initialize
    const client = createMCPClient(config)

    try {
      const initResult = await client.initialize()

      this.clients.set(config.id, client)
      this.sessions.set(config.id, {
        sessionId: client.getSessionId() || crypto.randomUUID(),
        serverId: config.id,
        serverName: config.name,
        initialized: true,
        capabilities: initResult.capabilities,
        createdAt: new Date(),
      })

      debug('[MCP Session Manager] Client initialized:', {
        server: config.name,
        serverId: config.id,
        sessionId: client.getSessionId(),
      })

      return client
    } catch (error) {
      console.error('[MCP Session Manager] Initialization failed:', {
        server: config.name,
        serverId: config.id,
        error: String(error),
      })
      throw error
    }
  }

  /**
   * Get tools from a server (with caching)
   */
  async getTools(config: MCPServerConfig): Promise<MCPTool[]> {
    // Check cache first
    const cached = this.toolsCache.get(config.id)
    if (cached) {
      return cached
    }

    // Get client (initializes if needed)
    const client = await this.getClient(config)

    // Fetch tools
    const tools = await client.listTools()

    // Cache tools for this session
    this.toolsCache.set(config.id, tools)

    // Update session with tools
    const session = this.sessions.get(config.id)
    if (session) {
      session.tools = tools
    }

    return tools
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    config: MCPServerConfig,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const client = await this.getClient(config)
    const result = await client.callTool(toolName, args)

    // Extract text content from result
    const textContent = result.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text)
      .join('\n')

    // If there's an error flag, prefix with error indication
    if (result.isError) {
      return `[Tool Error] ${textContent || 'Unknown error occurred'}`
    }

    return textContent || 'Tool executed successfully (no text output)'
  }

  /**
   * Get session info for a server
   */
  getSession(serverId: string): MCPSession | undefined {
    return this.sessions.get(serverId)
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): MCPSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Get active client count
   */
  getActiveClientCount(): number {
    return this.clients.size
  }

  /**
   * Check if a server has been initialized
   */
  isServerInitialized(serverId: string): boolean {
    const client = this.clients.get(serverId)
    return client?.isInitialized() ?? false
  }

  /**
   * Get cached tools for a server
   */
  getCachedTools(serverId: string): MCPTool[] | undefined {
    return this.toolsCache.get(serverId)
  }

  /**
   * Clear tools cache for a server (force refresh on next call)
   */
  clearToolsCache(serverId: string): void {
    this.toolsCache.delete(serverId)
  }

  /**
   * Close all sessions
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.clients.entries()).map(
      async ([serverId, client]) => {
        try {
          await client.close()
        } catch (error) {
          console.error('[MCP Session Manager] Error closing client:', {
            serverId,
            error: String(error),
          })
        }
      }
    )

    await Promise.all(closePromises)

    this.clients.clear()
    this.sessions.clear()
    this.toolsCache.clear()

    debug('[MCP Session Manager] All sessions closed')
  }

  /**
   * Close a specific server's session
   */
  async closeServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId)
    if (client) {
      await client.close()
      this.clients.delete(serverId)
      this.sessions.delete(serverId)
      this.toolsCache.delete(serverId)
    }
  }
}

/**
 * Create a new session manager for a call
 */
export function createMCPSessionManager(): MCPSessionManager {
  return new MCPSessionManager()
}
