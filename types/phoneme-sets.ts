export interface PhonemeSet {
  id: string
  organization_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  entries?: PhonemeSetEntry[]
}

export interface PhonemeSetEntry {
  id: string
  phoneme_set_id: string
  word: string
  /** Pronunciation alias — alternate spelling sent to ElevenLabs, e.g. "zipgate" */
  alias: string
  is_active: boolean
  /** When true, word is sent as custom_vocabulary to sipgate Flow for STT boosting */
  boost_recognition: boolean
  /** When true, word is replaced with alias before TTS synthesis */
  replace_pronunciation: boolean
  position: number
}

export interface AssistantPhonemeSet {
  assistant_id: string
  phoneme_set_id: string
  position: number
}

/** Flattened entry used at runtime (webhook / phoneme-replacer) */
export interface PhonemeReplacement {
  word: string
  /** Alias spelling that replaces the word before TTS synthesis */
  phoneme: string
  boost_recognition: boolean
  replace_pronunciation: boolean
}
