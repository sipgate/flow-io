/**
 * Next.js Proxy
 *
 * Runs on every request to:
 * 1. Refresh user authentication sessions
 * 2. Protect routes that require authentication
 * 3. Enforce organization context
 */

import { updateSession } from '@/lib/supabase/middleware'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/sipgate (sipgate webhook endpoints - must be publicly accessible)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/sipgate|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
