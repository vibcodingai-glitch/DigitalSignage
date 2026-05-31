import { createClient } from "@/lib/supabase/client";
import useSWR from "swr";
import { useUser } from "./use-user";

export const useContent = () => {
    const { profile } = useUser();
    
    const { data, error, isLoading, mutate } = useSWR(
        profile?.organization_id ? `dashboard-content-${profile.organization_id}` : null, 
        () => {
        const supabase = createClient();
        return supabase
            .from('content_items')
            .select('id, name, type, thumbnail_url, duration_seconds, created_at, organization_id, source_url, file_path, metadata')
            .eq('organization_id', profile!.organization_id)
            .order('created_at', { ascending: false })
            .limit(1000)
            .then(r => r.data as any);
    }, {
        revalidateOnFocus: false,
        dedupingInterval: 30_000,
        keepPreviousData: true,
    });

    return {
        data: data || [],
        isLoading: isLoading && !data,
        error,
        refresh: () => mutate()
    };
};
