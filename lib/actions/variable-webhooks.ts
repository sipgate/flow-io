'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { debug } from '@/lib/utils/logger'
import type {
  VariableWebhook,
  VariableWebhookInsert,
  VariableWebhookUpdate,
  VariableWebhookPayload,
  ExtractedVariable,
  VariableDefinition,
} from '@/types/variables'

/**
 * Get webhook configuration for an assistant
 */
export async function getAssistantWebhook(assistantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { webhook: null, error: 'Unauthorized' }
  }

  const { data: webhook, error } = await supabase
    .from('variable_webhooks')
    .select('*')
    .eq('assistant_id', assistantId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned (which is fine)
    console.error('Error fetching webhook:', error)
    return { webhook: null, error: error.message }
  }

  return { webhook: webhook as unknown as VariableWebhook | null }
}

/**
 * Create or update webhook configuration
 */
export async function upsertAssistantWebhook(data: VariableWebhookInsert) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { webhook: null, error: 'Unauthorized' }
  }

  // Check if webhook already exists
  const { data: existing } = await supabase
    .from('variable_webhooks')
    .select('id')
    .eq('assistant_id', data.assistant_id)
    .single()

  let result
  if (existing) {
    // Update existing
    result = await supabase
      .from('variable_webhooks')
      .update({
        name: data.name,
        url: data.url,
        enabled: data.enabled,
        headers: data.headers,
        include_transcript: data.include_transcript,
      })
      .eq('id', existing.id)
      .select()
      .single()
  } else {
    // Create new
    result = await supabase
      .from('variable_webhooks')
      .insert(data)
      .select()
      .single()
  }

  if (result.error) {
    console.error('Error upserting webhook:', result.error)
    return { webhook: null, error: result.error.message }
  }

  return { webhook: result.data as unknown as VariableWebhook }
}

/**
 * Delete webhook configuration
 */
export async function deleteAssistantWebhook(assistantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('variable_webhooks')
    .delete()
    .eq('assistant_id', assistantId)

  if (error) {
    console.error('Error deleting webhook:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Send extracted variables to webhook
 * Called by the variable extractor service
 */
export async function sendVariableWebhook(
  assistantId: string,
  callSessionId: string,
  extractedVariables: ExtractedVariable[],
  definitions: VariableDefinition[]
): Promise<void> {
  const supabase = createServiceRoleClient()

  // Get webhook configuration
  const { data: webhook, error: webhookError } = await supabase
    .from('variable_webhooks')
    .select('*')
    .eq('assistant_id', assistantId)
    .eq('enabled', true)
    .single()

  if (webhookError || !webhook) {
    debug('[Webhook] No enabled webhook for assistant:', assistantId)
    return
  }

  const typedWebhook = webhook as unknown as VariableWebhook

  // Get call session details
  const { data: session, error: sessionError } = await supabase
    .from('call_sessions')
    .select(`
      id,
      session_id,
      caller_number,
      duration_seconds,
      status,
      assistants (
        id,
        name
      )
    `)
    .eq('id', callSessionId)
    .single()

  if (sessionError || !session) {
    console.error('[Webhook] Call session not found:', sessionError)
    return
  }

  interface CallSessionForWebhook {
    id: string
    session_id: string
    caller_number: string | null
    duration_seconds: number | null
    status: string
    assistants: { id: string; name: string } | null
  }

  const typedSession = session as unknown as CallSessionForWebhook

  // Build payload
  const payload: VariableWebhookPayload = {
    event: 'variables_extracted',
    timestamp: new Date().toISOString(),
    call_session: {
      id: typedSession.id,
      session_id: typedSession.session_id,
      caller_number: typedSession.caller_number || '',
      duration_seconds: typedSession.duration_seconds || 0,
      status: typedSession.status,
    },
    assistant: {
      id: typedSession.assistants?.id || assistantId,
      name: typedSession.assistants?.name || 'Unknown',
    },
    variables: extractedVariables.map((v) => {
      const def = definitions.find((d) => d.id === v.variable_definition_id)
      return {
        name: v.name,
        label: v.label,
        type: v.type,
        value: v.value,
        confidence: v.confidence,
        required: def?.required || false,
      }
    }),
  }

  if (typedWebhook.include_transcript) {
    const { data: transcriptRows } = await supabase
      .from('call_transcripts')
      .select('role, content, timestamp, sequence_number')
      .eq('call_session_id', callSessionId)
      .order('sequence_number', { ascending: true })

    if (transcriptRows) {
      payload.transcript = transcriptRows as VariableWebhookPayload['transcript']
    }
  }

  // Send webhook
  try {
    debug('[Webhook] Sending to:', typedWebhook.url)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(typedWebhook.headers as Record<string, string> || {}),
    }

    const response = await fetch(typedWebhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('[Webhook] Failed with status:', response.status)
      const body = await response.text()
      console.error('[Webhook] Response body:', body)
    } else {
      debug('[Webhook] Successfully delivered')
    }

  } catch (error) {
    console.error('[Webhook] Delivery error:', error)
  }
}

/**
 * Test webhook configuration by sending a test payload
 */
export async function testWebhook(
  url: string,
  headers: Record<string, string> = {}
) {
  const testPayload: VariableWebhookPayload = {
    event: 'variables_extracted',
    timestamp: new Date().toISOString(),
    call_session: {
      id: 'test-session-id',
      session_id: 'test-sipgate-session',
      caller_number: '+491234567890',
      duration_seconds: 120,
      status: 'completed',
    },
    assistant: {
      id: 'test-assistant-id',
      name: 'Test Assistant',
    },
    variables: [
      {
        name: 'customer_name',
        label: 'Customer Name',
        type: 'string',
        value: 'John Doe',
        confidence: 0.95,
        required: true,
      },
      {
        name: 'customer_email',
        label: 'Customer Email',
        type: 'email',
        value: 'john@example.com',
        confidence: 0.88,
        required: true,
      },
    ],
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(testPayload),
    })

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
    }

  } catch (error) {
    return {
      success: false,
      status: 0,
      statusText: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
