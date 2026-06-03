/**
 * POST /api/push-events — Create push events
 * DELETE /api/push-events — Delete push events
 * 
 * Uses service-role key to bypass RLS and avoid client-side
 * auth token refresh deadlocks.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── POST: Create push events ──
export async function POST(request: Request) {
  try {
    const supabaseAdmin = createServiceClient()

    // Verify user is authenticated
    const serverSupabase = createServerClient()
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { events, broadcast, eventType, payload, expiresAt } = body

    // Get user's org
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    // Enrich content_item for override_content events
    async function enrichPayload(p: any, evType: string) {
      if (evType === 'override_content' && p?.content_item_id) {
        const { data: fullItem } = await supabaseAdmin
          .from('content_items')
          .select('id, name, type, source_url, file_path, duration_seconds, metadata')
          .eq('id', p.content_item_id)
          .single()
        if (fullItem) {
          return { ...p, content_item: fullItem }
        }
      }
      return p
    }

    if (broadcast) {
      // Broadcast to all screens in org
      const { data: screens } = await supabaseAdmin
        .from('screens')
        .select('id')
        .eq('organization_id', profile.organization_id)

      if (!screens || screens.length === 0) {
        return NextResponse.json({ error: 'No screens found' }, { status: 400 })
      }

      const enrichedPayload = await enrichPayload(payload, eventType)

      const rows = screens.map(s => ({
        screen_id: s.id,
        event_type: eventType,
        payload: enrichedPayload,
        created_by: user.id,
        expires_at: expiresAt || null
      }))

      const { error } = await supabaseAdmin.from('push_events').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ success: true, count: screens.length })
    }

    // Direct insert (single or multiple screens)
    if (!events || events.length === 0) {
      return NextResponse.json({ error: 'No events provided' }, { status: 400 })
    }

    // Verify all screen_ids belong to user's org
    const screenIds = events.map((e: any) => e.screen_id)
    const { data: validScreens } = await supabaseAdmin
      .from('screens')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .in('id', screenIds)

    if (!validScreens || validScreens.length === 0) {
      return NextResponse.json({ error: 'Invalid screen selection' }, { status: 403 })
    }

    const validIds = new Set(validScreens.map(s => s.id))
    const filteredEvents = events.filter((e: any) => validIds.has(e.screen_id))
    
    // Enrich payloads
    const rows = await Promise.all(filteredEvents.map(async (e: any) => ({
      ...e,
      payload: await enrichPayload(e.payload, e.event_type),
      created_by: user.id
    })))

    const { error } = await supabaseAdmin.from('push_events').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, count: rows.length })
  } catch (err) {
    console.error('[POST /api/push-events]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// ── DELETE: Delete push events ──
export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = createServiceClient()

    const serverSupabase = createServerClient()
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ids } = await request.json()
    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: 'No event IDs provided' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('push_events').delete().in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/push-events]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
