/**
 * POST /api/display/heartbeat
 *
 * Server-side heartbeat endpoint. Updates screen status and current_state
 * using the service role key, so unauthenticated display clients can
 * still report their online status.
 *
 * Body: { display_key, status, current_state }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { display_key, status = 'online', current_state = {} } = await request.json()

    if (!display_key) {
      return NextResponse.json({ error: 'display_key required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('screens')
      .update({
        status,
        last_heartbeat: new Date().toISOString(),
        current_state,
      })
      .eq('display_key', display_key)

    if (error) {
      console.error('[heartbeat] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[heartbeat] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
