'use server'

import { debug } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { revalidatePath } from 'next/cache'
import { DEFAULT_ELEVENLABS_VOICE_ID } from '@/lib/constants/voices'
import { redirect } from 'next/navigation'
import { createPromptVersion } from './prompt-versions'
import { generateAssistantAvatar } from '@/lib/services/avatar-generator'

interface Assistant {
  id: string
  organization_id: string
  name: string
  is_active: boolean
  created_at: string
  [key: string]: unknown
}

export async function getOrganizationAssistants(orgId: string) {
  const supabase = await createClient()

  // Verify user has access to this organization
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { assistants: [] }
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return { assistants: [] }
  }

  // Fetch assistants
  const { data: assistants, error } = await supabase
    .from('assistants')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching assistants:', error)
    return { assistants: [] }
  }

  return { assistants: (assistants as unknown as Assistant[]) || [] }
}

export async function getAssistant(assistantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { assistant: null }
  }

  const { data: assistantData, error } = await supabase
    .from('assistants')
    .select('*')
    .eq('id', assistantId)
    .single()

  if (error || !assistantData) {
    return { assistant: null }
  }

  const assistant = assistantData as unknown as Assistant

  // Verify user has access to this assistant's organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', assistant.organization_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return { assistant: null }
  }

  return { assistant }
}

export async function createAssistant(orgId: string, data: {
  name: string
  description?: string
  voice_provider?: string
  voice_id?: string
  voice_language?: string
  llm_provider?: string
  llm_model?: string
  llm_temperature?: number
  thinking_level?: string | null
  system_prompt?: string
  opening_message?: string
  is_active?: boolean
  enable_hesitation?: boolean
  barge_in_strategy?: string
  barge_in_allow_after_ms?: number
  barge_in_minimum_characters?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify user has permission (owner/admin)
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'You do not have permission to create assistants' }
  }

  const { data: assistant, error } = await supabase
    .from('assistants')
    .insert({
      organization_id: orgId,
      name: data.name,
      description: data.description || null,
      voice_provider: data.voice_provider || 'elevenlabs',
      voice_id: data.voice_id || DEFAULT_ELEVENLABS_VOICE_ID,
      voice_language: data.voice_language || null,
      llm_provider: data.llm_provider || 'google',
      llm_model: data.llm_model || 'gemini-2.5-flash',
      llm_temperature: data.llm_temperature ?? 0.0,
      thinking_level: data.thinking_level || 'minimal',
      system_prompt: data.system_prompt || null,
      opening_message: data.opening_message || null,
      is_active: data.is_active ?? true,
      enable_hesitation: data.enable_hesitation ?? false,
    })
    .select()
    .single()

  if (error || !assistant) {
    console.error('Error creating assistant:', error)
    return { error: error?.message || 'Failed to create assistant' }
  }

  const typedAssistant = assistant as unknown as Assistant

  // Generate avatar in background (don't await to not block the response)
  generateAssistantAvatar(data.name, data.description).then(async ({ url, error: avatarError }) => {
    if (url) {
      const serviceClient = createServiceRoleClient()
      await serviceClient
        .from('assistants')
        .update({ avatar_url: url })
        .eq('id', typedAssistant.id)
      debug('[Assistant] Avatar generated for:', data.name)
    } else if (avatarError) {
      console.warn('Could not generate avatar:', avatarError)
    }
  }).catch(err => {
    console.warn('Avatar generation failed:', err)
  })

  revalidatePath('/', 'layout')
  return { assistant: typedAssistant }
}

