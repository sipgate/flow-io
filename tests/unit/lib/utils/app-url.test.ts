import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'

describe('getAppUrl', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('gibt NEXT_PUBLIC_APP_URL zurueck wenn gesetzt', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')
    const { getAppUrl } = await import('@/lib/utils/app-url')
    expect(getAppUrl()).toBe('https://app.example.com')
  })

  it('entfernt trailing slashes', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com/')
    const { getAppUrl } = await import('@/lib/utils/app-url')
    expect(getAppUrl()).toBe('https://app.example.com')
  })

  it('gibt localhost in development zurueck wenn nicht gesetzt', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'development')
    const { getAppUrl } = await import('@/lib/utils/app-url')
    expect(getAppUrl()).toBe('http://localhost:3000')
  })

  it('wirft in production wenn nicht gesetzt', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    const { getAppUrl } = await import('@/lib/utils/app-url')
    expect(() => getAppUrl()).toThrow('NEXT_PUBLIC_APP_URL must be set in production')
  })

  it('gibt localhost in test zurueck wenn nicht gesetzt', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'test')
    const { getAppUrl } = await import('@/lib/utils/app-url')
    expect(getAppUrl()).toBe('http://localhost:3000')
  })
})
