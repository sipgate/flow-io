/**
 * MCP Tool Converter
 * Converts MCP tool definitions to LLM tool format (OpenAI function calling schema)
 */

import type { LLMTool } from '@/lib/llm/types'
import type { MCPTool, MCPToolProperty } from './types'

/**
 * Sanitize server name for use in tool namespace
 * Removes special characters, converts to lowercase with underscores
 */
function sanitizeServerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 30) // Limit length
}

/**
 * Convert MCP tool property to OpenAI parameter format
 */
function convertProperty(prop: MCPToolProperty): {
  type: string
  description?: string
  enum?: string[]
  items?: Record<string, unknown>
} {
  const result: {
    type: string
    description?: string
    enum?: string[]
    items?: Record<string, unknown>
  } = {
    type: prop.type,
  }

  if (prop.description) {
    result.description = prop.description
  }

  if (prop.enum) {
    result.enum = prop.enum
  }

  // Handle array items
  if (prop.type === 'array' && prop.items) {
    result.items = convertProperty(prop.items)
  }

  return result
}

/**
 * Convert MCP tool definition to LLMTool format (OpenAI function calling schema)
 * Adds namespace prefix to prevent tool name collisions across servers
 */
export function convertMCPToolToLLMTool(
  mcpTool: MCPTool,
  serverName: string
): LLMTool {
  const sanitizedServerName = sanitizeServerName(serverName)

  // Namespace the tool with server name using __ separator (OpenAI-safe: ^[a-zA-Z0-9_-]+$)
  // Format: server_name__tool_name
  const namespacedName = `${sanitizedServerName}__${mcpTool.name}`

  // Convert properties to OpenAI format
  const properties: Record<string, { type: string; description: string; enum?: string[] }> = {}

  if (mcpTool.inputSchema.properties) {
    for (const [key, value] of Object.entries(mcpTool.inputSchema.properties)) {
      const converted = convertProperty(value)
      properties[key] = {
        type: converted.type,
        description: converted.description || `Parameter: ${key}`,
        ...(converted.enum && { enum: converted.enum }),
      }
    }
  }

  // Build description with server context
  const description = mcpTool.description
    ? `[${serverName}] ${mcpTool.description}`
    : `Tool from ${serverName}: ${mcpTool.name}`

  return {
    type: 'function',
    function: {
      name: namespacedName,
      description,
      parameters: {
        type: 'object',
        properties,
        required: mcpTool.inputSchema.required || [],
      },
    },
  }
}

/**
 * Convert multiple MCP tools from a single server to LLM tools
 */
export function convertServerToolsToLLMTools(
  serverName: string,
  tools: MCPTool[]
): LLMTool[] {
  return tools.map(tool => convertMCPToolToLLMTool(tool, serverName))
}

/**
 * Convert MCP tools from multiple servers to LLM tools
 * Merges all tools into a single array with namespace prefixes
 */
export function convertMCPToolsToLLMTools(
  serverTools: Array<{ serverName: string; tools: MCPTool[] }>
): LLMTool[] {
  const llmTools: LLMTool[] = []

  for (const { serverName, tools } of serverTools) {
    const converted = convertServerToolsToLLMTools(serverName, tools)
    llmTools.push(...converted)
  }

  return llmTools
}

/**
 * Parse namespaced tool name back to server name and tool name
 * @param namespacedName Tool name in format "server_name__tool_name"
 * @returns Object with serverName and toolName
 */
export function parseNamespacedToolName(namespacedName: string): {
  serverName: string
  toolName: string
} {
  const sepIndex = namespacedName.indexOf('__')

  if (sepIndex === -1) {
    // No namespace, return as-is (shouldn't happen with MCP tools)
    return {
      serverName: '',
      toolName: namespacedName,
    }
  }

  return {
    serverName: namespacedName.substring(0, sepIndex),
    toolName: namespacedName.substring(sepIndex + 2),
  }
}

/**
 * Check if a tool name is an MCP tool (server__tool double-underscore format)
 */
export function isMCPTool(toolName: string): boolean {
  return toolName.includes('__')
}

/**
 * Get unique server names from a list of namespaced tool names
 */
export function getServersFromToolNames(toolNames: string[]): string[] {
  const servers = new Set<string>()

  for (const name of toolNames) {
    if (isMCPTool(name)) {
      const { serverName } = parseNamespacedToolName(name)
      if (serverName) {
        servers.add(serverName)
      }
    }
  }

  return Array.from(servers)
}
