import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.resetModules()
  })

  afterEach(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it('debug() gibt aus wenn NODE_ENV nicht production ist', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEBUG', '')
    const { debug } = await import('@/lib/utils/logger')
    debug('test message', 123)
    expect(logSpy).toHaveBeenCalledWith('test message', 123)
  })

  it('debug() ist stumm wenn NODE_ENV production ist', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEBUG', '')
    const { debug } = await import('@/lib/utils/logger')
    debug('secret data')
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('debug() gibt aus wenn DEBUG=true auch in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEBUG', 'true')
    const { debug } = await import('@/lib/utils/logger')
    debug('debug override')
    expect(logSpy).toHaveBeenCalledWith('debug override')
  })

  it('debugWarn() gibt aus wenn NODE_ENV nicht production ist', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('DEBUG', '')
    const { debugWarn } = await import('@/lib/utils/logger')
    debugWarn('warning')
    expect(warnSpy).toHaveBeenCalledWith('warning')
  })

  it('debugWarn() ist stumm wenn NODE_ENV production ist', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEBUG', '')
    const { debugWarn } = await import('@/lib/utils/logger')
    debugWarn('secret warning')
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
