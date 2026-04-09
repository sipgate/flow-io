export interface VoiceOption {
  id: string
  name: string
  gender: 'F' | 'M'
  desc?: string
  lang?: string
  flag?: string
}

export const AZURE_VOICES: VoiceOption[] = [
  // German
  { id: 'de-DE-SeraphinaMultilingualNeural', name: 'Seraphina', gender: 'F', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Multilingual, modern HD voice' },
  { id: 'de-DE-FlorianMultilingualNeural', name: 'Florian', gender: 'M', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Multilingual, modern HD voice' },
  { id: 'de-DE-KatjaNeural', name: 'Katja', gender: 'F', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Professional, clear' },
  { id: 'de-DE-ConradNeural', name: 'Conrad', gender: 'M', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Deep, authoritative' },
  { id: 'de-DE-AmalaNeural', name: 'Amala', gender: 'F', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Friendly, warm' },
  { id: 'de-DE-BerndNeural', name: 'Bernd', gender: 'M', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Steady, reliable' },
  { id: 'de-DE-ChristophNeural', name: 'Christoph', gender: 'M', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Neutral, informative' },
  { id: 'de-DE-ElkeNeural', name: 'Elke', gender: 'F', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Mature, composed' },
  { id: 'de-DE-KasperNeural', name: 'Kasper', gender: 'M', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Youthful, energetic' },
  { id: 'de-DE-KillianNeural', name: 'Killian', gender: 'M', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Confident, articulate' },
  { id: 'de-DE-KlarissaNeural', name: 'Klarissa', gender: 'F', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Bright, expressive' },
  { id: 'de-DE-KlausNeural', name: 'Klaus', gender: 'M', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Traditional, clear' },
  { id: 'de-DE-LouisaNeural', name: 'Louisa', gender: 'F', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Gentle, approachable' },
  { id: 'de-DE-MajaNeural', name: 'Maja', gender: 'F', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Young, lively' },
  { id: 'de-DE-RalfNeural', name: 'Ralf', gender: 'M', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Calm, narrative' },
  { id: 'de-DE-TanjaNeural', name: 'Tanja', gender: 'F', lang: 'de-DE', flag: '\u{1F1E9}\u{1F1EA}', desc: 'Warm, conversational' },
  // English US
  { id: 'en-US-AvaMultilingualNeural', name: 'Ava', gender: 'F', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Multilingual, modern HD voice' },
  { id: 'en-US-AndrewMultilingualNeural', name: 'Andrew', gender: 'M', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Multilingual, modern HD voice' },
  { id: 'en-US-EmmaNeural', name: 'Emma', gender: 'F', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Clear, versatile' },
  { id: 'en-US-BrianNeural', name: 'Brian', gender: 'M', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Confident, professional' },
  { id: 'en-US-JennyNeural', name: 'Jenny', gender: 'F', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Friendly, professional' },
  { id: 'en-US-GuyNeural', name: 'Guy', gender: 'M', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Clear, neutral' },
  { id: 'en-US-AriaNeural', name: 'Aria', gender: 'F', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Expressive, engaging' },
  { id: 'en-US-DavisNeural', name: 'Davis', gender: 'M', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Calm, composed' },
  { id: 'en-US-JaneNeural', name: 'Jane', gender: 'F', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Warm, approachable' },
  { id: 'en-US-JasonNeural', name: 'Jason', gender: 'M', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Casual, friendly' },
  { id: 'en-US-SaraNeural', name: 'Sara', gender: 'F', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Gentle, conversational' },
  { id: 'en-US-TonyNeural', name: 'Tony', gender: 'M', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Personable, upbeat' },
  { id: 'en-US-NancyNeural', name: 'Nancy', gender: 'F', lang: 'en-US', flag: '\u{1F1FA}\u{1F1F8}', desc: 'Warm, mature' },
  // English UK
  { id: 'en-GB-SoniaNeural', name: 'Sonia', gender: 'F', lang: 'en-GB', flag: '\u{1F1EC}\u{1F1E7}', desc: 'British, professional' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', gender: 'M', lang: 'en-GB', flag: '\u{1F1EC}\u{1F1E7}', desc: 'British, friendly' },
  { id: 'en-GB-LibbyNeural', name: 'Libby', gender: 'F', lang: 'en-GB', flag: '\u{1F1EC}\u{1F1E7}', desc: 'Warm, clear' },
  { id: 'en-GB-AbbiNeural', name: 'Abbi', gender: 'F', lang: 'en-GB', flag: '\u{1F1EC}\u{1F1E7}', desc: 'Bright, engaging' },
  { id: 'en-GB-AlfieNeural', name: 'Alfie', gender: 'M', lang: 'en-GB', flag: '\u{1F1EC}\u{1F1E7}', desc: 'Youthful, casual' },
  { id: 'en-GB-BellaNeural', name: 'Bella', gender: 'F', lang: 'en-GB', flag: '\u{1F1EC}\u{1F1E7}', desc: 'Soft, gentle' },
  { id: 'en-GB-ElliotNeural', name: 'Elliot', gender: 'M', lang: 'en-GB', flag: '\u{1F1EC}\u{1F1E7}', desc: 'Composed, steady' },
  { id: 'en-GB-OliverNeural', name: 'Oliver', gender: 'M', lang: 'en-GB', flag: '\u{1F1EC}\u{1F1E7}', desc: 'Neutral, articulate' },
  { id: 'en-GB-OliviaNeural', name: 'Olivia', gender: 'F', lang: 'en-GB', flag: '\u{1F1EC}\u{1F1E7}', desc: 'Elegant, expressive' },
  { id: 'en-GB-ThomasNeural', name: 'Thomas', gender: 'M', lang: 'en-GB', flag: '\u{1F1EC}\u{1F1E7}', desc: 'Deep, authoritative' },
  // French
  { id: 'fr-FR-VivienneMultilingualNeural', name: 'Vivienne', gender: 'F', lang: 'fr-FR', flag: '\u{1F1EB}\u{1F1F7}', desc: 'Multilingual, modern HD voice' },
  { id: 'fr-FR-RemyMultilingualNeural', name: 'Remy', gender: 'M', lang: 'fr-FR', flag: '\u{1F1EB}\u{1F1F7}', desc: 'Multilingual, modern HD voice' },
  { id: 'fr-FR-DeniseNeural', name: 'Denise', gender: 'F', lang: 'fr-FR', flag: '\u{1F1EB}\u{1F1F7}', desc: 'Clear, elegant' },
  { id: 'fr-FR-HenriNeural', name: 'Henri', gender: 'M', lang: 'fr-FR', flag: '\u{1F1EB}\u{1F1F7}', desc: 'Warm, confident' },
  { id: 'fr-FR-BrigitteNeural', name: 'Brigitte', gender: 'F', lang: 'fr-FR', flag: '\u{1F1EB}\u{1F1F7}', desc: 'Mature, composed' },
  { id: 'fr-FR-CelesteNeural', name: 'Celeste', gender: 'F', lang: 'fr-FR', flag: '\u{1F1EB}\u{1F1F7}', desc: 'Gentle, soothing' },
  { id: 'fr-FR-CoralieNeural', name: 'Coralie', gender: 'F', lang: 'fr-FR', flag: '\u{1F1EB}\u{1F1F7}', desc: 'Bright, lively' },
  { id: 'fr-FR-JeromeNeural', name: 'Jerome', gender: 'M', lang: 'fr-FR', flag: '\u{1F1EB}\u{1F1F7}', desc: 'Articulate, professional' },
  { id: 'fr-FR-MauriceNeural', name: 'Maurice', gender: 'M', lang: 'fr-FR', flag: '\u{1F1EB}\u{1F1F7}', desc: 'Deep, steady' },
  { id: 'fr-FR-YvesNeural', name: 'Yves', gender: 'M', lang: 'fr-FR', flag: '\u{1F1EB}\u{1F1F7}', desc: 'Calm, narrative' },
  // Spanish
  { id: 'es-ES-ElviraNeural', name: 'Elvira', gender: 'F', lang: 'es-ES', flag: '\u{1F1EA}\u{1F1F8}', desc: 'Professional, clear' },
  { id: 'es-ES-AlvaroNeural', name: 'Alvaro', gender: 'M', lang: 'es-ES', flag: '\u{1F1EA}\u{1F1F8}', desc: 'Friendly, neutral' },
  { id: 'es-ES-AbrilNeural', name: 'Abril', gender: 'F', lang: 'es-ES', flag: '\u{1F1EA}\u{1F1F8}', desc: 'Warm, approachable' },
  { id: 'es-ES-IreneNeural', name: 'Irene', gender: 'F', lang: 'es-ES', flag: '\u{1F1EA}\u{1F1F8}', desc: 'Bright, expressive' },
  { id: 'es-ES-TrianaNeural', name: 'Triana', gender: 'F', lang: 'es-ES', flag: '\u{1F1EA}\u{1F1F8}', desc: 'Lively, engaging' },
  // Italian
  { id: 'it-IT-IsabellaNeural', name: 'Isabella', gender: 'F', lang: 'it-IT', flag: '\u{1F1EE}\u{1F1F9}', desc: 'Warm, expressive' },
  { id: 'it-IT-DiegoNeural', name: 'Diego', gender: 'M', lang: 'it-IT', flag: '\u{1F1EE}\u{1F1F9}', desc: 'Clear, professional' },
  { id: 'it-IT-ElsaNeural', name: 'Elsa', gender: 'F', lang: 'it-IT', flag: '\u{1F1EE}\u{1F1F9}', desc: 'Gentle, friendly' },
  // Dutch
  { id: 'nl-NL-FennaNeural', name: 'Fenna', gender: 'F', lang: 'nl-NL', flag: '\u{1F1F3}\u{1F1F1}', desc: 'Clear, professional' },
  { id: 'nl-NL-MaartenNeural', name: 'Maarten', gender: 'M', lang: 'nl-NL', flag: '\u{1F1F3}\u{1F1F1}', desc: 'Friendly, neutral' },
  { id: 'nl-NL-ColetteNeural', name: 'Colette', gender: 'F', lang: 'nl-NL', flag: '\u{1F1F3}\u{1F1F1}', desc: 'Warm, approachable' },
  // Portuguese BR
  { id: 'pt-BR-FranciscaNeural', name: 'Francisca', gender: 'F', lang: 'pt-BR', flag: '\u{1F1E7}\u{1F1F7}', desc: 'Warm, friendly' },
  { id: 'pt-BR-AntonioNeural', name: 'Antonio', gender: 'M', lang: 'pt-BR', flag: '\u{1F1E7}\u{1F1F7}', desc: 'Clear, professional' },
  // Polish
  { id: 'pl-PL-AgnieszkaNeural', name: 'Agnieszka', gender: 'F', lang: 'pl-PL', flag: '\u{1F1F5}\u{1F1F1}', desc: 'Warm, professional' },
  { id: 'pl-PL-MarekNeural', name: 'Marek', gender: 'M', lang: 'pl-PL', flag: '\u{1F1F5}\u{1F1F1}', desc: 'Steady, clear' },
  // Turkish
  { id: 'tr-TR-EmelNeural', name: 'Emel', gender: 'F', lang: 'tr-TR', flag: '\u{1F1F9}\u{1F1F7}', desc: 'Friendly, warm' },
  { id: 'tr-TR-AhmetNeural', name: 'Ahmet', gender: 'M', lang: 'tr-TR', flag: '\u{1F1F9}\u{1F1F7}', desc: 'Clear, neutral' },
]

export const ELEVENLABS_VOICES: VoiceOption[] = [
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', gender: 'F', desc: 'Middle-aged, African-American accent. Calm with hint of rasp' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', gender: 'F', desc: 'Clear and engaging British woman, great for e-learning' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'F', desc: 'Sensual and raspy, great for character voice-overs' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', gender: 'F', desc: 'Strong, assertive' },
  { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', gender: 'F', desc: 'Pleasant, British' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', gender: 'F', desc: 'Emotional, young' },
  { id: 'LcfcDJNUP1GQjkzn1xUU', name: 'Emily', gender: 'F', desc: 'Calm, gentle' },
  { id: 'jsCqWAovK2LkecY7zXl4', name: 'Freya', gender: 'F', desc: 'Characterful, Nordic' },
  { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi', gender: 'F', desc: 'Childlike, animated' },
  { id: 'z9fAnlkpzviPz146aGWa', name: 'Glinda', gender: 'F', desc: 'Witchy, mystical' },
  { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace', gender: 'F', desc: 'Southern US, gentle' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', gender: 'F', desc: 'Young and playful American, perfect for trendy content' },
  { id: 't0jbNlBVZ17f02VDIeMI', name: 'Jessie', gender: 'F', desc: 'Raspy, fast' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', gender: 'F', desc: 'Sunny enthusiasm with quirky attitude' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', gender: 'F', desc: 'Velvety British voice, delivers with warmth and clarity' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'F', desc: 'Professional woman with pleasing alto pitch' },
  { id: 'zrHiDhphv9ZnVXBqCLjz', name: 'Mimi', gender: 'F', desc: 'Animated, childlike' },
  { id: 'piTKgcLEGmPE4e6mEKli', name: 'Nicole', gender: 'F', desc: 'Whispery, gentle' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'F', desc: 'Matter-of-fact, personable. Great for conversational use' },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', gender: 'F', desc: 'Relaxed, neutral. Ready for narrations or conversations' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'F', desc: 'Young adult with confident, warm and mature quality' },
  { id: 'pMsXgVXv3BLzUgSXRplE', name: 'Serena', gender: 'F', desc: 'Pleasant, calm' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'M', desc: 'Deep, narrating' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', gender: 'M', desc: 'Well-rounded, calm' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', gender: 'M', desc: 'Crisp, authoritative' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', gender: 'M', desc: 'Friendly and comforting, ready to narrate your stories' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'M', desc: 'Middle-aged with resonant, comforting tone. Great for narrations' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', gender: 'M', desc: 'Deceptively gravelly, with an unsettling edge' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', gender: 'M', desc: 'Young Australian with confident, energetic voice' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', gender: 'M', desc: 'Natural and real, down-to-earth. Great across many use cases' },
  { id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde', gender: 'M', desc: 'Great for character use-cases' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'M', desc: 'Strong voice, perfect for professional broadcast or news' },
  { id: 'CYw3kZ02Hs0563khs1Fj', name: 'Dave', gender: 'M', desc: 'Conversational, British-Essex' },
  { id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew', gender: 'M', desc: 'Well-rounded, informative' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', gender: 'M', desc: 'Smooth tenor from a man in his 40s, perfect for agentic use' },
  { id: 'g5CIjZEefAph4nQFvHAz', name: 'Ethan', gender: 'M', desc: 'Soft-spoken, ASMR' },
  { id: 'D38z5RcWu1voky8WS1ja', name: 'Fin', gender: 'M', desc: 'Firm, Irish' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'M', desc: 'Warm resonance that instantly captivates listeners' },
  { id: 'zcAOhNBS3c14rBihAFp1', name: 'Giovanni', gender: 'M', desc: 'Foreigner, Italian-English' },
  { id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry', gender: 'M', desc: 'Animated warrior, ready to charge forward' },
  { id: 'bVMeCyTHy58xNoL34h3p', name: 'Jeremy', gender: 'M', desc: 'Excited, Irish' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'M', desc: 'Deep, warm' },
  { id: 'Zlb1dXrM653N07WRdFW3', name: 'Joseph', gender: 'M', desc: 'British, articulate' },
  { id: 'ZQe5CZNOzWyzPSCn5a3c', name: 'James', gender: 'M', desc: 'Australian, calm' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', gender: 'M', desc: 'Young adult with energy and warmth' },
  { id: 'flq6f7yk4E4fJM5XTYuZ', name: 'Michael', gender: 'M', desc: 'Smooth, old' },
  { id: 'ODq5zmih8GrVes37Dizd', name: 'Patrick', gender: 'M', desc: 'Shouty, warrior' },
  { id: '5Q0t7uMcjvnagumLfvZi', name: 'Paul', gender: 'M', desc: 'Grounded, narrating' },
  { id: 'pJsNpJRIjvv0gEQf9pTf', name: 'Phil', gender: 'M', desc: 'Perfect for phone conversations' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', gender: 'M', desc: 'Easy going, perfect for casual conversations' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', gender: 'M', desc: 'Raspy, young' },
  { id: 'GBv7mTt0atIp3Br8iCZE', name: 'Thomas', gender: 'M', desc: 'Soft and subdued, optimal for narrations or meditations' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will', gender: 'M', desc: 'Conversational and laid back' },
]

// Default fallback voice for error messages and unconfigured assistants
// "Phil" — optimized for phone conversations
export const DEFAULT_ELEVENLABS_VOICE_ID = 'pJsNpJRIjvv0gEQf9pTf'
export const DEFAULT_TTS_PROVIDER = 'eleven_labs' // sipgate format (underscore, not camelCase)

export function findVoiceName(provider: string | null, voiceId: string | null): string | null {
  if (!voiceId) return null
  const list = (provider === 'azure') ? AZURE_VOICES : ELEVENLABS_VOICES
  return list.find((v) => v.id === voiceId)?.name ?? null
}
