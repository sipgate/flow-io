'use server'

import { createClient } from '@/lib/supabase/server'
import type { WebhookTool, WebhookToolInsert, WebhookToolUpdate } from '@/types/webhook-tools'

export async function getAssistantWebhookTools(assistantId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { tools: [], error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('webhook_tools')
    .select('*')
    .eq('assistant_id', assistantId)
    .order('created_at', { ascending: true })

  if (error) return { tools: [], error: error.message }
  return { tools: data as unknown as WebhookTool[] }
}

export async function createWebhookTool(data: WebhookToolInsert) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { tool: null, error: 'Unauthorized' }

  const { data: tool, error } = await supabase
    .from('webhook_tools')
    .insert(data)
    .select()
    .single()

  if (error) return { tool: null, error: error.message }
  return { tool: tool as unknown as WebhookTool }
}

export async function updateWebhookTool(id: string, updates: WebhookToolUpdate) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { tool: null, error: 'Unauthorized' }

  const { data: tool, error } = await supabase
    .from('webhook_tools')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return { tool: null, error: error.message }
  return { tool: tool as unknown as WebhookTool }
}

export async function deleteWebhookTool(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase.from('webhook_tools').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function testWebhookTool(
  url: string,
  method: string,
  headers: Record<string, string>,
  authType: string,
  authConfig: { token?: string; apiKey?: string; headerName?: string }
) {
  const allHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (authType === 'bearer' && authConfig.token) {
    allHeaders['Authorization'] = `Bearer ${authConfig.token}`
  } else if (authType === 'api_key' && authConfig.apiKey) {
    allHeaders[authConfig.headerName ?? 'X-API-Key'] = authConfig.apiKey
  }

  const testBody = JSON.stringify({ test: true, source: 'flow-io' })

  try {
    const response = await fetch(url, {
      method: method === 'GET' ? 'GET' : 'POST',
      headers: allHeaders,
      body: method === 'GET' ? undefined : testBody,
      signal: AbortSignal.timeout(10000),
    })
    return { success: response.ok, status: response.status, statusText: response.statusText }
  } catch (err) {
    return { success: false, status: 0, statusText: err instanceof Error ? err.message : 'Unknown error' }
  }
}
