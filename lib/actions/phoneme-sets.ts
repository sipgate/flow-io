'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PhonemeSet, PhonemeSetEntry, PhonemeReplacement } from '@/types/phoneme-sets'

// ============================================================
// Read
// ============================================================

/** Get all phoneme sets for an org, including their entries. */
export async function getPhonemeSets(organizationId: string): Promise<{ sets: PhonemeSet[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sets: [], error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('phoneme_sets')
    .select('*, entries:phoneme_set_entries(*)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching phoneme sets:', error)
    return { sets: [], error: error.message }
  }

  // Sort entries by position
  const sets = (data as unknown as PhonemeSet[]).map((s) => ({
    ...s,
    entries: (s.entries ?? []).sort((a, b) => a.position - b.position),
  }))

  return { sets }
}

/** Get assigned phoneme set IDs + positions for an assistant. */
export async function getAssistantPhonemeSets(
  assistantId: string
): Promise<{ assignments: { phoneme_set_id: string; position: number }[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { assignments: [], error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('assistant_phoneme_sets')
    .select('phoneme_set_id, position')
    .eq('assistant_id', assistantId)
    .order('position', { ascending: true })

  if (error) {
    console.error('Error fetching assistant phoneme sets:', error)
    return { assignments: [], error: error.message }
  }

  return { assignments: data as { phoneme_set_id: string; position: number }[] }
}

export async function getPhonemeReplacementsForAssistant(...args: Parameters<typeof import('@/lib/repositories/phoneme-sets.repository').getPhonemeReplacementsForAssistant>) {
  const { getPhonemeReplacementsForAssistant: fn } = await import('@/lib/repositories/phoneme-sets.repository')
  return fn(...args)
}

// ============================================================
// Phoneme Set CRUD
// ============================================================

export async function createPhonemeSet(
  organizationId: string,
  name: string,
  description?: string
): Promise<{ set: PhonemeSet | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { set: null, error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('phoneme_sets')
    .insert({ organization_id: organizationId, name, description: description || null })
    .select()
    .single()

  if (error) {
    console.error('Error creating phoneme set:', error)
    return { set: null, error: error.message }
  }

  revalidatePath('/', 'layout')
  return { set: data as unknown as PhonemeSet }
}

export async function deletePhonemeSet(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('phoneme_sets')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting phoneme set:', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return {}
}

// ============================================================
// Phoneme Set Entry CRUD
// ============================================================

export async function upsertPhonemeSetEntry(
  setId: string,
  entry: { word: string; alias: string; position?: number; boost_recognition?: boolean; replace_pronunciation?: boolean }
): Promise<{ entry: PhonemeSetEntry | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { entry: null, error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('phoneme_set_entries')
    .upsert(
      {
        phoneme_set_id: setId,
        word: entry.word,
        alias: entry.alias,
        position: entry.position ?? 0,
        is_active: true,
        boost_recognition: entry.boost_recognition ?? true,
        replace_pronunciation: entry.replace_pronunciation ?? true,
      },
      { onConflict: 'phoneme_set_id,word' }
    )
    .select()
    .single()

  if (error) {
    console.error('Error upserting phoneme set entry:', error)
    return { entry: null, error: error.message }
  }

  revalidatePath('/', 'layout')
  return { entry: data as unknown as PhonemeSetEntry }
}

export async function togglePhonemeSetEntry(id: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('phoneme_set_entries')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) {
    console.error('Error toggling phoneme set entry:', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function updatePhonemeSetEntryField(
  id: string,
  field: 'boost_recognition' | 'replace_pronunciation',
  value: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('phoneme_set_entries')
    .update({ [field]: value })
    .eq('id', id)

  if (error) {
    console.error(`Error updating phoneme set entry ${field}:`, error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function deletePhonemeSetEntry(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('phoneme_set_entries')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting phoneme set entry:', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return {}
}

// ============================================================
// Assistant ↔ Phoneme Set assignments
// ============================================================

export async function assignPhonemeSetToAssistant(
  assistantId: string,
  phonemeSetId: string,
  position: number = 0
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('assistant_phoneme_sets')
    .upsert({ assistant_id: assistantId, phoneme_set_id: phonemeSetId, position })

  if (error) {
    console.error('Error assigning phoneme set to assistant:', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function removePhonemeSetFromAssistant(
  assistantId: string,
  phonemeSetId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('assistant_phoneme_sets')
    .delete()
    .eq('assistant_id', assistantId)
    .eq('phoneme_set_id', phonemeSetId)

  if (error) {
    console.error('Error removing phoneme set from assistant:', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return {}
}
