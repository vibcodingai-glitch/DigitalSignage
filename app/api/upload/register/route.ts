/**
 * POST /api/upload/register
 *
 * Registers a file that was uploaded directly from the browser to Supabase
 * Storage (bypassing Vercel's 4.5MB body limit for large video files).
 *
 * Body: { name, type, file_path, source_url, file_size }
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabaseAdmin = createServiceClient()

    // Verify user is authenticated
    const serverSupabase = createServerClient()
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's org
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { name, type, file_path, source_url, file_size } = await request.json()

    if (!file_path || !source_url) {
      return NextResponse.json({ error: 'file_path and source_url are required' }, { status: 400 })
    }

    // Insert content_items record (no file involved — already in storage)
    const { data: contentItem, error: dbError } = await supabaseAdmin
      .from('content_items')
      .insert({
        organization_id: profile.organization_id,
        name: name || 'Untitled',
        type: type || 'video',
        file_path,
        source_url,
        file_size: file_size || 0,
        duration_seconds: 0, // Videos auto-detect duration on playback
        thumbnail_url: null,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, contentItem })
  } catch (err) {
    console.error('[POST /api/upload/register]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
