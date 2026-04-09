/**
 * MCP HTTP Client
 * Implements JSON-RPC 2.0 over HTTP for Model Context Protocol
 */

import type {
  MCPServerConfig,
  MCPJSONRPCRequest,
  MCPJSONRPCResponse,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPTool,
  MCPToolsListResult,
  MCPToolCallParams,
  MCPToolCallResult,
  MCPCapabilities,
} from './types'
import { checkRateLimit, getTimeoutConfig } from './validation'

export class MCPClient {
  private config: MCPServerConfig
  private sessionId: string | null = null
  private requestId = 0
  private initialized = false
  private capabilities: MCPCapabilities | null = null

  constructor(config: MCPServerConfig) {
    this.config = config
  }

  /**
   * Initialize MCP session
   * Must be called before any other operations
   */
  async initialize(): Promise<MCPInitializeResult> {
    const params: MCPInitializeParams = {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: 'flow-io',
        version: '1.0.0',
      },
    }

    // Don't send session ID on initialize - server will provide one
    const { result, responseSessionId } = await this.requestWithSession<MCPInitializeResult>('initialize', params as unknown as Record<string, unknown>)

    // Use server-provided session ID, or generate one if not provided
    this.sessionId = responseSessionId || crypto.randomUUID()
    this.initialized = true
    this.capabilities = result.capabilities

    console.log('[MCP Client] Initialized:', {
      server: this.config.name,
      sessionId: this.sessionId,
      serverInfo: result.serverInfo,
      capabilities: result.capabilities,
    })

    // Send initialized notification (no response expected)
    await this.notify('notifications/initialized', {})

    return result
  }

  /**
   * List available tools from MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized. Call initialize() first.')
    }

    const result = await this.request<MCPToolsListResult>('tools/list', {})

    console.log('[MCP Client] Tools discovered:', {
      server: this.config.name,
      toolCount: result.tools.length,
      tools: result.tools.map(t => t.name),
    })

    return result.tools || []
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized. Call initialize() first.')
    }

    // Check rate limit
    const rateLimit = checkRateLimit(this.config.id)
    if (!rateLimit.allowed) {
      throw new Error(
        `Rate limit exceeded for server "${this.config.name}". Reset at ${new Date(rateLimit.resetAt).toISOString()}`
      )
    }

    const startTime = Date.now()

    const params: MCPToolCallParams = {
      name,
      arguments: args,
    }

    try {
      const result = await this.request<MCPToolCallResult>('tools/call', params as unknown as Record<string, unknown>)

      const duration = Date.now() - startTime

      console.log('[MCP Client] Tool call succeeded:', {
        server: this.config.name,
        tool: name,
        duration,
        contentBlocks: result.content.length,
        isError: result.isError,
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      console.error('[MCP Client] Tool call failed:', {
        server: this.config.name,
        tool: name,
        error: String(error),
        duration,
      })

      throw error
    }
  }

  /**
   * Make JSON-RPC request to MCP server
   */
  private async request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const { result } = await this.requestWithSession<T>(method, params)
    return result
  }

  /**
   * Make JSON-RPC request and return session ID from response
   */
  private async requestWithSession<T>(method: string, params: Record<string, unknown>): Promise<{ result: T; responseSessionId: string | null }> {
    const requestId = ++this.requestId

    const jsonrpcRequest: MCPJSONRPCRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...this.config.headers,
    }

    // Add session header if we have one (not on first request)
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId
    }

    // Add authentication
    if (this.config.authType === 'bearer' && this.config.authConfig?.token) {
      headers['Authorization'] = `Bearer ${this.config.authConfig.token}`
    } else if (this.config.authType === 'api_key' && this.config.authConfig?.apiKey) {
      const headerName = this.config.authConfig.headerName || 'X-API-Key'
      headers[headerName] = this.config.authConfig.apiKey
    }

    const timeoutConfig = getTimeoutConfig()
    const timeoutMs = this.config.timeoutMs || timeoutConfig.requestTimeoutMs

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(jsonrpcRequest),
        signal: controller.signal,
        // Don't follow redirects (security)
        redirect: 'error',
      })

      clearTimeout(timeoutId)

      // Capture session ID from response headers (case-insensitive)
      const responseSessionId = response.headers.get('mcp-session-id') || response.headers.get('Mcp-Session-Id')

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText}`)
      }

      // Check if response is SSE (text/event-stream) or JSON
      const contentType = response.headers.get('content-type') || ''
      let jsonrpcResponse: MCPJSONRPCResponse<T>

      if (contentType.includes('text/event-stream')) {
        // Parse SSE response - collect JSON data events (skip pings and other non-JSON)
        const text = await response.text()
        const lines = text.split('\n')
        let jsonData: string | null = null

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            // Only parse lines that look like JSON (start with {)
            if (data.startsWith('{')) {
              jsonData = data
            }
          }
        }

        if (!jsonData) {
          throw new Error('No JSON data in SSE response')
        }

        jsonrpcResponse = JSON.parse(jsonData)
      } else {
        // Standard JSON response
        jsonrpcResponse = await response.json()
      }

      if (jsonrpcResponse.error) {
        throw new Error(
          `MCP Error ${jsonrpcResponse.error.code}: ${jsonrpcResponse.error.message}`
        )
      }

      if (jsonrpcResponse.result === undefined) {
        throw new Error('MCP response missing result')
      }

      return { result: jsonrpcResponse.result, responseSessionId }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`MCP request timeout after ${timeoutMs}ms`)
        }
        // Re-throw with context
        throw new Error(`MCP request to ${this.config.name} failed: ${error.message}`)
      }

      throw error
    }
  }

  /**
   * Send JSON-RPC notification (no response expected)
   */
  private async notify(method: string, params: Record<string, unknown>): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...this.config.headers,
    }

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId
    }

    // Add authentication
    if (this.config.authType === 'bearer' && this.config.authConfig?.token) {
      headers['Authorization'] = `Bearer ${this.config.authConfig.token}`
    } else if (this.config.authType === 'api_key' && this.config.authConfig?.apiKey) {
      const headerName = this.config.authConfig.headerName || 'X-API-Key'
      headers[headerName] = this.config.authConfig.apiKey
    }

    // Notifications don't have an id field
    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    }

    try {
      await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(notification),
        redirect: 'error',
      })
      // Notifications don't expect a response, so we ignore the result
    } catch {
      // Notifications are fire-and-forget, log but don't throw
      console.warn('[MCP Client] Notification failed:', { method })
    }
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.sessionId
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): MCPCapabilities | null {
    return this.capabilities
  }

  /**
   * Close session (cleanup)
   */
  async close(): Promise<void> {
    if (this.sessionId) {
      console.log('[MCP Client] Closing session:', {
        server: this.config.name,
        sessionId: this.sessionId,
      })
    }
    this.sessionId = null
    this.initialized = false
    this.capabilities = null
  }
}

/**
 * Create MCP client from server config
 */
export function createMCPClient(config: MCPServerConfig): MCPClient {
  return new MCPClient(config)
}
