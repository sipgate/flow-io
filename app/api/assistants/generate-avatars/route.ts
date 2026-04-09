import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMissingAvatars } from '@/lib/services/avatar-generator'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and is an admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is owner/admin of any organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Generate missing avatars
    const result = await generateMissingAvatars()

    return NextResponse.json({
      success: true,
      generated: result.generated,
      failed: result.failed,
      errors: result.errors,
    })
  } catch (error) {
    console.error('Error generating avatars:', error)
    return NextResponse.json(
      { error: 'Failed to generate avatars' },
      { status: 500 }
    )
  }
}
