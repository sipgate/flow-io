import { DEFAULT_ELEVENLABS_VOICE_ID } from '@/lib/constants/voices'
import { sessionState } from '@/lib/services/session-state'
import type { BargeInConfig } from '@/lib/services/session-state'
import { processSpellingMarkers } from '@/lib/services/tts-spelling'
import { applyPhonemeReplacements, stripPhonemeTag } from '@/lib/services/phoneme-replacer'

type VoiceAssistant = {
  voice_provider?: string | null
  voice_id?: string | null
  voice_language?: string | null
  llm_provider?: string | null
  llm_model?: string | null
  llm_temperature?: number | null
}

/**
 * Build voice/model metadata for transcript entries.
 */
export function buildAssistantMeta(
  assistant: VoiceAssistant,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    voice_provider: assistant.voice_provider || 'azure',
    voice_id: assistant.voice_id || null,
    voice_language: assistant.voice_language || null,
    llm_provider: assistant.llm_provider || null,
    llm_model: assistant.llm_model || null,
    llm_temperature: assistant.llm_temperature ?? null,
    ...extra,
  }
}

/**
 * Build TTS configuration for sipgate AI Flow speak action.
 */
export function buildTTSConfig(assistant: VoiceAssistant): Record<string, unknown> {
  const provider = assistant.voice_provider || 'elevenlabs'
  const voiceId = assistant.voice_id || DEFAULT_ELEVENLABS_VOICE_ID
  const language = assistant.voice_language || null

  // Map elevenlabs to eleven_labs for sipgate
  const sipgateProvider = provider === 'elevenlabs' ? 'eleven_labs' : provider

  if (sipgateProvider === 'eleven_labs') {
    return { provider: sipgateProvider, voice: voiceId }
  }
  // Azure format: includes language
  return { provider: sipgateProvider, language, voice: voiceId }
}

/**
 * Build a sipgate speak response, applying TTS spelling preprocessing.
 * If the LLM output contains [spell]...[/spell] markers, converts them
 * to SSML (Azure) or formatted text (ElevenLabs).
 * Returns the response JSON and the clean text (markers stripped) for transcript storage.
 */
export function buildSpeakResponse(
  sessionId: string,
  llmText: string,
  assistant: VoiceAssistant,
  bargeIn?: BargeInConfig
): { json: Record<string, unknown>; cleanText: string } {
  const provider = assistant.voice_provider || 'elevenlabs'
  const voiceId = assistant.voice_id || DEFAULT_ELEVENLABS_VOICE_ID
  const language = assistant.voice_language || null

  // Apply phoneme replacements BEFORE spelling markers (ElevenLabs only)
  const phonemeReplacements = sessionState.getPhonemeReplacements(sessionId)
  const textWithPhonemes = phonemeReplacements.length
    ? applyPhonemeReplacements(llmText, phonemeReplacements, provider)
    : llmText

  const result = processSpellingMarkers(textWithPhonemes, provider, voiceId, language ?? '')
  const tts = buildTTSConfig(assistant)

  let json: Record<string, unknown>

  if (result.ssml && provider === 'azure') {
    json = { type: 'speak', session_id: sessionId, ssml: result.ssml, tts }
  } else if (result.formattedText && (provider === 'elevenlabs' || provider === 'eleven_labs')) {
    json = { type: 'speak', session_id: sessionId, text: result.formattedText, tts }
  } else {
    json = { type: 'speak', session_id: sessionId, text: result.text, tts }
  }

  // Inject barge-in configuration if provided
  if (bargeIn) {
    json.barge_in = {
      strategy: bargeIn.strategy,
      ...(bargeIn.strategy === 'minimum_characters' && {
        minimum_characters: bargeIn.minimum_characters,
        allow_after_ms: bargeIn.allow_after_ms,
      }),
      ...(bargeIn.strategy === 'immediate' && {
        allow_after_ms: bargeIn.allow_after_ms,
      }),
    }
  }

  // Strip any phoneme tags from transcript text so callers see clean text
  const cleanText = stripPhonemeTag(result.text)

  return { json, cleanText }
}
