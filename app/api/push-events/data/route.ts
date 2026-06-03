/**
 * GET /api/push-events/data — Fetch screens, content items, and events
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabaseAdmin = createServiceClient()

    const serverSupabase = createServerClient()
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const orgId = profile.organization_id

    const { data: screens } = await supabaseAdmin
      .from('screens')
      .select('id, name, status')
      .eq('organization_id', orgId)
      .order('name')

    const [{ data: contentItems }, { data: events }] = await Promise.all([
      supabaseAdmin
        .from('content_items')
        .select('id, name, type, source_url, file_path, duration_seconds, metadata')
        .eq('organization_id', orgId)
        .order('name'),
      supabaseAdmin
        .from('push_events')
        .select('*, screen:screens(name)')
        .in('screen_id', screens?.map(s => s.id) ?? [])
        .order('created_at', { ascending: false })
        .limit(100)
    ])

    return NextResponse.json({
      screens: screens || [],
      contentItems: contentItems || [],
      events: events || []
    })
  } catch (err) {
    console.error('[GET /api/push-events/data]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
