import { NextRequest, NextResponse } from 'next/server'
import { getTestSessionHistory } from '@/lib/actions/test-chat'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const { history, error } = await getTestSessionHistory(sessionId)

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Error in test-chat/session/history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
