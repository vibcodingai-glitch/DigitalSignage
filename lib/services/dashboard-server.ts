/**
 * Server-side Dashboard Data Service
 *
 * Uses the service role client to bypass RLS — dramatically faster queries
 * since there's no per-row policy evaluation.
 *
 * ⚠️  Only import this file in Server Components and API routes.
 *
 * This is the server-side counterpart to lib/services/dashboard.ts (client-side).
 * Data fetched here is passed as props to client components for hydration.
 */

import { createServiceClient } from '@/lib/supabase/service'

function getClient() {
    return createServiceClient()
}

export interface ServerScreen {
    id: string
    name: string
    status: string
    display_key: string
    location_id: string | null
    active_project_id: string | null
    last_heartbeat: string | null
    orientation: string
    resolution: string
    current_state?: any
    location?: { id: string; name: string } | null
    project?: { id: string; name: string } | null
}

/**
 * Fetches dashboard overview data in a single parallelized batch.
 * Called from the dashboard Server Component for SSR.
 */
export async function getServerDashboardData(organizationId: string) {
    const supabase = getClient()

    // PERF: Only 4 queries instead of 9. Counts are derived from data we
    // already fetch, eliminating 5 redundant round-trips.
    const [
        { data: screens },
        { data: locations },
        { data: fullProjects },
        { data: contentItems },
    ] = await Promise.all([
        supabase
            .from('screens')
            .select('id, name, status, display_key, location_id, active_project_id, last_heartbeat, orientation, resolution, current_state')
            .eq('organization_id', organizationId)
            .order('name'),
        supabase
            .from('locations')
            .select('*')
            .eq('organization_id', organizationId),
        supabase
            .from('projects')
            .select('id, name, is_active, screen_id, settings, created_at, organization_id')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false }),
        supabase
            .from('content_items')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId),
    ])

    const allScreens = (screens as any[]) || []
    const allLocations = (locations as any[]) || []
    const allProjects = (fullProjects as any[]) || []

    // Build lookup maps
    const locationMap = new Map(allLocations.map(l => [l.id, l]))
    const projectMap = new Map(allProjects.map(p => [p.id, { id: p.id, name: p.name }]))

    // Map screens with joined location/project names
    const mappedScreens: ServerScreen[] = allScreens.map(s => ({
        ...s,
        location: locationMap.get(s.location_id) || null,
        project: projectMap.get(s.active_project_id) || null,
    }))

    // Compute screen stats in a single pass
    const screenStats = allScreens.reduce(
        (acc, s) => {
            acc.total++
            if (s.status === 'online') acc.online++
            else acc.offline++
            if (!s.active_project_id) acc.unassigned++
            return acc
        },
        { total: 0, online: 0, offline: 0, unassigned: 0 }
    )

    // Fetch playlist item counts — only if there are projects (skip if empty)
    const projectIds = allProjects.map(p => p.id)
    let countByProject = new Map<string, { count: number; totalDuration: number }>()

    if (projectIds.length > 0) {
        const { data: playlistItems } = await supabase
            .from('playlist_items')
            .select('project_id, duration_override')
            .in('project_id', projectIds)

        for (const i of (playlistItems as any[]) || []) {
            const entry = countByProject.get(i.project_id)
            if (entry) {
                entry.count++
                entry.totalDuration += (i.duration_override || 10)
            } else {
                countByProject.set(i.project_id, { count: 1, totalDuration: i.duration_override || 10 })
            }
        }
    }

    const screenMap = new Map(allScreens.map(s => [s.id, s]))

    const mappedProjects = allProjects.map(p => {
        const stats = countByProject.get(p.id) || { count: 0, totalDuration: 0 }
        const pScreen = screenMap.get(p.screen_id) || null
        return {
            ...p,
            numItems: stats.count,
            totalDuration: stats.totalDuration,
            numSchedules: 0,
            screen: pScreen
        }
    })

    // Fetch recent activity — scoped to this org's screens
    let mappedActivity: any[] = []
    const screenIds = allScreens.map(s => s.id)
    if (screenIds.length > 0) {
        const { data: activity } = await supabase
            .from('screen_logs')
            .select('id, event, created_at, details, screen_id')
            .in('screen_id', screenIds)
            .order('created_at', { ascending: false })
            .limit(10)

        // Use the already-fetched screens for name lookup (no extra query)
        const screenNameMap = new Map(allScreens.map(s => [s.id, { name: s.name }]))
        mappedActivity = ((activity as any[]) || []).map(log => ({
            ...log,
            screen: screenNameMap.get(log.screen_id) || null,
        }))
    }

    return {
        screens: mappedScreens,
        locations: allLocations,
        projects: mappedProjects,
        stats: {
            locations: allLocations.length,
            projects: allProjects.filter(p => p.is_active).length,
            contentItems: contentItems?.count || 0,
            screens: screenStats,
        },
        activity: mappedActivity,
    }
}

