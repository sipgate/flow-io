'use server'

import { createClient } from '@/lib/supabase/server'
import type { ContextWebhook, ContextWebhookInput } from '@/types/context-webhook'

/**
 * Get context webhook configuration for an assistant
 */
export async function getAssistantContextWebhook(
  assistantId: string
): Promise<{ webhook: ContextWebhook | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('context_webhooks')
    .select('*')
    .eq('assistant_id', assistantId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is fine
    return { webhook: null, error: error.message }
  }

  return { webhook: (data as unknown as ContextWebhook) || null, error: null }
}

/**
 * Create or update context webhook for an assistant
 */
export async function upsertContextWebhook(
  input: ContextWebhookInput
): Promise<{ webhook: ContextWebhook | null; error: string | null }> {
  const supabase = await createClient()

  // Check if webhook already exists
  const { data: existing } = await supabase
    .from('context_webhooks')
    .select('id')
    .eq('assistant_id', input.assistant_id)
    .single()

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('context_webhooks')
      .update({
        name: input.name,
        url: input.url,
        enabled: input.enabled,
        headers: input.headers,
        timeout_ms: input.timeout_ms,
        include_caller_number: input.include_caller_number,
        include_called_number: input.include_called_number,
        include_call_direction: input.include_call_direction,
        response_variable_prefix: input.response_variable_prefix,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      return { webhook: null, error: error.message }
    }

    return { webhook: data as unknown as ContextWebhook, error: null }
  } else {
    // Create new
    const { data, error } = await supabase
      .from('context_webhooks')
      .insert({
        assistant_id: input.assistant_id,
        organization_id: input.organization_id,
        name: input.name || 'Context Webhook',
        url: input.url,
        enabled: input.enabled ?? true,
        headers: input.headers || {},
        timeout_ms: input.timeout_ms || 5000,
        include_caller_number: input.include_caller_number ?? true,
        include_called_number: input.include_called_number ?? true,
        include_call_direction: input.include_call_direction ?? true,
        response_variable_prefix: input.response_variable_prefix || 'context',
      })
      .select()
      .single()

    if (error) {
      return { webhook: null, error: error.message }
    }

    return { webhook: data as unknown as ContextWebhook, error: null }
  }
}

/**
 * Delete context webhook for an assistant
 */
export async function deleteContextWebhook(
  assistantId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('context_webhooks')
    .delete()
    .eq('assistant_id', assistantId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

/**
 * Toggle context webhook enabled status
 */
export async function toggleContextWebhook(
  assistantId: string,
  enabled: boolean
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('context_webhooks')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('assistant_id', assistantId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

/**
 * Test context webhook with sample data
 */
export async function testContextWebhook(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number = 5000
): Promise<{ success: boolean; response?: unknown; error?: string; durationMs: number }> {
  const startTime = Date.now()

  try {
    const testPayload = {
      event: 'call_start',
      timestamp: new Date().toISOString(),
      call: {
        session_id: 'test-session-123',
        caller_number: '+4915112345678',
        called_number: '+4930123456789',
        direction: 'inbound',
      },
      assistant: {
        id: 'test-assistant-id',
        name: 'Test Assistant',
      },
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const durationMs = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        durationMs,
      }
    }

    const responseData = await response.json()

    return {
      success: true,
      response: responseData,
      durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const isTimeout = error instanceof Error && error.name === 'AbortError'

    return {
      success: false,
      error: isTimeout
        ? `Timeout after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : 'Unknown error',
      durationMs,
    }
  }
}
