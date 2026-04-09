/**
 * MCP (Model Context Protocol) Type Definitions
 * Based on MCP specification 2024-11-05
 * https://modelcontextprotocol.io/specification
 */

// Server configuration stored in database
export interface MCPServerConfig {
  id: string
  name: string
  url: string
  authType: 'none' | 'bearer' | 'api_key'
  authConfig?: {
    token?: string
    apiKey?: string
    headerName?: string
  }
  headers?: Record<string, string>
  timeoutMs?: number
}

// JSON-RPC 2.0 types
export interface MCPJSONRPCRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

export interface MCPJSONRPCResponse<T = unknown> {
  jsonrpc: '2.0'
  id: string | number
  result?: T
  error?: MCPJSONRPCError
}

export interface MCPJSONRPCError {
  code: number
  message: string
  data?: unknown
}

// MCP Capabilities
export interface MCPCapabilities {
  tools?: {
    listChanged?: boolean
  }
  resources?: {
    subscribe?: boolean
    listChanged?: boolean
  }
  prompts?: {
    listChanged?: boolean
  }
  logging?: Record<string, unknown>
  experimental?: Record<string, unknown>
}

// Initialize request/response
export interface MCPInitializeParams {
  protocolVersion: string
  capabilities: {
    tools?: Record<string, unknown>
    resources?: Record<string, unknown>
    prompts?: Record<string, unknown>
  }
  clientInfo: {
    name: string
    version?: string
  }
}

export interface MCPInitializeResult {
  protocolVersion: string
  capabilities: MCPCapabilities
  serverInfo: {
    name: string
    version?: string
  }
}

// Tool definitions
export interface MCPTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, MCPToolProperty>
    required?: string[]
    additionalProperties?: boolean
  }
}

export interface MCPToolProperty {
  type: string
  description?: string
  enum?: string[]
  items?: MCPToolProperty
  properties?: Record<string, MCPToolProperty>
  required?: string[]
  default?: unknown
}

// Tool list response
export interface MCPToolsListResult {
  tools: MCPTool[]
  nextCursor?: string
}

// Tool call request/response
export interface MCPToolCallParams {
  name: string
  arguments?: Record<string, unknown>
}

export interface MCPToolCallResult {
  content: MCPContentBlock[]
  isError?: boolean
}

export interface MCPContentBlock {
  type: 'text' | 'image' | 'resource'
  text?: string
  data?: string // Base64 for images
  mimeType?: string
  uri?: string // For resources
}

// Session tracking
export interface MCPSession {
  sessionId: string
  serverId: string
  serverName: string
  initialized: boolean
  capabilities?: MCPCapabilities
  tools?: MCPTool[]
  createdAt: Date
}

// Error codes from MCP spec
export const MCPErrorCodes = {
  // JSON-RPC 2.0 standard errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-specific errors
  SERVER_ERROR: -32000,
  RESOURCE_NOT_FOUND: -32001,
  TOOL_NOT_FOUND: -32002,
} as const

// URL validation result
export interface URLValidationResult {
  valid: boolean
  error?: string
  sanitizedUrl?: string
}
