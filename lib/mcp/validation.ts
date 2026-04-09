/**
 * MCP URL Validation and SSRF Prevention
 * Ensures MCP server URLs are safe to connect to
 */

import type { URLValidationResult } from './types'

const ALLOWED_PROTOCOLS = ['http:', 'https:']
const PRODUCTION_PROTOCOLS = ['https:'] // Only HTTPS in production

// Private/internal IP ranges to block (SSRF prevention)
const BLOCKED_IP_PATTERNS = [
  /^127\./, // Localhost IPv4
  /^10\./, // Private class A
  /^172\.(1[6-9]|2\d|3[01])\./, // Private class B
  /^192\.168\./, // Private class C
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./, // Carrier-grade NAT
]

const BLOCKED_IPV6_PATTERNS = [
  /^::1$/, // IPv6 localhost
  /^fe80:/i, // IPv6 link-local
  /^fc00:/i, // IPv6 unique local (private)
  /^fd00:/i, // IPv6 unique local (private)
  /^::ffff:127\./i, // IPv4-mapped IPv6 localhost
  /^::ffff:10\./i, // IPv4-mapped IPv6 private
  /^::ffff:192\.168\./i, // IPv4-mapped IPv6 private
]

const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '[::]',
  '[::1]',
]

/**
 * Check if a hostname looks like an IP address
 */
function isIPAddress(hostname: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^[\da-fA-F:]+$/

  return ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname)
}

/**
 * Check if an IP address is in a blocked range
 */
function isBlockedIP(ip: string): boolean {
  // Check IPv4 patterns
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(ip)) {
      return true
    }
  }

  // Check IPv6 patterns
  for (const pattern of BLOCKED_IPV6_PATTERNS) {
    if (pattern.test(ip)) {
      return true
    }
  }

  return false
}

/**
 * Validate and sanitize MCP server URL
 * Prevents SSRF attacks by blocking private/internal addresses
 */
export function validateMCPServerURL(url: string): URLValidationResult {
  // Trim whitespace
  const trimmedUrl = url.trim()

  if (!trimmedUrl) {
    return {
      valid: false,
      error: 'URL is required',
    }
  }

  try {
    const parsed = new URL(trimmedUrl)

    // Check protocol
    const isProduction = process.env.NODE_ENV === 'production'
    const allowedProtocols = isProduction ? PRODUCTION_PROTOCOLS : ALLOWED_PROTOCOLS

    if (!allowedProtocols.includes(parsed.protocol)) {
      return {
        valid: false,
        error: `Protocol "${parsed.protocol}" not allowed. Use ${allowedProtocols.join(' or ')}.`,
      }
    }

    const hostname = parsed.hostname.toLowerCase()

    // Block known localhost hostnames
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return {
        valid: false,
        error: isProduction
          ? 'Localhost URLs are not allowed in production'
          : 'This hostname is blocked for security reasons',
      }
    }

    // In production, block IP-based URLs and internal addresses
    if (isProduction) {
      if (isIPAddress(hostname)) {
        if (isBlockedIP(hostname)) {
          return {
            valid: false,
            error: 'Private/internal IP addresses are not allowed',
          }
        }
      }
    }

    // In development, still block obviously dangerous IPs
    if (isIPAddress(hostname) && isBlockedIP(hostname)) {
      // Allow localhost in development for testing
      if (!hostname.startsWith('127.') && hostname !== '::1') {
        return {
          valid: false,
          error: 'This IP address range is blocked for security reasons',
        }
      }
    }

    // Remove fragment (not needed for API calls)
    parsed.hash = ''

    // Ensure path doesn't have directory traversal
    if (parsed.pathname.includes('..')) {
      return {
        valid: false,
        error: 'URL path contains invalid characters',
      }
    }

    return {
      valid: true,
      sanitizedUrl: parsed.toString(),
    }
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format',
    }
  }
}

/**
 * Rate limiting for MCP requests (simple in-memory implementation)
 * For production, use Redis-based rate limiting
 */
interface RateLimitRecord {
  count: number
  resetAt: number
}

const requestCounts = new Map<string, RateLimitRecord>()

export function checkRateLimit(
  serverId: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = requestCounts.get(serverId)

  // First request or window expired
  if (!record || now > record.resetAt) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + windowMs,
    }
    requestCounts.set(serverId, newRecord)
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: newRecord.resetAt,
    }
  }

  // Increment count
  record.count++

  if (record.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
    }
  }

  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt,
  }
}

/**
 * Clear rate limit for a server (useful for testing)
 */
export function clearRateLimit(serverId: string): void {
  requestCounts.delete(serverId)
}

/**
 * Get environment-aware timeout values
 */
export function getTimeoutConfig(): {
  connectTimeoutMs: number
  requestTimeoutMs: number
  maxToolsPerServer: number
} {
  return {
    connectTimeoutMs: parseInt(process.env.MCP_CONNECT_TIMEOUT_MS || '5000', 10),
    requestTimeoutMs: parseInt(process.env.MCP_TOOL_EXECUTION_TIMEOUT_MS || '30000', 10),
    maxToolsPerServer: parseInt(process.env.MCP_MAX_TOOLS_PER_SERVER || '50', 10),
  }
}
