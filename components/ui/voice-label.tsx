import { AZURE_VOICES, ELEVENLABS_VOICES, type VoiceOption } from '@/lib/constants/voices'

const PROVIDER_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  eleven_labs: 'ElevenLabs',
  azure: 'Azure',
}

function findVoice(provider: string | null | undefined, voiceId: string | null | undefined): VoiceOption | null {
  if (!voiceId) return null
  const list = provider === 'azure' ? AZURE_VOICES : ELEVENLABS_VOICES
  return list.find((v) => v.id === voiceId) ?? null
}

function prettyProvider(provider: string | null | undefined): string | null {
  if (!provider) return null
  return PROVIDER_LABELS[provider] ?? provider
}

interface VoiceLabelProps {
  provider: string | null | undefined
  voiceId: string | null | undefined
  /** Language override; otherwise the voice's own `lang` is used. */
  language?: string | null
  /**
   * `inline`  — single line: `Name · Provider · Lang` (default, for compact contexts)
   * `stacked` — primary name on top, provider + language muted below (for cards/forms)
   */
  variant?: 'inline' | 'stacked'
  /** Show the country flag emoji prefixed before the name. */
  showFlag?: boolean
  className?: string
}

export function VoiceLabel({
  provider,
  voiceId,
  language,
  variant = 'inline',
  showFlag = false,
  className,
}: VoiceLabelProps) {
  const voice = findVoice(provider, voiceId)
  const name = voice?.name ?? voiceId ?? null
  const lang = language ?? voice?.lang ?? null
  const providerLabel = prettyProvider(provider)

  if (!name) return null

  const flag = showFlag && voice?.flag ? `${voice.flag} ` : ''

  if (variant === 'stacked') {
    const sub = [providerLabel, lang].filter(Boolean).join(' · ')
    return (
      <span className={className}>
        <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-100">
          {flag}
          {name}
        </span>
        {sub && (
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">
            {sub}
          </span>
        )}
      </span>
    )
  }

  const parts = [`${flag}${name}`, providerLabel, lang].filter(Boolean) as string[]
  return <span className={className}>{parts.join(' · ')}</span>
}
