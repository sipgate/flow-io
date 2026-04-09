import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { PhonemeReplacement } from '@/types/phoneme-sets'

/**
 * Get merged phoneme replacements for an assistant using service role.
 * Used by webhook handlers where RLS cannot apply.
 */
export async function getPhonemeReplacementsForAssistant(
  assistantId: string
): Promise<PhonemeReplacement[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('assistant_phoneme_sets')
    .select(`
      position,
      phoneme_sets (
        phoneme_set_entries (
          word,
          alias,
          is_active,
          position
        )
      )
    `)
    .eq('assistant_id', assistantId)
    .order('position', { ascending: true })

  if (error || !data) {
    console.error('Error fetching phoneme replacements:', error)
    return []
  }

  // Merge sets: lower position = higher priority, first match per word wins
  const seen = new Set<string>()
  const merged: PhonemeReplacement[] = []

  for (const row of data as unknown as Array<{
    position: number
    phoneme_sets: { phoneme_set_entries: Array<{ word: string; alias: string; is_active: boolean; position: number }> } | null
  }>) {
    const entries = row.phoneme_sets?.phoneme_set_entries ?? []
    const active = entries
      .filter((e) => e.is_active)
      .sort((a, b) => a.position - b.position)

    for (const entry of active) {
      const key = entry.word.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        merged.push({ word: entry.word, phoneme: entry.alias })
      }
    }
  }

  return merged
}
