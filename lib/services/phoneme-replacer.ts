/**
 * Pronunciation Alias Replacer
 *
 * Replaces words with alternate spellings before sending text to ElevenLabs TTS.
 * ElevenLabs Flash 2.5 does NOT support <phoneme> SSML tags — they are silently
 * dropped. Plain text alias replacement (e.g. "sipgate" → "zipgate") works with
 * all models.
 */

import type { PhonemeReplacement } from '@/types/phoneme-sets'

/**
 * Replace words with their pronunciation aliases in text.
 *
 * - Whole-word, case-insensitive matching
 * - Preserves original casing of surrounding text
 * - Only applies for ElevenLabs provider
 */
export function applyPhonemeReplacements(
  text: string,
  replacements: PhonemeReplacement[],
  provider: string
): string {
  if (!replacements.length) return text

  // Only apply for ElevenLabs
  const isElevenLabs = provider === 'elevenlabs' || provider === 'eleven_labs'
  if (!isElevenLabs) return text

  let result = text

  for (const { word, phoneme: alias } of replacements) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
    result = result.replace(regex, alias)
  }

  return result
}

/**
 * No-op kept for backwards compatibility — aliases leave no markup to strip.
 * @deprecated Not needed with alias-based replacement.
 */
export function stripPhonemeTag(text: string): string {
  // Remove any legacy <phoneme> tags that may have been stored
  return text.replace(/<phoneme[^>]*>(.*?)<\/phoneme>/g, '$1')
}
