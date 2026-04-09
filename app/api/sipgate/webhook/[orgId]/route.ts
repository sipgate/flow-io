import { NextRequest, NextResponse } from 'next/server'
import { sessionState } from '@/lib/services/session-state'
import { cancelPendingMCP } from '@/lib/services/pending-mcp-state'
import { handleSessionStart } from '../handlers/session-start'
import { handleUserSpeak } from '../handlers/user-speak'
import { handleSessionEnd } from '../handlers/session-end'
import { handleAssistantSpeechEnded } from '../handlers/assistant-speech-ended'
import type { SipgateEvent, UserBargeInEvent } from '../handlers/lib/types'

function handleUserBargeIn(event: UserBargeInEvent): NextResponse {
  console.log('🔇 User Barge-In:', event.session.id)
  cancelPendingMCP(event.session.id)
  sessionState.deletePendingAction(event.session.id)
  sessionState.setBargeInOccurred(event.session.id)
  return new NextResponse(null, { status: 200 })
}

async function verifyWebhookSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const webhookToken = process.env.SIPGATE_WEBHOOK_TOKEN
  if (webhookToken) {
    return request.headers.get('x-api-token') === webhookToken
  }

  const secret = process.env.SIPGATE_WEBHOOK_SECRET
  if (!secret) return true

  const signature = request.headers.get('x-sipgate-signature')
  if (!signature) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const expected =
    'sha256=' +
    Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

  return signature === expected
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params
    const rawBody = await request.text()

    if (!(await verifyWebhookSignature(request, rawBody))) {
      console.warn('⚠️ Webhook signature verification failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const event: SipgateEvent = JSON.parse(rawBody)
    console.log('📨 Received sipgate event:', event.type, 'orgId:', orgId)

    switch (event.type) {
      case 'session_start':
        return handleSessionStart(event, orgId)

      case 'user_speak': {
        const sid = event.session.id
        const prevLock = sessionState.getLock(sid) || Promise.resolve(undefined as unknown as NextResponse)
        const currentLock = prevLock
          .catch(() => {})
          .then(() => handleUserSpeak(event))
        sessionState.setLock(sid, currentLock as Promise<NextResponse>)
        const result = await currentLock
        if (sessionState.getLock(sid) === currentLock) {
          sessionState.deleteLock(sid)
        }
        return result
      }

      case 'assistant_speech_ended':
        return handleAssistantSpeechEnded(event)

      case 'user_barge_in':
        return handleUserBargeIn(event)

      case 'session_end':
        return handleSessionEnd(event)

      default:
        console.log('Unknown event type:', (event as { type: string }).type)
        return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
