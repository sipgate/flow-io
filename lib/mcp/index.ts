/**
 * MCP (Model Context Protocol) Module
 * Provides client library for connecting to MCP servers
 */

// Types
export type {
  MCPServerConfig,
  MCPJSONRPCRequest,
  MCPJSONRPCResponse,
  MCPJSONRPCError,
  MCPCapabilities,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPTool,
  MCPToolProperty,
  MCPToolsListResult,
  MCPToolCallParams,
  MCPToolCallResult,
  MCPContentBlock,
  MCPSession,
  URLValidationResult,
} from './types'

export { MCPErrorCodes } from './types'

// Client
export { MCPClient, createMCPClient } from './client'

// Session Manager
export { MCPSessionManager, createMCPSessionManager } from './session-manager'

// Tool Converter
export {
  convertMCPToolToLLMTool,
  convertServerToolsToLLMTools,
  convertMCPToolsToLLMTools,
  parseNamespacedToolName,
  isMCPTool,
  getServersFromToolNames,
} from './tool-converter'

// Validation
export {
  validateMCPServerURL,
  checkRateLimit,
  clearRateLimit,
  getTimeoutConfig,
} from './validation'
