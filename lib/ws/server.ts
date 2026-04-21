/**
 * WebSocket handler for sipgate AI Flow events.
 * Integrated into the custom Next.js server via setupWebSocketServer().
 *
 * URL format: wss://your-domain.com/ws/{orgId}
 * Auth: x-api-token header (SIPGATE_WEBHOOK_TOKEN env var)
 */
import { WebSocketServer, WebSocket } from 'ws'
import type { Server, IncomingMessage } from 'http'
import { debug } from '@/lib/utils/logger'
import { handleSessionStart } from '@/app/api/sipgate/webhook/handlers/session-start'
import { handleUserSpeak } from '@/app/api/sipgate/webhook/handlers/user-speak'
import { handleSessionEnd } from '@/app/api/sipgate/webhook/handlers/session-end'
import { handleAssistantSpeechEnded } from '@/app/api/sipgate/webhook/handlers/assistant-speech-ended'
import { handleDTMFReceived } from '@/app/api/sipgate/webhook/handlers/dtmf-received'
import { handleUserInputTimeout } from '@/app/api/sipgate/webhook/handlers/user-input-timeout'
import { sessionState } from '@/lib/services/session-state'
import { cancelPendingMCP } from '@/lib/services/pending-mcp-state'
import type { SipgateEvent, UserBargeInEvent } from '@/app/api/sipgate/webhook/handlers/lib/types'
import type { NextResponse } from 'next/server'

const TOKEN = process.env.SIPGATE_WEBHOOK_TOKEN

export function setupWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const match = req.url?.match(/^\/ws\/([^/?]+)/)
    if (!match) {
      // Let Next.js handle non-/ws/ upgrades (e.g. HMR WebSocket)
      return
    }

    if (TOKEN) {
      if (req.headers['x-api-token'] !== TOKEN) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('SIPGATE_WEBHOOK_TOKEN unconfigured in production. Rejecting WebSocket connection.')
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    const orgId = match[1]
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, orgId)
    })
  })

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, orgId: string) => {
    debug(`[WS] Connected orgId=${orgId}`)

    ws.on('message', async (data) => {
      let event: SipgateEvent
      try {
        event = JSON.parse(data.toString()) as SipgateEvent
      } catch {
        console.error('[WS] Invalid JSON received')
        return
      }

      console.log(`[WS] event=${event.type} session=${event.session.id}`)

      try {
        let response: Response | null = null

        switch (event.type) {
          case 'session_start':
            response = await handleSessionStart(event, orgId)
            break

          case 'user_speak': {
            const sid = event.session.id
            const prevLock: Promise<NextResponse> =
              sessionState.getLock(sid) ?? (Promise.resolve(undefined) as unknown as Promise<NextResponse>)
            const currentLock = prevLock
              .catch(() => {})
              .then(() => handleUserSpeak(event)) as Promise<NextResponse>
            sessionState.setLock(sid, currentLock)
            response = await currentLock
            if (sessionState.getLock(sid) === currentLock) {
              sessionState.deleteLock(sid)
            }
            break
          }

          case 'assistant_speech_ended':
            response = await handleAssistantSpeechEnded(event)
            break

          case 'user_barge_in': {
            const barge = event as UserBargeInEvent
            cancelPendingMCP(barge.session.id)
            sessionState.deletePendingAction(barge.session.id)
            sessionState.setBargeInOccurred(barge.session.id)
            return
          }

          case 'dtmf_received':
            response = await handleDTMFReceived(event)
            break

          case 'user_input_timeout':
            response = await handleUserInputTimeout(event)
            break

          case 'session_end':
            response = await handleSessionEnd(event)
            break

          default:
            console.warn('[WS] Unknown event type:', (event as { type: string }).type)
            return
        }

        if (response && response.status !== 204 && ws.readyState === WebSocket.OPEN) {
          const text = await response.clone().text()
          if (text) ws.send(text)
        }
      } catch (error) {
        console.error('[WS] Error handling event:', error)
      }
    })

    ws.on('close', () => debug(`[WS] Disconnected orgId=${orgId}`))
    ws.on('error', (err) => console.error(`[WS] Error orgId=${orgId}:`, err))
  })
}
