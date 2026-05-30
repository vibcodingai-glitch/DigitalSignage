import useSWR from "swr";
import { useCallback } from "react";
import { DashboardService } from "@/lib/services/dashboard";
import { useUser } from "./use-user";

/**
 * Core SWR wrapper with tiered caching strategies.
 *
 * - `dedupingInterval`: prevents duplicate fetches within the window.
 * - `revalidateOnFocus`: disabled globally — signage dashboards don't need
 *    fresh data every time the tab is re-focused.
 * - `revalidateOnReconnect`: re-fetch when the network comes back online.
 * - `isLoading`: only true when there is NO cached data AND a fetch is in flight.
 *    This means the skeleton only shows on the very first load; subsequent
 *    navigations show stale data instantly while revalidating in the background.
 */
function useDashboardData<T>(
    key: string | null,
    fetchFn: () => Promise<T>,
    options?: { dedupingInterval?: number }
) {
    const { data, error, isLoading, mutate } = useSWR(key, fetchFn, {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        // Default: 60 s — most dashboard data is not realtime-critical.
        // Callers can pass a shorter interval for more volatile data.
        dedupingInterval: options?.dedupingInterval ?? 60_000,
        // Keep stale data while revalidating so the UI never blanks out.
        keepPreviousData: true,
    });

    // Stable reference — mutate from SWR is stable so this never changes
    const refresh = useCallback(() => mutate(), [mutate]);

    return {
        data: data ?? null,
        // Only show the loading state when there is truly nothing to show.
        isLoading: isLoading && !data,
        error,
        refresh,
    };
}

// ─────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────

/**
 * Fetches screens, locations and projects metadata in a single parallelised
 * request. All derived hooks share this same SWR cache entry so there is
 * never more than ONE in-flight network request for this data.
 */
export const useScreensMetadata = () => {
    const { profile } = useUser();
    return useDashboardData(
        profile?.organization_id ? `screens-metadata-${profile.organization_id}` : null,
        () => DashboardService.getScreens(profile!.organization_id),
        { dedupingInterval: 30_000 }
    );
};

/** Derives the screens array from the shared `useScreensMetadata` cache. */
export const useScreens = () => {
    const { data, ...rest } = useScreensMetadata();
    return { ...rest, data: data?.screens ?? null };
};

/** Locations are slow-moving data — cache for 2 minutes. */
export const useLocations = () => {
    const { profile } = useUser();
    return useDashboardData(
        profile?.organization_id ? `dashboard-locations-${profile.organization_id}` : null,
        () => DashboardService.getLocations(profile!.organization_id),
        { dedupingInterval: 120_000 }
    );
};

/** Projects list — cache for 30 s so the table stays responsive. */
export const useProjects = () => {
    const { profile } = useUser();
    return useDashboardData(
        profile?.organization_id ? `dashboard-projects-${profile.organization_id}` : null,
        () => DashboardService.getProjects(profile!.organization_id),
        { dedupingInterval: 30_000 }
    );
};

/** Stats counters — 30 s is fine, they're not real-time. */
export const useStats = () => {
    const { profile } = useUser();
    return useDashboardData(
        profile?.organization_id ? `dashboard-stats-${profile.organization_id}` : null,
        () => DashboardService.getStats(profile!.organization_id),
        { dedupingInterval: 30_000 }
    );
};

/** Activity feed — keep fresher (15 s) because it reflects live events. */
export const useRecentActivity = () => {
    const { profile } = useUser();
    return useDashboardData(
        profile?.organization_id ? `dashboard-activity-${profile.organization_id}` : null,
        () => DashboardService.getRecentActivity(profile!.organization_id),
        { dedupingInterval: 15_000 }
    );
};

/** Per-project editor data — keyed by project ID so each editor has its own cache. */
export const useProjectDetails = (projectId: string) =>
    useDashboardData(
        `project-details-${projectId}`,
        () => DashboardService.getProjectDetails(projectId),
        { dedupingInterval: 10_000 }
    );
