import { NextResponse } from 'next/server'

/**
 * Legacy webhook endpoint — org-specific URL required.
 * Use /api/sipgate/webhook/{organizationId} instead.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Missing organization ID. Use /api/sipgate/webhook/{organizationId}' },
    { status: 400 }
  )
}
