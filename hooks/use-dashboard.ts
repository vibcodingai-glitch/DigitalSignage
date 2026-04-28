import { useState, useCallback, useEffect } from "react";
import { DashboardService, Screen, Location, Project } from "@/lib/services/dashboard";
import { useToast } from "@/hooks/use-toast";

export function useDashboardData<T>(fetchFn: () => Promise<T>, deps: any[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { toast } = useToast();

    const load = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const result = await fetchFn();
            setData(result);
            setError(null);
        } catch (err) {
            console.error("Dashboard Data Fetch Error:", err);
            setError(err as Error);
            toast({
                title: "Data Sync Failed",
                description: "We're having trouble connecting to the database. Retrying...",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast, ...deps]);

    useEffect(() => {
        load();
    }, [load]);

    return { data, isLoading, error, refresh: () => load(true) };
}

export const useScreens = () => useDashboardData(DashboardService.getScreens);
export const useLocations = () => useDashboardData(DashboardService.getLocations);
export const useProjects = () => useDashboardData(DashboardService.getProjects);
export const useOverview = () => useDashboardData(() => DashboardService.getOverview());
export const useProjectDetails = (projectId: string) => useDashboardData(() => DashboardService.getProjectDetails(projectId), [projectId]);
