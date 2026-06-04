/**
 * GET /api/display/[displayKey]
 *
 * Server-side display data resolver. Uses the service role key so RLS
 * policies never block a display screen from loading its assigned content.
 * This is the correct pattern for public kiosk/display endpoints.
 *
 * PERF: All independent queries are parallelized with Promise.all().
 * Response includes Cache-Control for Vercel CDN edge caching.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role client — only safe to use server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { displayKey: string } }
) {
  const { displayKey } = params

  try {
    // ── BATCH 1: Fetch screen first (needed to derive screen.id) ──
    const { data: screen, error: screenError } = await supabaseAdmin
      .from('screens')
      .select('id, display_key, name, status, active_project_id, location_id, current_state, orientation, resolution')
      .eq('display_key', displayKey)
      .single()

    if (screenError || !screen) {
      return NextResponse.json({ error: 'Screen not found' }, { status: 404 })
    }

    // ── BATCH 2: Location + assignments in PARALLEL ──
    const [locationResult, assignmentsResult] = await Promise.all([
      screen.location_id
        ? supabaseAdmin.from('locations').select('timezone').eq('id', screen.location_id).single()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from('screen_projects')
        .select('project_id, schedule_type, days_of_week, start_time, end_time, start_date, end_date, priority')
        .eq('screen_id', screen.id)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('sort_order', { ascending: true }),
    ])

    const timezone = locationResult.data?.timezone || 'UTC'
    const assignments = assignmentsResult.data

    // ── Resolve winning project (pure computation, no I/O) ──
    let winningProjectId: string | null = null

    if (assignments && assignments.length > 0) {
      const now = new Date()
      const tzOffset = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
      const dayOfWeek = tzOffset.getDay()
      const timeStr = tzOffset.toTimeString().slice(0, 5)
      const dateStr = tzOffset.toISOString().slice(0, 10)

      for (const a of assignments) {
        if (a.schedule_type !== 'scheduled') continue
        if (!a.days_of_week.includes(dayOfWeek)) continue
        if (timeStr < a.start_time || timeStr >= a.end_time) continue
        if (a.start_date && dateStr < a.start_date) continue
        if (a.end_date && dateStr > a.end_date) continue
        winningProjectId = a.project_id
        break
      }

      if (!winningProjectId) {
        const alwaysOn = assignments.find((a) => a.schedule_type === 'always')
        if (alwaysOn) winningProjectId = alwaysOn.project_id
      }
    }

    if (!winningProjectId && screen.active_project_id) {
      winningProjectId = screen.active_project_id
    }

    if (!winningProjectId) {
      const res = NextResponse.json({ screen, project: null, playlist: [], timezone })
      res.headers.set('Cache-Control', 'no-store, max-age=0')
      return res
    }

    // ── BATCH 3: Project + playlist in PARALLEL ──
    const [projectResult, playlistResult] = await Promise.all([
      supabaseAdmin
        .from('projects')
        .select('id, name, settings, layout_type, layout_settings')
        .eq('id', winningProjectId)
        .single(),
      supabaseAdmin
        .from('playlist_items')
        .select('*, content_item:content_items(id, name, type, source_url, file_path, thumbnail_url, duration_seconds, metadata)')
        .eq('project_id', winningProjectId)
        .order('order_index', { ascending: true }),
    ])

    const project = projectResult.data
    const playlist = (playlistResult.data || []).map((item: any) => ({
      ...item,
      zone_index: typeof item.zone_index === 'number' ? item.zone_index : 0,
      content_item: Array.isArray(item.content_item)
        ? item.content_item[0]
        : item.content_item,
    }))

    const res = NextResponse.json({ screen, project, playlist, timezone })
    // Cache disabled completely
    res.headers.set('Cache-Control', 'no-store, max-age=0')
    return res
  } catch (err) {
    console.error('[/api/display] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
