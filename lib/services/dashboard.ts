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
    organization_id: string;
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
    screen_id?: string | null;
    numItems?: number;
    totalDuration?: number;
    numSchedules?: number;
    screen?: { id: string; name: string } | null;
}

/**
 * Dashboard Service: Centralized, optimized data fetching logic.
 * Bypasses RLS Join recursion by using flat fetches and in-memory joins.
 */
export const DashboardService = {
    async getScreens(orgId: string): Promise<{ screens: Screen[], locations: any[], projects: any[] }> {
        const supabase = getClient();
        const [{ data: screens }, { data: locations }, { data: projects }] = await Promise.all([
            supabase.from('screens').select('id, name, status, display_key, location_id, active_project_id, last_heartbeat, orientation, resolution, current_state').eq('organization_id', orgId).order('name'),
            supabase.from('locations').select('id, name').eq('organization_id', orgId),
            supabase.from('projects').select('id, name').eq('organization_id', orgId)
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

    async getLocations(orgId: string): Promise<Location[]> {
        const supabase = getClient();
        const [{ data: locations }, { data: screens }] = await Promise.all([
            supabase.from('locations').select('*').eq('organization_id', orgId).order('name'),
            supabase.from('screens').select('id, location_id').eq('organization_id', orgId)
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

    async getProjects(orgId: string): Promise<Project[]> {
        const supabase = getClient();
        // PERF: Fetch projects first, then strictly filter playlist items by project IDs.
        // Failing to do this forces Postgres to run the RLS policy on EVERY row in the playlist_items table across all tenants.
        const { data: projects } = await supabase
            .from('projects')
            .select('id, name, is_active, screen_id, settings, created_at, organization_id')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false });

        const projectIds = (projects || []).map(p => p.id);

        const [
            { data: items },
            { data: screens },
        ] = await Promise.all([
            projectIds.length > 0 
                ? supabase.from('playlist_items').select('project_id, duration_override').in('project_id', projectIds)
                : Promise.resolve({ data: [] }),
            supabase.from('screens').select('id, name').eq('organization_id', orgId),
        ]);

        // Single-pass grouping by project_id
        const countByProject = new Map<string, { count: number; totalDuration: number }>()
        for (const i of items || []) {
            const entry = countByProject.get(i.project_id)
            if (entry) {
                entry.count++
                entry.totalDuration += (i.duration_override || 10)
            } else {
                countByProject.set(i.project_id, { count: 1, totalDuration: i.duration_override || 10 })
            }
        }
        const screenMap = new Map((screens || []).map(s => [s.id, s]))

        return (projects || []).map(p => {
            const stats = countByProject.get(p.id) || { count: 0, totalDuration: 0 };
            const pScreen = screenMap.get(p.screen_id) || null;

            return {
                ...p,
                numItems: stats.count,
                totalDuration: stats.totalDuration,
                numSchedules: 0,
                screen: pScreen
            } as any;
        });
    },

    async getStats(orgId: string) {
        const supabase = getClient();
        const [locationsCount, activeProjectsCount, itemsCount, screens] = await Promise.all([
            supabase.from('locations').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
            supabase.from('projects').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('organization_id', orgId),
            supabase.from('content_items').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
            supabase.from('screens').select('status, active_project_id').eq('organization_id', orgId)
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

    async getRecentActivity(orgId: string) {
        const supabase = getClient();
        const { data: activity } = await supabase.from('screen_logs')
            .select('id, event, created_at, details, screen_id, screens!inner(organization_id)')
            .eq('screens.organization_id', orgId)
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
        // PERF: Fetch project + playlist + schedules in parallel.
        // Content library is NOT eagerly loaded — it's fetched on-demand
        // when the user opens the content picker.
        const [
            { data: project, error: projError },
            { data: playlist },
            { data: schedules },
        ] = await Promise.all([
            supabase.from('projects').select('*').eq('id', projectId).single(),
            supabase.from('playlist_items')
                .select('id, content_item_id, order_index, duration_override, transition_type, zone_index, valid_from, valid_until, day_part_start, day_part_end, show_qr_code, qr_code_url, content_item:content_items(id, name, type, source_url, file_path, thumbnail_url, duration_seconds, metadata)')
                .eq('project_id', projectId)
                .order('zone_index', { ascending: true })
                .order('order_index', { ascending: true }),
            supabase.from('schedules').select('*').eq('project_id', projectId).order('priority', { ascending: false }),
        ]);

        if (projError) throw projError;

        // Fetch screen in parallel only if needed
        let screen = null;
        if (project.screen_id) {
            const { data } = await supabase.from('screens').select('id, name, display_key, status, location_id, orientation, resolution').eq('id', project.screen_id).single();
            screen = data;
        }

        return {
            project,
            screen,
            playlist: (playlist || []).filter(item => item.content_item).map(item => ({
                ...item,
                playlist_item_id: item.id,
                duration_override: item.duration_override || (item.content_item as any)?.duration_seconds || 10,
                transition_type: item.transition_type || project.settings?.transition_type || "fade",
                content_item: Array.isArray(item.content_item) ? item.content_item[0] : item.content_item,
                zone_index: item.zone_index || 0,
                valid_from: item.valid_from,
                valid_until: item.valid_until,
                day_part_start: item.day_part_start,
                day_part_end: item.day_part_end,
                show_qr_code: item.show_qr_code,
                qr_code_url: item.qr_code_url
            })),
            schedules: schedules || [],
            library: []  // Loaded on-demand via getContentLibrary()
        };
    },

    /**
     * Fetches the content library on-demand (called when user opens content picker).
     * Separated from getProjectDetails to avoid loading 500 items on every page view.
     */
    async getContentLibrary(orgId: string, limit = 200) {
        const supabase = getClient();
        const { data } = await supabase
            .from('content_items')
            .select('id, name, type, source_url, file_path, thumbnail_url, duration_seconds, created_at')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(limit);
        return data || [];
    }
};
