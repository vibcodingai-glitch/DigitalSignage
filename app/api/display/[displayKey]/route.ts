/**
 * GET /api/display/[displayKey]
 *
 * Server-side display data resolver. Uses the service role key so RLS
 * policies never block a display screen from loading its assigned content.
 * This is the correct pattern for public kiosk/display endpoints.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role client — only safe to use server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: Request,
  { params }: { params: { displayKey: string } }
) {
  const { displayKey } = params

  try {
    // 1. Fetch screen by display_key
    const { data: screen, error: screenError } = await supabaseAdmin
      .from('screens')
      .select('*')
      .eq('display_key', displayKey)
      .single()

    if (screenError || !screen) {
      return NextResponse.json({ error: 'Screen not found' }, { status: 404 })
    }

    // 2. Resolve timezone from location
    let timezone = 'UTC'
    if (screen.location_id) {
      const { data: loc } = await supabaseAdmin
        .from('locations')
        .select('timezone')
        .eq('id', screen.location_id)
        .single()
      if (loc?.timezone) timezone = loc.timezone
    }

    // 3. Resolve winning project via screen_projects schedule
    const { data: assignments } = await supabaseAdmin
      .from('screen_projects')
      .select('*')
      .eq('screen_id', screen.id)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('sort_order', { ascending: true })

    let winningProjectId: string | null = null

    if (assignments && assignments.length > 0) {
      // Evaluate scheduled assignments first
      const now = new Date()
      const tzOffset = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
      const dayOfWeek = tzOffset.getDay()
      const timeStr = tzOffset.toTimeString().slice(0, 5) // "HH:MM"
      const dateStr = tzOffset.toISOString().slice(0, 10) // "YYYY-MM-DD"

      for (const a of assignments.filter((a) => a.schedule_type === 'scheduled')) {
        if (!a.days_of_week.includes(dayOfWeek)) continue
        if (timeStr < a.start_time || timeStr >= a.end_time) continue
        if (a.start_date && dateStr < a.start_date) continue
        if (a.end_date && dateStr > a.end_date) continue
        winningProjectId = a.project_id
        break
      }

      // Fall back to always-on
      if (!winningProjectId) {
        const alwaysOn = assignments.find((a) => a.schedule_type === 'always')
        if (alwaysOn) winningProjectId = alwaysOn.project_id
      }
    }

    // Fall back to screen.active_project_id
    if (!winningProjectId && screen.active_project_id) {
      winningProjectId = screen.active_project_id
    }

    if (!winningProjectId) {
      console.log(`[API Display] No project assigned for displayKey: ${displayKey}`)
      return NextResponse.json({ screen, project: null, playlist: [], timezone })
    }

    console.log(`[API Display] Resolved winningProjectId: ${winningProjectId} for displayKey: ${displayKey}`)

    // 4. Fetch project + playlist
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, name, settings, layout_type, layout_settings')
      .eq('id', winningProjectId)
      .single()

    const { data: playlistData } = await supabaseAdmin
      .from('playlist_items')
      .select('*, content_item:content_items(*)')
      .eq('project_id', winningProjectId)
      .order('order_index', { ascending: true })

    console.log(`[API Display] RAW playlistData for project ${winningProjectId}:`, JSON.stringify(playlistData, null, 2))

    const playlist = (playlistData || []).map((item: any) => ({
      ...item,
      // Ensure zone_index is always a number (defaults to 0 for fullscreen)
      zone_index: typeof item.zone_index === 'number' ? item.zone_index : 0,
      content_item: Array.isArray(item.content_item)
        ? item.content_item[0]
        : item.content_item,
    }))

    console.log(`[API Display] Returning ${playlist.length} items for project ${winningProjectId}`)

    return NextResponse.json({ screen, project, playlist, timezone })
  } catch (err) {
    console.error('[/api/display] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
