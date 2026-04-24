import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], setAll: () => {} }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/actions/test-chat', () => ({
  createTestSession: vi.fn(),
  addTestTranscriptMessage: vi.fn(),
  getNextSequenceNumber: vi.fn(),
}))

vi.mock('@/lib/actions/scenarios', () => ({
  getScenarioByIdServiceRole: vi.fn(),
}))

vi.mock('@/lib/services/context-webhook', () => ({
  fetchContextPreview: vi.fn(),
}))

import { POST } from '@/app/api/test-chat/session/route'
import { createClient } from '@/lib/supabase/server'
import {
  createTestSession,
  addTestTranscriptMessage,
  getNextSequenceNumber,
} from '@/lib/actions/test-chat'
import { getScenarioByIdServiceRole } from '@/lib/actions/scenarios'
import { fetchContextPreview } from '@/lib/services/context-webhook'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/test-chat/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeSupabaseMock(assistants: Record<string, Record<string, unknown>>) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'assistants') {
        const filters: Record<string, unknown> = {}
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((field: string, value: unknown) => {
            filters[field] = value
            return chain
          }),
          single: vi.fn().mockImplementation(async () => {
            const assistantId = String(filters.id)
            const assistant = assistants[assistantId]
            return { data: assistant || null, error: assistant ? null : { message: 'not found' } }
          }),
        }
        return chain
      }

      if (table === 'test_sessions') {
        const chain = {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
        return chain
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()

  vi.mocked(createTestSession).mockResolvedValue({
    session: {
      id: 'sess-1',
      assistant_id: 'asst-1',
      name: 'Session',
      started_at: '2026-01-01T00:00:00.000Z',
    },
    error: null,
  } as never)

  vi.mocked(getNextSequenceNumber).mockResolvedValue({ sequenceNumber: 1, error: null } as never)
  vi.mocked(addTestTranscriptMessage).mockResolvedValue({
    transcript: {
      id: 'msg-1',
      content: 'Hallo Acme',
      timestamp: '2026-01-01T00:00:00.000Z',
    },
    error: null,
  } as never)

  vi.mocked(fetchContextPreview).mockResolvedValue({
    success: true,
    contextData: { 'context.customer_name': 'Acme' },
  } as never)
})

describe('POST /api/test-chat/session', () => {
  it('substituiert Context-Daten in der Opening Message', async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({
      'asst-1': {
        id: 'asst-1',
        name: 'Agent',
        opening_message: 'Hallo {{context.customer_name}}',
        is_active: true,
        voice_provider: 'elevenlabs',
        voice_id: 'voice-1',
        avatar_url: 'agent.png',
      },
    }) as never)

    const res = await POST(makeRequest({
      organization_id: 'org-1',
      assistant_id: 'asst-1',
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.opening_message.content).toBe('Hallo Acme')
    expect(body.agent.name).toBe('Agent')
    expect(fetchContextPreview).toHaveBeenCalledWith(expect.objectContaining({
      assistantId: 'asst-1',
      assistantName: 'Agent',
    }))
  })

  it('verwendet im Szenario den echten Entry-Agent statt des ersten Agenten im Array', async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({
      'voice-1': {
        id: 'voice-1',
        name: 'Voice Agent',
        opening_message: 'Voice opening',
        is_active: true,
        voice_provider: 'elevenlabs',
        voice_id: 'voice-A',
        avatar_url: 'voice.png',
      },
      'entry-1': {
        id: 'entry-1',
        name: 'Entry Agent',
        opening_message: 'Willkommen {{context.customer_name}}',
        is_active: true,
        voice_provider: 'elevenlabs',
        voice_id: 'voice-B',
        avatar_url: 'entry.png',
      },
    }) as never)

    vi.mocked(getScenarioByIdServiceRole).mockResolvedValue({
      scenario: {
        id: 'scn-1',
        name: 'Scenario',
        voice_provider: 'elevenlabs',
        voice_id: 'scenario-voice',
        voice_language: 'de-DE',
        nodes: [
          {
            id: 'voice-node',
            type: 'agent',
            data: { label: 'Voice Agent', assistant_id: 'voice-1' },
            position: { x: 0, y: 0 },
          },
          {
            id: 'entry-node',
            type: 'entry_agent',
            data: { label: 'Entry Agent', assistant_id: 'entry-1' },
            position: { x: 100, y: 0 },
          },
        ],
        edges: [
          { id: 'e1', source: 'entry-node', target: 'voice-node' },
        ],
      },
      error: null,
    } as never)

    const res = await POST(makeRequest({
      organization_id: 'org-1',
      scenario_id: 'scn-1',
    }))

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(createTestSession).toHaveBeenCalledWith(expect.objectContaining({
      assistant_id: 'entry-1',
    }))
    expect(body.agent.name).toBe('Entry Agent')
    expect(body.voice.voiceId).toBe('voice-B')
    expect(fetchContextPreview).toHaveBeenCalledWith(expect.objectContaining({
      assistantId: 'entry-1',
      assistantName: 'Entry Agent',
    }))
  })
})
