/**
 * GET /api/dashboard?action=...
 *
 * Unified server-side API for ALL dashboard data fetching.
 * Uses service-role key → no auth token refresh deadlocks.
 *
 * Supported actions:
 *   screens, locations, projects, stats, activity,
 *   project-details (requires &id=), content-library
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Authenticate the request and return the user's org ID. */
async function getOrgId() {
  const serverSupabase = createServerClient()
  const { data: { user }, error } = await serverSupabase.auth.getUser()
  if (error || !user) return null

  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  return profile?.organization_id || null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (!action) {
    return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 })
  }

  try {
    const orgId = await getOrgId()
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sb = createServiceClient()

    switch (action) {
      // ── SCREENS ──────────────────────────────────────────
      case 'screens': {
        const [{ data: screens }, { data: locations }, { data: projects }] = await Promise.all([
          sb.from('screens').select('id, name, status, display_key, location_id, active_project_id, last_heartbeat, orientation, resolution, current_state').eq('organization_id', orgId).order('name'),
          sb.from('locations').select('id, name').eq('organization_id', orgId),
          sb.from('projects').select('id, name').eq('organization_id', orgId)
        ])
        const locationMap = new Map(locations?.map(l => [l.id, l]))
        const projectMap = new Map(projects?.map(p => [p.id, p]))
        return NextResponse.json({
          screens: (screens || []).map(s => ({
            ...s,
            location: locationMap.get(s.location_id) || null,
            project: projectMap.get(s.active_project_id) || null,
          })),
          locations: locations || [],
          projects: projects || []
        })
      }

      // ── LOCATIONS ────────────────────────────────────────
      case 'locations': {
        const [{ data: locations }, { data: screens }] = await Promise.all([
          sb.from('locations').select('*').eq('organization_id', orgId).order('name'),
          sb.from('screens').select('id, location_id').eq('organization_id', orgId)
        ])
        const screensByLocation = new Map<string, number>()
        for (const s of screens || []) {
          if (s.location_id) screensByLocation.set(s.location_id, (screensByLocation.get(s.location_id) || 0) + 1)
        }
        return NextResponse.json(
          (locations || []).map(l => ({ ...l, screen_count: screensByLocation.get(l.id) || 0 }))
        )
      }

      // ── PROJECTS ─────────────────────────────────────────
      case 'projects': {
        const { data: projects } = await sb
          .from('projects')
          .select('id, name, is_active, screen_id, settings, created_at, organization_id')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })

        const projectIds = (projects || []).map(p => p.id)
        const [{ data: items }, { data: screens }] = await Promise.all([
          projectIds.length > 0
            ? sb.from('playlist_items').select('project_id, duration_override').in('project_id', projectIds)
            : Promise.resolve({ data: [] as any[] }),
          sb.from('screens').select('id, name').eq('organization_id', orgId),
        ])

        const countByProject = new Map<string, { count: number; totalDuration: number }>()
        for (const i of items || []) {
          const entry = countByProject.get(i.project_id)
          if (entry) { entry.count++; entry.totalDuration += (i.duration_override || 10) }
          else countByProject.set(i.project_id, { count: 1, totalDuration: i.duration_override || 10 })
        }
        const screenMap = new Map((screens || []).map(s => [s.id, s]))

        return NextResponse.json(
          (projects || []).map(p => {
            const stats = countByProject.get(p.id) || { count: 0, totalDuration: 0 }
            return { ...p, numItems: stats.count, totalDuration: stats.totalDuration, numSchedules: 0, screen: screenMap.get(p.screen_id) || null }
          })
        )
      }

      // ── STATS ────────────────────────────────────────────
      case 'stats': {
        const [locationsCount, activeProjectsCount, itemsCount, screens] = await Promise.all([
          sb.from('locations').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
          sb.from('projects').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('organization_id', orgId),
          sb.from('content_items').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
          sb.from('screens').select('status, active_project_id').eq('organization_id', orgId)
        ])
        const screenCounts = (screens.data || []).reduce((acc: any, s: any) => {
          acc.total++
          if (s.status === 'online') acc.online++; else acc.offline++
          if (!s.active_project_id) acc.unassigned++
          return acc
        }, { total: 0, online: 0, offline: 0, unassigned: 0 })

        return NextResponse.json({
          locations: locationsCount.count || 0,
          projects: activeProjectsCount.count || 0,
          contentItems: itemsCount.count || 0,
          screens: screenCounts
        })
      }

      // ── RECENT ACTIVITY ──────────────────────────────────
      case 'activity': {
        const { data: activity } = await sb.from('screen_logs')
          .select('id, event, created_at, details, screen_id, screens!inner(organization_id)')
          .eq('screens.organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(10)

        if (!activity || activity.length === 0) return NextResponse.json([])

        const screenIds = Array.from(new Set(activity.map(a => a.screen_id).filter(Boolean)))
        const { data: screens } = await sb.from('screens').select('id, name').in('id', screenIds)
        const screenMap = new Map((screens || []).map(s => [s.id, s]))

        return NextResponse.json(
          activity.map(log => ({ ...log, screen: screenMap.get(log.screen_id) || null }))
        )
      }

      // ── PROJECT DETAILS ──────────────────────────────────
      case 'project-details': {
        const projectId = searchParams.get('id')
        if (!projectId) return NextResponse.json({ error: 'Missing project id' }, { status: 400 })

        const [
          { data: project, error: projError },
          { data: playlist },
          { data: schedules },
        ] = await Promise.all([
          sb.from('projects').select('*').eq('id', projectId).single(),
          sb.from('playlist_items')
            .select('id, content_item_id, order_index, duration_override, transition_type, zone_index, valid_from, valid_until, day_part_start, day_part_end, show_qr_code, qr_code_url, content_item:content_items(id, name, type, source_url, file_path, thumbnail_url, duration_seconds, metadata)')
            .eq('project_id', projectId)
            .order('zone_index', { ascending: true })
            .order('order_index', { ascending: true }),
          sb.from('schedules').select('*').eq('project_id', projectId).order('priority', { ascending: false }),
        ])

        if (projError) return NextResponse.json({ error: projError.message }, { status: 500 })

        let screen = null
        if (project.screen_id) {
          const { data } = await sb.from('screens').select('id, name, display_key, status, location_id, orientation, resolution').eq('id', project.screen_id).single()
          screen = data
        }

        return NextResponse.json({
          project,
          screen,
          playlist: (playlist || []).map(item => ({
            ...item,
            playlist_item_id: item.id,
            duration_override: item.duration_override || (item.content_item as any)?.duration_seconds || 10,
            transition_type: item.transition_type || project.settings?.transition_type || "fade",
            content_item: Array.isArray(item.content_item) ? item.content_item[0] : item.content_item,
            zone_index: item.zone_index || 0,
          })).filter(item => item.content_item),
          schedules: schedules || [],
          library: []
        })
      }

      // ── CONTENT LIBRARY ──────────────────────────────────
      case 'content-library': {
        const limit = parseInt(searchParams.get('limit') || '200')
        const { data } = await sb
          .from('content_items')
          .select('id, name, type, source_url, file_path, thumbnail_url, duration_seconds, created_at')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(limit)
        return NextResponse.json(data || [])
      }

      // ── SCREEN PROJECTS (Assigned Projects) ────────────────
      case 'screen-projects': {
        const screenId = searchParams.get('id')
        if (!screenId) return NextResponse.json({ error: 'Missing screen id' }, { status: 400 })

        const { data, error } = await sb
          .from('screen_projects')
          .select(`
            *,
            project:projects(
              id,
              name,
              settings,
              is_active,
              created_at
            )
          `)
          .eq('screen_id', screenId)
          .order('priority', { ascending: false })
          .order('sort_order', { ascending: true })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        if (data && data.length > 0) {
          const projectIds = data.map((sp: any) => sp.project_id)
          const { data: counts } = await sb
            .from('playlist_items')
            .select('project_id')
            .in('project_id', projectIds)

          const countMap: Record<string, number> = {}
          if (counts) {
            for (const item of counts) {
              countMap[item.project_id] = (countMap[item.project_id] || 0) + 1
            }
          }

          return NextResponse.json(data.map((sp: any) => ({
            ...sp,
            project: sp.project
              ? { ...sp.project, _playlist_count: countMap[sp.project_id] || 0 }
              : undefined,
          })))
        }

        return NextResponse.json(data || [])
      }

      // ── SCREEN DETAILS PAGE DATA ─────────────────────────
      case 'screen-details': {
        const screenId = searchParams.get('id')
        if (!screenId) return NextResponse.json({ error: 'Missing screen id' }, { status: 400 })

        const { data: screenData, error: screenError } = await sb
          .from('screens')
          .select('*, location:locations(id, name, timezone)')
          .eq('id', screenId)
          .single()

        if (screenError) return NextResponse.json({ error: screenError.message }, { status: 500 })

        const [{ data: locs }, { data: projs }, { data: lg }, { data: pe }] = await Promise.all([
          sb.from('locations').select('id, name').eq('organization_id', orgId).order('name'),
          sb.from('projects').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
          sb.from('screen_logs').select('*').eq('screen_id', screenId).order('created_at', { ascending: false }).limit(20),
          sb.from('push_events').select('*, created_by:profiles(full_name)').eq('screen_id', screenId).order('created_at', { ascending: false }).limit(10)
        ])

        let schedules = []
        if (projs && projs.length > 0) {
          const { data: scheds } = await sb
            .from('schedules')
            .select('*')
            .in('project_id', projs.map((p: any) => p.id))
            .eq('is_active', true)
          
          if (scheds) {
            schedules = scheds.map((s: any, idx: number) => ({
              ...s,
              project_name: projs.find((p: any) => p.id === s.project_id)?.name || 'Unknown',
              project_color: idx % 8
            }))
          }
        }

        return NextResponse.json({
          screen: screenData,
          locations: locs || [],
          projects: projs || [],
          logs: lg || [],
          pushEvents: pe || [],
          schedules,
          locationTz: screenData.location?.timezone || 'UTC'
        })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    console.error('[GET /api/dashboard]', action, err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
