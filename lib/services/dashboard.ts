import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

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
        const [{ data: screens }, { data: locations }, { data: projects }] = await Promise.all([
            supabase.from('screens').select('*').order('name'),
            supabase.from('locations').select('id, name'),
            supabase.from('projects').select('id, name')
        ]);

        const mappedScreens = (screens || []).map(s => ({
            ...s,
            location: locations?.find(l => l.id === s.location_id) || null,
            project: projects?.find(p => p.id === s.active_project_id) || null
        }));

        return {
            screens: mappedScreens,
            locations: locations || [],
            projects: projects || []
        };
    },

    async getLocations(): Promise<Location[]> {
        const [{ data: locations }, { data: screens }] = await Promise.all([
            supabase.from('locations').select('*').order('name'),
            supabase.from('screens').select('id, location_id')
        ]);

        return (locations || []).map(l => ({
            ...l,
            screen_count: (screens || []).filter(s => s.location_id === l.id).length
        }));
    },

    async getProjects(): Promise<Project[]> {
        const [
            { data: projects },
            { data: items },
            { data: schedules },
            { data: screens }
        ] = await Promise.all([
            supabase.from('projects').select('*').order('created_at', { ascending: false }),
            supabase.from('playlist_items').select('id, project_id, duration_override, content_item:content_items(duration_seconds)'),
            supabase.from('schedules').select('id, project_id'),
            supabase.from('screens').select('id, name')
        ]);

        return (projects || []).map(p => {
            const pItems = (items || []).filter(i => i.project_id === p.id);
            const pSchedules = (schedules || []).filter(s => s.project_id === p.id);
            const pScreen = (screens || []).find(s => s.id === p.screen_id);

            let totalDuration = 0;
            pItems.forEach((pi: any) => {
                totalDuration += (pi.duration_override || pi.content_item?.duration_seconds || 10);
            });

            return {
                ...p,
                numItems: pItems.length,
                totalDuration,
                numSchedules: pSchedules.length,
                screen: pScreen || null
            } as any;
        });
    },

    async getStats() {
        const [locationsCount, activeProjectsCount, itemsCount, screens] = await Promise.all([
            supabase.from('locations').select('*', { count: 'exact', head: true }),
            supabase.from('projects').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('content_items').select('*', { count: 'exact', head: true }),
            supabase.from('screens').select('status, active_project_id')
        ]);

        return {
            locations: locationsCount.count || 0,
            projects: activeProjectsCount.count || 0,
            contentItems: itemsCount.count || 0,
            screens: {
                total: (screens.data || []).length,
                online: (screens.data || []).filter(s => s.status === 'online').length,
                offline: (screens.data || []).filter(s => s.status === 'offline').length,
                unassigned: (screens.data || []).filter(s => !s.active_project_id).length,
            }
        };
    },

    async getRecentActivity() {
        const { data: activity } = await supabase.from('screen_logs')
            .select('id, event, created_at, details, screen_id')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (!activity || activity.length === 0) return [];

        const screenIds = Array.from(new Set(activity.map(a => a.screen_id).filter(Boolean)));
        const { data: screens } = await supabase.from('screens')
            .select('id, name')
            .in('id', screenIds);

        return activity.map(log => ({
            ...log,
            screen: screens?.find(s => s.id === log.screen_id) || null
        }));
    },

    async getProjectDetails(projectId: string) {
        const [
            { data: project, error: projError },
            { data: playlist, error: plError },
            { data: schedules, error: schedError },
            { data: library, error: libError }
        ] = await Promise.all([
            supabase.from('projects').select('*').eq('id', projectId).single(),
            supabase.from('playlist_items')
                .select('id, content_item_id, order_index, duration_override, transition_type, zone_index, content_item:content_items(*)')
                .eq('project_id', projectId)
                .order('zone_index', { ascending: true })
                .order('order_index', { ascending: true }),
            supabase.from('schedules').select('*').eq('project_id', projectId).order('priority', { ascending: false }),
            supabase.from('content_items').select('*').order('created_at', { ascending: false })
        ]);

        if (projError) throw projError;

        // Fetch screen separately if assigned
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
