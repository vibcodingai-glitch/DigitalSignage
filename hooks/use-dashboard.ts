import useSWR from "swr";
import { DashboardService } from "@/lib/services/dashboard";

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
    key: string,
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

    return {
        data: data ?? null,
        // Only show the loading state when there is truly nothing to show.
        isLoading: isLoading && !data,
        error,
        refresh: () => mutate(),
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
export const useScreensMetadata = () =>
    useDashboardData("screens-metadata", DashboardService.getScreens, {
        // Screens change infrequently — 30 s deduplication is fine.
        dedupingInterval: 30_000,
    });

/** Derives the screens array from the shared `useScreensMetadata` cache. */
export const useScreens = () => {
    const { data, ...rest } = useScreensMetadata();
    return { ...rest, data: data?.screens ?? null };
};

/** Locations are slow-moving data — cache for 2 minutes. */
export const useLocations = () =>
    useDashboardData("dashboard-locations", DashboardService.getLocations, {
        dedupingInterval: 120_000,
    });

/** Projects list — cache for 30 s so the table stays responsive. */
export const useProjects = () =>
    useDashboardData("dashboard-projects", DashboardService.getProjects, {
        dedupingInterval: 30_000,
    });

/** Stats counters — 30 s is fine, they're not real-time. */
export const useStats = () =>
    useDashboardData("dashboard-stats", () => DashboardService.getStats(), {
        dedupingInterval: 30_000,
    });

/** Activity feed — keep fresher (15 s) because it reflects live events. */
export const useRecentActivity = () =>
    useDashboardData(
        "dashboard-activity",
        () => DashboardService.getRecentActivity(),
        { dedupingInterval: 15_000 }
    );

/** Per-project editor data — keyed by project ID so each editor has its own cache. */
export const useProjectDetails = (projectId: string) =>
    useDashboardData(
        `project-details-${projectId}`,
        () => DashboardService.getProjectDetails(projectId),
        { dedupingInterval: 10_000 }
    );
