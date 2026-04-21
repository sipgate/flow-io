import { debug } from '@/lib/utils/logger'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { LLMTool } from '@/lib/llm/types'
import type { WebhookTool, WebhookToolParameter } from '@/types/webhook-tools'

/**
 * Converts a WebhookToolParameter array into an OpenAI-compatible JSON Schema properties object.
 */
function buildParameterSchema(parameters: WebhookToolParameter[]): {
  properties: Record<string, { type: string; description: string; enum?: string[] }>
  required: string[]
} {
  const properties: Record<string, { type: string; description: string; enum?: string[] }> = {}
  const required: string[] = []

  for (const param of parameters) {
    properties[param.name] = {
      type: param.type,
      description: param.description,
      ...(param.enum ? { enum: param.enum } : {}),
    }
    if (param.required) required.push(param.name)
  }

  return { properties, required }
}

/**
 * Converts a WebhookTool DB record to an LLMTool definition.
 */
export function webhookToolToLLMTool(tool: WebhookTool): LLMTool {
  const { properties, required } = buildParameterSchema(tool.parameters ?? [])

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  }
}

export class WebhookToolExecutor {
  private toolMap = new Map<string, WebhookTool>()

  async initialize(assistantId: string): Promise<{ tools: LLMTool[]; errors: string[] }> {
    const supabase = createServiceRoleClient()
    const errors: string[] = []

    const { data, error } = await supabase
      .from('assistant_webhook_tools')
      .select('webhook_tools(*)')
      .eq('assistant_id', assistantId)

    if (error) {
      errors.push(`Failed to load webhook tools: ${error.message}`)
      return { tools: [], errors }
    }

    const tools: LLMTool[] = []
    this.toolMap.clear()

    for (const row of data ?? []) {
      const tool = (row as unknown as { webhook_tools: WebhookTool }).webhook_tools
      if (!tool || !tool.enabled) continue
      this.toolMap.set(tool.name, tool)
      tools.push(webhookToolToLLMTool(tool))
    }

    debug('[WebhookToolExecutor] Loaded tools:', tools.map(t => t.function.name))
    return { tools, errors }
  }

  isWebhookTool(name: string): boolean {
    return this.toolMap.has(name)
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.toolMap.get(name)
    if (!tool) return `Error: Webhook tool "${name}" not found`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), tool.timeout_ms ?? 10000)

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(tool.headers as Record<string, string> ?? {}),
      }

      if (tool.auth_type === 'bearer' && tool.auth_config?.token) {
        headers['Authorization'] = `Bearer ${tool.auth_config.token}`
      } else if (tool.auth_type === 'api_key' && tool.auth_config?.apiKey) {
        const headerName = tool.auth_config.headerName ?? 'X-API-Key'
        headers[headerName] = tool.auth_config.apiKey
      }

      // Build URL + body
      let url = tool.url
      let body: string | undefined

      if (tool.method === 'GET') {
        const params = new URLSearchParams()
        for (const [k, v] of Object.entries(args)) {
          params.set(k, String(v))
        }
        const qs = params.toString()
        if (qs) url = `${url}${url.includes('?') ? '&' : '?'}${qs}`
      } else {
        body = JSON.stringify(args)
      }

      debug(`[WebhookToolExecutor] Calling ${tool.method} ${url}`)

      const response = await fetch(url, {
        method: tool.method,
        headers,
        body,
        signal: controller.signal,
      })

      const text = await response.text()

      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText} — ${text.substring(0, 500)}`
      }

      // Truncate large responses so they don't blow up the LLM context
      return text.length > 4000 ? text.substring(0, 4000) + '…[truncated]' : text

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return `Error: Webhook tool "${name}" timed out after ${tool.timeout_ms}ms`
      }
      return `Error: ${err instanceof Error ? err.message : String(err)}`
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function createWebhookToolExecutor(): WebhookToolExecutor {
  return new WebhookToolExecutor()
}
