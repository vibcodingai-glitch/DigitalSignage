/**
 * GET /api/display/[displayKey]/push-events — Poll for active push events
 * 
 * Used by display screens that can't receive Supabase Realtime
 * (anon key + RLS). Returns unexpired, unprocessed push events.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { displayKey: string } }
) {
  try {
    const supabase = createServiceClient()

    // Look up screen by display_key
    const { data: screen } = await supabase
      .from('screens')
      .select('id')
      .eq('display_key', params.displayKey)
      .single()

    if (!screen) {
      return NextResponse.json({ events: [] })
    }

    // Get unexpired push events created in the last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: events } = await supabase
      .from('push_events')
      .select('id, event_type, payload, expires_at, created_at')
      .eq('screen_id', screen.id)
      .gte('created_at', fiveMinAgo)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({ events: events || [] })
  } catch (err) {
    console.error('[GET push-events poll]', err)
    return NextResponse.json({ events: [] })
  }
}
