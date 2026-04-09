/**
 * TTS Spelling / Buchstabieren Support
 *
 * Detects [spell]...[/spell] markers in LLM output and converts them
 * to proper TTS-friendly format:
 * - Azure: Full SSML with <say-as>, <break>, <prosody> tags
 * - ElevenLabs: Formatted text with <break> tags (only tag ElevenLabs supports)
 */

export interface SpellingResult {
  /** Plain text for transcript storage (markers stripped) */
  text: string
  /** SSML string for Azure TTS (only set when spelling is detected and provider is Azure) */
  ssml?: string
  /** Formatted plain text for ElevenLabs (characters spaced out with punctuation pauses) */
  formattedText?: string
}

const SPELL_MARKER_REGEX = /\[spell\]([\s\S]*?)\[\/spell\]/g

/**
 * Check if LLM output contains any [spell] markers.
 */
export function hasSpellingMarkers(text: string): boolean {
  return SPELL_MARKER_REGEX.test(text)
}

/**
 * Convert a string of characters into SSML spell-out markup for Azure.
 * Each character is wrapped in <say-as interpret-as="characters"> with pauses between groups.
 */
function toAzureSSML(content: string): string {
  // Trim the content
  const trimmed = content.trim()
  if (!trimmed) return ''

  const parts: string[] = []

  for (const char of trimmed) {
    if (char === ' ') {
      parts.push('<break time="250ms"/>')
    } else if (char === '@') {
      parts.push('<break time="100ms"/>at<break time="100ms"/>')
    } else if (char === '.') {
      parts.push('<break time="100ms"/>Punkt<break time="100ms"/>')
    } else if (char === '-') {
      parts.push('<break time="100ms"/>Bindestrich<break time="100ms"/>')
    } else if (char === '_') {
      parts.push('<break time="100ms"/>Unterstrich<break time="100ms"/>')
    } else {
      parts.push(`<say-as interpret-as="characters">${escapeXml(char.toLowerCase())}</say-as>`)
      parts.push('<break time="80ms"/>')
    }
  }

  return parts.join('')
}

/**
 * Convert a string of characters into ElevenLabs-friendly plain text.
 * ElevenLabs reads punctuation and XML tags literally, so we only use
 * spaces between uppercase characters to create natural letter-by-letter speech.
 */
function toElevenLabsText(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ''

  const parts: string[] = []

  for (const char of trimmed) {
    if (char === ' ' || char === '.') {
      // Skip dots (LLM often adds them as separators) and spaces
      continue
    } else if (char === '@') {
      parts.push('at')
    } else if (char === '-') {
      parts.push('Bindestrich')
    } else if (char === '_') {
      parts.push('Unterstrich')
    } else {
      parts.push(char.toUpperCase())
    }
  }

  return parts.join(' ')
}

/**
 * Replace bare special characters with spoken words for Azure SSML.
 * Only used for text fragments BETWEEN [spell] blocks (e.g. the "-" in
 * [spell]LANGE[/spell]-[spell]HEGERMANN[/spell]), not for normal sentence text.
 */
function speakSpecialChars(text: string): string {
  return text
    .replace(/-/g, ' Bindestrich ')
    .replace(/_/g, ' Unterstrich ')
    .replace(/@/g, ' at ')
    .replace(/\./g, ' Punkt ')
}

/**
 * Escape special XML characters for SSML.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Strip [spell]...[/spell] markers from text, leaving just the inner content.
 * Used for transcript storage and non-SSML output.
 */
function stripSpellingMarkers(text: string): string {
  return text.replace(SPELL_MARKER_REGEX, '$1')
}

/**
 * Build a full SSML document for Azure TTS.
 * Wraps content in <speak> with proper namespace and voice.
 */
function buildAzureSSMLDocument(ssmlBody: string, voiceId: string, language: string): string {
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${escapeXml(language)}"><voice name="${escapeXml(voiceId)}">${ssmlBody}</voice></speak>`
}

/**
 * Process LLM output: detect [spell] markers and convert to appropriate TTS format.
 *
 * @param text - Raw LLM output that may contain [spell]...[/spell] markers
 * @param voiceProvider - 'azure' | 'elevenlabs' | 'eleven_labs'
 * @param voiceId - Voice identifier (needed for Azure SSML document)
 * @param language - Language code (needed for Azure SSML document)
 * @returns SpellingResult with clean text and optional SSML
 */
export function processSpellingMarkers(
  text: string,
  voiceProvider: string,
  voiceId: string,
  language: string
): SpellingResult {
  // Reset regex state (global flag)
  SPELL_MARKER_REGEX.lastIndex = 0

  if (!hasSpellingMarkers(text)) {
    // Reset again after hasSpellingMarkers consumed state
    SPELL_MARKER_REGEX.lastIndex = 0
    return { text }
  }

  // Reset for actual processing
  SPELL_MARKER_REGEX.lastIndex = 0

  const isAzure = voiceProvider === 'azure'
  const isElevenLabs = voiceProvider === 'elevenlabs' || voiceProvider === 'eleven_labs'

  // Clean text for transcript (strip markers)
  const cleanText = stripSpellingMarkers(text)

  if (isAzure) {
    // Build full SSML: replace [spell]...[/spell] with SSML markup,
    // and wrap normal text in plain SSML
    SPELL_MARKER_REGEX.lastIndex = 0
    let ssmlBody = ''
    let lastIndex = 0
    let matchCount = 0
    let match: RegExpExecArray | null

    while ((match = SPELL_MARKER_REGEX.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index)
      if (before) {
        // Only speak special chars for text BETWEEN spell blocks,
        // not for normal sentence text before the first block
        ssmlBody += matchCount > 0
          ? escapeXml(speakSpecialChars(before))
          : escapeXml(before)
      }

      // Add the spelled content as SSML
      ssmlBody += toAzureSSML(match[1])

      lastIndex = match.index + match[0].length
      matchCount++
    }

    // Add remaining text after last match
    const after = text.slice(lastIndex)
    if (after) {
      ssmlBody += escapeXml(after)
    }

    const ssml = buildAzureSSMLDocument(ssmlBody, voiceId, language)
    return { text: cleanText, ssml }
  }

  if (isElevenLabs) {
    // ElevenLabs: replace [spell] markers with space-separated plain text.
    // Pad with spaces so trailing sentence punctuation doesn't attach to the last character.
    SPELL_MARKER_REGEX.lastIndex = 0
    const formatted = text.replace(SPELL_MARKER_REGEX, (_match, content) => {
      return ' ' + toElevenLabsText(content) + ' '
    })

    return { text: cleanText, formattedText: formatted }
  }

  // Unknown provider — just strip markers
  return { text: cleanText }
}
