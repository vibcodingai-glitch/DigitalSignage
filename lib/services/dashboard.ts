/**
 * Dashboard Service: Centralized data fetching via server-side API routes.
 *
 * All methods call /api/dashboard (server-side, service-role key)
 * instead of the browser Supabase client — eliminating auth token
 * refresh deadlocks that cause the entire dashboard to hang.
 */

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
 * Fetch from the server-side API with a hard timeout.
 * Returns parsed JSON or throws on failure.
 */
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', ...options?.headers },
        })
        if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.error || `API error ${res.status}`)
        }
        return res.json()
    } finally {
        clearTimeout(timeout)
    }
}

export const DashboardService = {
    async getScreens(_orgId: string): Promise<{ screens: Screen[], locations: any[], projects: any[] }> {
        return apiFetch('/api/dashboard?action=screens')
    },

    async getLocations(_orgId: string): Promise<Location[]> {
        return apiFetch('/api/dashboard?action=locations')
    },

    async getProjects(_orgId: string): Promise<Project[]> {
        return apiFetch('/api/dashboard?action=projects')
    },

    async getStats(_orgId: string) {
        return apiFetch('/api/dashboard?action=stats')
    },

    async getRecentActivity(_orgId: string) {
        return apiFetch('/api/dashboard?action=activity')
    },

    async getProjectDetails(projectId: string) {
        return apiFetch(`/api/dashboard?action=project-details&id=${projectId}`)
    },

    async getContentLibrary(_orgId: string, limit = 200) {
        return apiFetch(`/api/dashboard?action=content-library&limit=${limit}`)
    }
};