export async function updateAssistant(
  assistantId: string,
  data: {
    name?: string
    description?: string
    voice_provider?: string
    voice_id?: string
    voice_language?: string
    llm_provider?: string
    llm_model?: string
    llm_temperature?: number
    system_prompt?: string
    opening_message?: string
    is_active?: boolean
    enable_hesitation?: boolean
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get assistant to verify organization and check current prompt
  const { data: assistant } = await supabase
    .from('assistants')
    .select('organization_id, system_prompt')
    .eq('id', assistantId)
    .single()

  if (!assistant) {
    return { error: 'Assistant not found' }
  }

  const previousPrompt = assistant.system_prompt

  // Verify user has permission
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', assistant.organization_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'You do not have permission to update this assistant' }
  }

  const { error } = await supabase
    .from('assistants')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
      has_undeployed_changes: true,
    })
    .eq('id', assistantId)

  if (error) {
    console.error('Error updating assistant:', error)
    return { error: error.message }
  }

  // If system_prompt changed, save a new version and reset test results
  if (data.system_prompt !== undefined && data.system_prompt !== previousPrompt) {
    // Save the new prompt as a version
    await createPromptVersion(
      assistantId,
      assistant.organization_id,
      data.system_prompt
    )

    // Reset all test results - old results are no longer valid with the new prompt
    const { error: deleteError } = await supabase
      .from('test_runs')
      .delete()
      .eq('assistant_id', assistantId)

    if (deleteError) {
      console.error('Error resetting test runs after prompt change:', deleteError)
      // Don't fail the operation, assistant was already updated
    }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export interface AssistantVersion {
  id: string
  version: number
  deployed_at: string
  created_by: string | null
}

export async function deployAssistant(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: assistant, error: fetchError } = await supabase
    .from('assistants')
    .select('system_prompt, llm_provider, llm_model, llm_temperature, thinking_level, voice_provider, voice_id, voice_language, opening_message, enable_hesitation, deployed_version')
    .eq('id', id)
    .single()

  if (fetchError || !assistant) return { error: fetchError?.message || 'Assistant not found' }

  const raw = assistant as unknown as Record<string, unknown>
  const newVersion = ((raw.deployed_version as number) ?? 0) + 1
  const now = new Date().toISOString()

  await supabase.from('assistant_versions').insert({
    assistant_id: id,
    version: newVersion,
    system_prompt: raw.system_prompt as string | null,
    llm_provider: raw.llm_provider as string | null,
    llm_model: raw.llm_model as string | null,
    llm_temperature: raw.llm_temperature as number | null,
    thinking_level: raw.thinking_level as string | null,
    voice_provider: raw.voice_provider as string | null,
    voice_id: raw.voice_id as string | null,
    voice_language: raw.voice_language as string | null,
    opening_message: raw.opening_message as string | null,
    enable_hesitation: raw.enable_hesitation as boolean | null,
    deployed_at: now,
    created_by: user.id,
  })

  const { error } = await supabase
    .from('assistants')
    .update({ deployed_at: now, deployed_version: newVersion, updated_at: now, has_undeployed_changes: false })
    .eq('id', id)

  revalidatePath('/', 'layout')
  return { error: error?.message || null }
}

export async function revertAssistant(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: latestVersion, error: fetchError } = await supabase
    .from('assistant_versions')
    .select('system_prompt, llm_provider, llm_model, llm_temperature, thinking_level, voice_provider, voice_id, voice_language, opening_message, enable_hesitation')
    .eq('assistant_id', id)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (fetchError || !latestVersion) return { error: fetchError?.message || 'No deployed version found' }

  const v = latestVersion as unknown as Record<string, unknown>
  const result = await updateAssistant(id, {
    system_prompt: v.system_prompt as string | undefined,
    llm_provider: v.llm_provider as string | undefined,
    llm_model: v.llm_model as string | undefined,
    llm_temperature: v.llm_temperature as number | undefined,
    voice_provider: v.voice_provider as string | undefined,
    voice_id: v.voice_id as string | undefined,
    voice_language: v.voice_language as string | undefined,
    opening_message: v.opening_message as string | undefined,
    enable_hesitation: v.enable_hesitation as boolean | undefined,
  })
  if ('error' in result && result.error) return { error: result.error }
  // Reverting restores deployed state — clear the undeployed flag
  await supabase.from('assistants').update({ has_undeployed_changes: false }).eq('id', id)
  return { error: null }
}

export async function getAssistantVersions(id: string): Promise<{ versions: AssistantVersion[]; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('assistant_versions')
    .select('id, version, deployed_at, created_by')
    .eq('assistant_id', id)
    .order('version', { ascending: false })

  return { versions: (data ?? []) as AssistantVersion[], error: error?.message || null }
}

export async function restoreAssistantVersion(
  assistantId: string,
  versionId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: version, error: fetchError } = await supabase
    .from('assistant_versions')
    .select('system_prompt, llm_provider, llm_model, llm_temperature, thinking_level, voice_provider, voice_id, voice_language, opening_message, enable_hesitation')
    .eq('id', versionId)
    .single()

  if (fetchError || !version) return { error: fetchError?.message || 'Version not found' }

  const v = version as unknown as Record<string, unknown>
  const result = await updateAssistant(assistantId, {
    system_prompt: v.system_prompt as string | undefined,
    llm_provider: v.llm_provider as string | undefined,
    llm_model: v.llm_model as string | undefined,
    llm_temperature: v.llm_temperature as number | undefined,
    voice_provider: v.voice_provider as string | undefined,
    voice_id: v.voice_id as string | undefined,
    voice_language: v.voice_language as string | undefined,
    opening_message: v.opening_message as string | undefined,
    enable_hesitation: v.enable_hesitation as boolean | undefined,
  })
  if ('error' in result && result.error) return { error: result.error }
  // Restoring a version counts as deploying that state — clear the undeployed flag
  await supabase.from('assistants').update({ has_undeployed_changes: false }).eq('id', assistantId)
  return { error: null }
}

export async function deleteAssistant(assistantId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get assistant to verify organization
  const { data: assistant } = await supabase
    .from('assistants')
    .select('organization_id')
    .eq('id', assistantId)
    .single()

  if (!assistant) {
    return { error: 'Assistant not found' }
  }

  // Verify user has permission
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', assistant.organization_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'You do not have permission to delete this assistant' }
  }

  const { error } = await supabase
    .from('assistants')
    .delete()
    .eq('id', assistantId)

  if (error) {
    console.error('Error deleting assistant:', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
