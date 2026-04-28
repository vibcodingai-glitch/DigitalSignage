import useSWR from "swr";
import { DashboardService } from "@/lib/services/dashboard";

/**
 * Agile Data Hook: Uses SWR for caching and background revalidation.
 * Makes the dashboard feel "instant" by showing stale data while updating.
 */
function useDashboardData<T>(key: string, fetchFn: () => Promise<T>) {
    const { data, error, isLoading, mutate } = useSWR(key, fetchFn, {
        revalidateOnFocus: false,
        dedupingInterval: 5000, // 5 seconds
    });

    return {
        data: data || null,
        isLoading: isLoading && !data, // Only show loading if we have no cached data
        error,
        refresh: () => mutate()
    };
}

export const useScreens = () => useDashboardData("dashboard-screens", DashboardService.getScreens);
export const useLocations = () => useDashboardData("dashboard-locations", DashboardService.getLocations);
export const useProjects = () => useDashboardData("dashboard-projects", DashboardService.getProjects);
export const useOverview = () => useDashboardData("dashboard-overview", () => DashboardService.getOverview());
export const useProjectDetails = (projectId: string) => 
    useDashboardData(`project-details-${projectId}`, () => DashboardService.getProjectDetails(projectId));
