'use server'

import { debug } from '@/lib/utils/logger'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type {
  ContextWebhook,
  ContextWebhookRequest,
  ContextWebhookResponse,
} from '@/types/context-webhook'

interface FetchContextParams {
  assistantId: string
  assistantName: string
  organizationId: string
  callSessionId?: string
  sipgateSessionId: string
  callerNumber?: string
  calledNumber?: string
  direction?: 'inbound' | 'outbound'
}

interface FetchContextResult {
  success: boolean
  contextData: Record<string, unknown>
  error?: string
  durationMs?: number
}

/**
 * Fetch context data from the configured webhook for an assistant
 * Called at the start of each call to inject customer-specific data into the prompt
 */
async function getEnabledContextWebhook(assistantId: string): Promise<ContextWebhook | null> {
  const supabase = createServiceRoleClient()

  // Get context webhook configuration for this assistant
  const { data: webhook, error: webhookError } = await supabase
    .from('context_webhooks')
    .select('*')
    .eq('assistant_id', assistantId)
    .eq('enabled', true)
    .single()

  if (webhookError || !webhook) {
    debug('[ContextWebhook] No enabled webhook for assistant:', assistantId)
    return null
  }

  return webhook as unknown as ContextWebhook
}

async function executeContextFetch(
  contextWebhook: ContextWebhook,
  params: FetchContextParams
): Promise<FetchContextResult & { rawContextData: Record<string, unknown> }> {
  const startTime = Date.now()

  try {
    // Build request payload
    const requestPayload: ContextWebhookRequest = {
      event: 'call_start',
      timestamp: new Date().toISOString(),
      call: {
        session_id: params.sipgateSessionId,
        ...(contextWebhook.include_caller_number && params.callerNumber
          ? { caller_number: params.callerNumber }
          : {}),
        ...(contextWebhook.include_called_number && params.calledNumber
          ? { called_number: params.calledNumber }
          : {}),
        ...(contextWebhook.include_call_direction && params.direction
          ? { direction: params.direction }
          : {}),
      },
      assistant: {
        id: params.assistantId,
        name: params.assistantName,
      },
    }

    debug('[ContextWebhook] Fetching context from:', contextWebhook.url)
    debug('[ContextWebhook] Request payload:', JSON.stringify(requestPayload))

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(contextWebhook.headers || {}),
    }

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), contextWebhook.timeout_ms)

    // Make the request
    const response = await fetch(contextWebhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const durationMs = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('[ContextWebhook] HTTP error:', response.status, errorText)

      return {
        success: false,
        contextData: {},
        rawContextData: {},
        error: `Webhook returned ${response.status}`,
        durationMs,
      }
    }

    // Parse response
    const responseData: ContextWebhookResponse = await response.json()
    debug('[ContextWebhook] Response received:', JSON.stringify(responseData))

    // Prefix the context data with the configured prefix
    const prefix = contextWebhook.response_variable_prefix || 'context'
    const prefixedData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(responseData)) {
      prefixedData[`${prefix}.${key}`] = value
    }

    return {
      success: true,
      contextData: prefixedData,
      rawContextData: responseData,
      durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    const errorMessage = isTimeout
      ? `Timeout after ${contextWebhook.timeout_ms}ms`
      : error instanceof Error
        ? error.message
        : 'Unknown error'

    console.error('[ContextWebhook] Fetch error:', errorMessage)

    return {
      success: false,
      contextData: {},
      rawContextData: {},
      error: errorMessage,
      durationMs,
    }
  }
}

/**
 * Fetch context data from the configured webhook for an assistant
 * Called at the start of each call to inject customer-specific data into the prompt
 */
export async function fetchCallContext(
  params: FetchContextParams
): Promise<FetchContextResult> {
  const contextWebhook = await getEnabledContextWebhook(params.assistantId)
  if (!contextWebhook) {
    return { success: true, contextData: {} }
  }

  const result = await executeContextFetch(contextWebhook, params)

  if (!params.callSessionId) {
    return {
      success: result.success,
      contextData: result.contextData,
      error: result.error,
      durationMs: result.durationMs,
    }
  }

  if (result.success) {
    await storeCallContext({
      callSessionId: params.callSessionId,
      organizationId: params.organizationId,
      contextWebhookId: contextWebhook.id,
      contextData: result.rawContextData,
      fetchDurationMs: result.durationMs ?? 0,
      fetchStatus: 'success',
    })
  } else {
    await storeCallContext({
      callSessionId: params.callSessionId,
      organizationId: params.organizationId,
      contextWebhookId: contextWebhook.id,
      contextData: {},
      fetchDurationMs: result.durationMs ?? 0,
      fetchStatus: result.error?.startsWith('Timeout after') ? 'timeout' : 'error',
      errorMessage: result.error,
    })
  }

  return {
    success: result.success,
    contextData: result.contextData,
    error: result.error,
    durationMs: result.durationMs,
  }
}

/**
 * Fetch context data without persisting it to call_context.
 * Used by the chat simulator, which has no real call_session row.
 */
export async function fetchContextPreview(
  params: Omit<FetchContextParams, 'callSessionId'>
): Promise<FetchContextResult> {
  const contextWebhook = await getEnabledContextWebhook(params.assistantId)
  if (!contextWebhook) {
    return { success: true, contextData: {} }
  }

  const result = await executeContextFetch(contextWebhook, params)
  return {
    success: result.success,
    contextData: result.contextData,
    error: result.error,
    durationMs: result.durationMs,
  }
}

/**
 * Store the context data fetched for a call
 */
async function storeCallContext(params: {
  callSessionId: string
  organizationId: string
  contextWebhookId: string
  contextData: Record<string, unknown>
  fetchDurationMs: number
  fetchStatus: 'success' | 'error' | 'timeout' | 'skipped'
  errorMessage?: string
}): Promise<void> {
  const supabase = createServiceRoleClient()

  const { error } = await supabase.from('call_context').insert({
    call_session_id: params.callSessionId,
    organization_id: params.organizationId,
    context_webhook_id: params.contextWebhookId,
    context_data: params.contextData,
    fetch_duration_ms: params.fetchDurationMs,
    fetch_status: params.fetchStatus,
    error_message: params.errorMessage || null,
  })

  if (error) {
    console.error('[ContextWebhook] Failed to store call context:', error)
  }
}

/**
 * Get the context data for a call session
 */
export async function getCallContextData(
  callSessionId: string
): Promise<Record<string, unknown> | null> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('call_context')
    .select('context_data, context_webhooks(response_variable_prefix)')
    .eq('call_session_id', callSessionId)
    .eq('fetch_status', 'success')
    .single()

  if (error || !data) {
    return null
  }

  // Prefix the context data
  const prefix = (data.context_webhooks as { response_variable_prefix?: string } | null)?.response_variable_prefix || 'context'
  const prefixedData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data.context_data as Record<string, unknown>)) {
    prefixedData[`${prefix}.${key}`] = value
  }

  return prefixedData
}
