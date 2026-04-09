'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PromptVersion, PromptVersionWithUser } from '@/types/prompt-version'

/**
 * Create a new prompt version when the system prompt changes
 */
export async function createPromptVersion(
  assistantId: string,
  organizationId: string,
  systemPrompt: string,
  note?: string
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get the next version number for this assistant
  const { data: latestVersion } = await supabase
    .from('prompt_versions')
    .select('version_number')
    .eq('assistant_id', assistantId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (latestVersion?.version_number || 0) + 1

  // Insert new version
  const { data, error } = await supabase
    .from('prompt_versions')
    .insert({
      assistant_id: assistantId,
      organization_id: organizationId,
      system_prompt: systemPrompt,
      version_number: nextVersion,
      created_by: user.id,
      note: note || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating prompt version:', error)
    return { error: error.message }
  }

  return { version: data as unknown as PromptVersion, error: null }
}

/**
 * Get all prompt versions for an assistant
 */
export async function getPromptVersions(assistantId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('assistant_id', assistantId)
    .order('version_number', { ascending: false })

  if (error) {
    console.error('Error fetching prompt versions:', error)
    return { versions: [], error: error.message }
  }

  // Cast to our type since Supabase types may not be generated yet
  const rawData = data as unknown as PromptVersion[]

  // Transform the data to match our type
  const versions: PromptVersionWithUser[] = (rawData || []).map((v) => ({
    id: v.id,
    assistant_id: v.assistant_id,
    organization_id: v.organization_id,
    system_prompt: v.system_prompt,
    version_number: v.version_number,
    created_at: v.created_at,
    created_by: v.created_by,
    note: v.note,
    user: null, // User info not fetched for now
  }))

  return { versions, error: null }
}

/**
 * Restore a specific prompt version (sets it as the current prompt)
 */
export async function restorePromptVersion(versionId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get the version to restore
  const { data: versionData, error: versionError } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('id', versionId)
    .single()

  if (versionError || !versionData) {
    return { error: 'Version not found' }
  }

  const version = versionData as unknown as PromptVersion

  // Verify user has permission
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', version.organization_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'You do not have permission to restore this version' }
  }

  // Update the assistant with the restored prompt
  const { error: updateError } = await supabase
    .from('assistants')
    .update({
      system_prompt: version.system_prompt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', version.assistant_id)

  if (updateError) {
    console.error('Error restoring prompt version:', updateError)
    return { error: updateError.message }
  }

  // Create a new version entry to record the restoration
  await createPromptVersion(
    version.assistant_id,
    version.organization_id,
    version.system_prompt,
    `Restored from version ${version.version_number}`
  )

  // Reset test runs since prompt changed
  await supabase
    .from('test_runs')
    .delete()
    .eq('assistant_id', version.assistant_id)

  revalidatePath('/', 'layout')
  return { success: true, error: null }
}

/**
 * Get the current prompt version number for an assistant
 */
export async function getCurrentVersionNumber(assistantId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('prompt_versions')
    .select('version_number')
    .eq('assistant_id', assistantId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  return data?.version_number || 0
}
