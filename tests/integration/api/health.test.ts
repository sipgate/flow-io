/**
 * Integration test für GET /api/health
 */

import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('gibt status ok zurück', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
  })

  it('enthält einen ISO-8601 Timestamp', async () => {
    const response = await GET()
    const body = await response.json()

    expect(body.timestamp).toBeTruthy()
    expect(() => new Date(body.timestamp)).not.toThrow()
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
  })
})
