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

    const [
        { data: screens },
        { data: locations },
        { data: projects },
        locationsCount,
        activeProjectsCount,
        itemsCount,
        { data: activity },
        { data: fullProjects },
        { data: playlistItems },
    ] = await Promise.all([
        supabase
            .from('screens')
            .select('id, name, status, display_key, location_id, active_project_id, last_heartbeat, orientation, resolution, current_state')
            .eq('organization_id', organizationId)
            .order('name'),
        supabase
            .from('locations')
            .select('id, name')
            .eq('organization_id', organizationId),
        supabase
            .from('projects')
            .select('id, name')
            .eq('organization_id', organizationId),
        supabase
            .from('locations')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId),
        supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('is_active', true),
        supabase
            .from('content_items')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId),
        supabase
            .from('screen_logs')
            .select('id, event, created_at, details, screen_id')
            .order('created_at', { ascending: false })
            .limit(10),
        supabase
            .from('projects')
            .select('id, name, is_active, screen_id, settings, created_at, organization_id')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false }),
        supabase
            .from('playlist_items')
            // Using a raw query or joining. For now, fetch all items for this org's projects.
            // Wait, we need to do this efficiently. Let's just select the fields.
            .select('project_id, duration_override, projects!inner(organization_id)')
            .eq('projects.organization_id', organizationId),
    ])

    // Build lookup maps
    const locationMap = new Map((locations || []).map(l => [l.id, l]))
    const projectMap = new Map((projects || []).map(p => [p.id, p]))

    // Map screens with joined location/project names
    const mappedScreens: ServerScreen[] = (screens || []).map(s => ({
        ...s,
        location: locationMap.get(s.location_id) || null,
        project: projectMap.get(s.active_project_id) || null,
    }))

    // Compute screen stats in a single pass
    const screenStats = (screens || []).reduce(
        (acc, s) => {
            acc.total++
            if (s.status === 'online') acc.online++
            else acc.offline++
            if (!s.active_project_id) acc.unassigned++
            return acc
        },
        { total: 0, online: 0, offline: 0, unassigned: 0 }
    )

    // Map projects precisely as the client expects (with numItems, totalDuration, screen)
    const countByProject = new Map<string, { count: number; totalDuration: number }>()
    for (const i of (playlistItems as any[]) || []) {
        const entry = countByProject.get(i.project_id)
        if (entry) {
            entry.count++
            entry.totalDuration += (i.duration_override || 10)
        } else {
            countByProject.set(i.project_id, { count: 1, totalDuration: i.duration_override || 10 })
        }
    }
    const screenMap = new Map(((screens as any[]) || []).map(s => [s.id, s]))
    
    const mappedProjects = ((fullProjects as any[]) || []).map(p => {
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

    // Resolve screen names for activity feed
    const screenIds = Array.from(new Set(((activity as any[]) || []).map(a => a.screen_id).filter(Boolean)))
    let activityScreenMap = new Map<string, { name: string }>()
    if (screenIds.length > 0) {
        const { data: actScreens } = await supabase
            .from('screens')
            .select('id, name')
            .in('id', screenIds)
        activityScreenMap = new Map(((actScreens as any[]) || []).map(s => [s.id, s]))
    }

    const mappedActivity = ((activity as any[]) || []).map(log => ({
        ...log,
        screen: activityScreenMap.get(log.screen_id) || null,
    }))

    return {
        screens: mappedScreens,
        locations: locations || [],
        projects: mappedProjects,
        stats: {
            locations: locationsCount.count || 0,
            projects: activeProjectsCount.count || 0,
            contentItems: itemsCount.count || 0,
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
