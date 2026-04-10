export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/+$/, '')
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_APP_URL must be set in production. ' +
      'This prevents host-header poisoning attacks.'
    )
  }
  return 'http://localhost:3000'
}