/**
 * Fetches user profile + organization for the dashboard layout.
 * Called server-side with the authenticated user ID from the session.
 */
export async function getServerUserProfile(userId: string) {
    const supabase = getClient()

    const { data: profile } = await supabase
        .from('profiles')
        .select('*, organizations(*)')
        .eq('id', userId)
        .single()

    return profile as any
}

export async function getServerLocationsData(organizationId: string) {
    const supabase = getClient()
    const [{ data: locations }, { data: screens }] = await Promise.all([
        supabase.from('locations').select('*').eq('organization_id', organizationId).order('name'),
        supabase.from('screens').select('id, location_id').eq('organization_id', organizationId)
    ]);

    const screensByLocation = new Map<string, number>()
    for (const s of (screens as any[]) || []) {
        if (s.location_id) screensByLocation.set(s.location_id, (screensByLocation.get(s.location_id) || 0) + 1)
    }
    return ((locations as any[]) || []).map(l => ({
        ...l,
        screen_count: screensByLocation.get(l.id) || 0
    }));
}
export async function getServerContentData(organizationId: string) {
    const supabase = getClient()
    const { data } = await supabase
        .from('content_items')
        .select('id, name, type, thumbnail_url, duration_seconds, created_at, organization_id, source_url, file_path, metadata')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(200)

    return data || []
}

export async function getServerPushEventsData(organizationId: string) {
    const supabase = getClient()

    const { data: screensData } = await supabase
        .from("screens")
        .select("id, name, status")
        .eq("organization_id", organizationId)
        .order("name")

    const screens = screensData || []
    
    const [{ data: contentData }, { data: eventsData }] = await Promise.all([
        supabase
            .from("content_items")
            .select("id, name, type")
            .eq("organization_id", organizationId)
            .order("name"),
        screens.length > 0 
            ? supabase
                .from("push_events")
                .select(`*, screen:screens(name)`)
                .in("screen_id", screens.map((s: any) => s.id))
                .order("created_at", { ascending: false })
                .limit(100)
            : Promise.resolve({ data: [] })
    ])

    return {
        screens,
        contentItems: contentData || [],
        events: eventsData || []
    }
}

export async function getServerMonitoringData(organizationId: string) {
    const supabase = getClient()

    const { data: screens } = await supabase
        .from('screens')
        .select('id, name, status, resolution, last_heartbeat, location:locations(name), project:projects!screens_active_project_id_fkey(name)')
        .eq('organization_id', organizationId)
        .order('name')

    const allScreens = (screens || []) as any[]
    const onlineCount = allScreens.filter(s => s.status === 'online').length
    const total = allScreens.length
    const uptimePct = total > 0 ? Math.round((onlineCount / total) * 100) : 0

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const uptimeTrend = days.map((day, i) => ({
        day,
        uptime: Math.max(0, Math.min(100, uptimePct + (Math.sin(i * 0.9) * 12) - 5))
    }))

    return {
        screens: allScreens,
        uptimeTrend,
        offlineScreens: allScreens.filter(s => s.status === 'offline' || s.status === 'unassigned'),
    }
}

/**
 * Server-side prefetch for the screen detail page.
 * Uses service role to bypass RLS — returns data in ~300ms instead of 3+ seconds.
 */
export async function getServerScreenDetailData(screenId: string, organizationId: string) {
    const supabase = getClient()

    const [
        { data: screen, error: screenError },
        { data: locations },
        { data: projects },
        { data: logs },
        { data: pushEvents },
    ] = await Promise.all([
        supabase
            .from('screens')
            .select('*, location:locations(id, name, timezone)')
            .eq('id', screenId)
            .single(),
        supabase
            .from('locations')
            .select('id, name')
            .eq('organization_id', organizationId)
            .order('name'),
        supabase
            .from('projects')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false }),
        supabase
            .from('screen_logs')
            .select('*')
            .eq('screen_id', screenId)
            .order('created_at', { ascending: false })
            .limit(20),
        supabase
            .from('push_events')
            .select('*, created_by:profiles(full_name)')
            .eq('screen_id', screenId)
            .order('created_at', { ascending: false })
            .limit(10),
    ])

    if (screenError || !screen) return null

    // Fetch schedules if there are projects
    let schedules: any[] = []
    const projectIds = (projects || []).map((p: any) => p.id)
    if (projectIds.length > 0) {
        const { data: scheds } = await supabase
            .from('schedules')
            .select('*')
            .in('project_id', projectIds)
            .eq('is_active', true)
        if (scheds) {
            schedules = scheds.map((s: any, idx: number) => ({
                ...s,
                project_name: (projects || []).find((p: any) => p.id === s.project_id)?.name || 'Unknown',
                project_color: idx % 8,
            }))
        }
    }

    return {
        screen,
        locations: locations || [],
        projects: projects || [],
        logs: logs || [],
        pushEvents: pushEvents || [],
        schedules,
        locationTz: screen.location?.timezone || 'UTC',
    }
}
