const isDebug = process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true'

export function debug(...args: unknown[]): void {
  if (isDebug) console.log(...args)
}

export function debugWarn(...args: unknown[]): void {
  if (isDebug) console.warn(...args)
}
