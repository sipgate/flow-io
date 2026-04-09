import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MODEL_ID = 'eleven_flash_v2_5'

/** Fetch the first available voice on this account (works on free and paid tiers) */
async function getFirstVoiceId(apiKey: string): Promise<string | null> {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.voices?.[0]?.voice_id ?? null
}

/**
 * POST /api/phoneme-preview
 * Body: { word: string; alias: string; voiceId?: string }
 * Returns: audio/mpeg stream
 */
export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 503 })
  }

  const { word, alias, voiceId: requestedVoiceId } = await req.json()

  // Use requested voice, fall back to first available voice on this account
  const voiceId = requestedVoiceId ?? await getFirstVoiceId(apiKey)
  if (!voiceId) {
    return NextResponse.json({ error: 'No voices available on this ElevenLabs account' }, { status: 503 })
  }

  if (!word?.trim() || !alias?.trim()) {
    return NextResponse.json({ error: 'word and alias are required' }, { status: 400 })
  }

  // Send alias text directly — plain word substitution, no SSML tags needed
  const text = `Der Text wird ${alias} ausgesprochen.`

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error('[PhonemePreview] ElevenLabs error:', response.status, err)
    return NextResponse.json({ error: 'ElevenLabs TTS failed' }, { status: 502 })
  }

  const audioBuffer = await response.arrayBuffer()
  return new NextResponse(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
