import { createClient } from "@/lib/supabase/client";

function getClient() { return createClient() }

export interface Screen {
    id: string;
    name: string;
    status: string;
    display_key: string;
    location_id: string | null;
    active_project_id: string | null;
    last_heartbeat: string | null;
    orientation: string;
    resolution: string;
    location?: { id: string, name: string } | null;
    project?: { id: string, name: string } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current_state?: any;
}

export interface Location {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    country: string | null;
    timezone: string | null;
    created_at: string;
    screen_count: number;
}

export interface Project {
    id: string;
    name: string;
    is_active: boolean;
    created_at: string;
    item_count: number;
}

/**
 * Dashboard Service: Centralized, optimized data fetching logic.
 * Bypasses RLS Join recursion by using flat fetches and in-memory joins.
 */
export const DashboardService = {
    async getScreens(): Promise<{ screens: Screen[], locations: any[], projects: any[] }> {
        const supabase = getClient();
        const [{ data: screens }, { data: locations }, { data: projects }] = await Promise.all([
            supabase.from('screens').select('*').order('name'),
            supabase.from('locations').select('id, name'),
            supabase.from('projects').select('id, name')
        ]);

        const locationMap = new Map(locations?.map(l => [l.id, l]))
        const projectMap = new Map(projects?.map(p => [p.id, p]))
        const mappedScreens = (screens || []).map(s => ({
            ...s,
            location: locationMap.get(s.location_id) || null,
            project: projectMap.get(s.active_project_id) || null,
        }));

        return {
            screens: mappedScreens,
            locations: locations || [],
            projects: projects || []
        };
    },

    async getLocations(): Promise<Location[]> {
        const supabase = getClient();
        const [{ data: locations }, { data: screens }] = await Promise.all([
            supabase.from('locations').select('*').order('name'),
            supabase.from('screens').select('id, location_id')
        ]);

        const screensByLocation = new Map<string, number>()
        for (const s of screens || []) {
            if (s.location_id) screensByLocation.set(s.location_id, (screensByLocation.get(s.location_id) || 0) + 1)
        }
        return (locations || []).map(l => ({
            ...l,
            screen_count: screensByLocation.get(l.id) || 0
        }));
    },

    async getProjects(): Promise<Project[]> {
        const supabase = getClient();
        // Two fast flat queries — no nested joins, no full table scans.
        const [
            { data: projects },
            { data: items },
            { data: screens },
        ] = await Promise.all([
            supabase.from('projects').select('id, name, is_active, screen_id, settings, created_at, organization_id').order('created_at', { ascending: false }),
            // Only fetch the columns we need for counting and duration — no content join.
            supabase.from('playlist_items').select('id, project_id, duration_override, zone_index'),
            // Fetch screens in the same batch (already in cache from getScreens most of the time)
            supabase.from('screens').select('id, name'),
        ]);

        const itemsByProject = new Map<string, typeof items>()
        for (const i of items || []) {
            if (!itemsByProject.has(i.project_id)) itemsByProject.set(i.project_id, [])
            itemsByProject.get(i.project_id)!.push(i)
        }
        const screenMap = new Map((screens || []).map(s => [s.id, s]))

        return (projects || []).map(p => {
            const pItems = itemsByProject.get(p.id) || [];
            const pScreen = screenMap.get(p.screen_id) || null;

            // Use duration_override for total, default to 10 s per item.
            const totalDuration = pItems.reduce((acc, pi) => acc + (pi.duration_override || 10), 0);

            return {
                ...p,
                numItems: pItems.length,
                totalDuration,
                numSchedules: 0,   // Not needed on the list page; avoids a 3rd query
                screen: pScreen
            } as any;
        });
    },

    async getStats() {
        const supabase = getClient();
        const [locationsCount, activeProjectsCount, itemsCount, screens] = await Promise.all([
            supabase.from('locations').select('*', { count: 'exact', head: true }),
            supabase.from('projects').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('content_items').select('*', { count: 'exact', head: true }),
            supabase.from('screens').select('status, active_project_id')
        ]);

        const screenCounts = (screens.data || []).reduce((acc, s) => {
            acc.total++
            if (s.status === 'online') acc.online++
            else acc.offline++
            if (!s.active_project_id) acc.unassigned++
            return acc
        }, { total: 0, online: 0, offline: 0, unassigned: 0 })

        return {
            locations: locationsCount.count || 0,
            projects: activeProjectsCount.count || 0,
            contentItems: itemsCount.count || 0,
            screens: screenCounts
        };
    },

    async getRecentActivity() {
        const supabase = getClient();
        const { data: activity } = await supabase.from('screen_logs')
            .select('id, event, created_at, details, screen_id')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (!activity || activity.length === 0) return [];

        const screenIds = Array.from(new Set(activity.map(a => a.screen_id).filter(Boolean)));
        const { data: screens } = await supabase.from('screens')
            .select('id, name')
            .in('id', screenIds);

        const screenMap = new Map((screens || []).map(s => [s.id, s]))
        return activity.map(log => ({
            ...log,
            screen: screenMap.get(log.screen_id) || null
        }));
    },

    async getProjectDetails(projectId: string) {
        const supabase = getClient();
        const [
            { data: project, error: projError },
            { data: playlist, error: plError },
            { data: schedules, error: schedError },
            { data: library, error: libError },
        ] = await Promise.all([
            supabase.from('projects').select('*').eq('id', projectId).single(),
            supabase.from('playlist_items')
                .select('id, content_item_id, order_index, duration_override, transition_type, zone_index, content_item:content_items(*)')
                .eq('project_id', projectId)
                .order('zone_index', { ascending: true })
                .order('order_index', { ascending: true }),
            supabase.from('schedules').select('*').eq('project_id', projectId).order('priority', { ascending: false }),
            supabase.from('content_items')
                .select('id, name, type, file_url, thumbnail_url, duration_seconds, created_at')
                .order('created_at', { ascending: false })
                .limit(500),
        ]);

        if (projError) throw projError;

        // Fetch screen in parallel (moved out of sequential await)
        let screen = null;
        if (project.screen_id) {
            const { data } = await supabase.from('screens').select('*').eq('id', project.screen_id).single();
            screen = data;
        }

        return {
            project,
            screen,
            playlist: (playlist || []).map(item => ({
                ...item,
                playlist_item_id: item.id,
                duration_override: item.duration_override || (item.content_item as any)?.duration_seconds || 10,
                transition_type: item.transition_type || project.settings?.transition_type || "fade",
                content_item: Array.isArray(item.content_item) ? item.content_item[0] : item.content_item,
                zone_index: item.zone_index || 0
            })),
            schedules: schedules || [],
            library: library || []
        };
    }
};
