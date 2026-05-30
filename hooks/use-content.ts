import { createClient } from "@/lib/supabase/client";
import useSWR from "swr";

export const useContent = () => {
    const { data, error, isLoading, mutate } = useSWR("dashboard-content", () => {
        const supabase = createClient();
        return supabase
            .from('content_items')
            .select('id, name, type, file_url, thumbnail_url, duration_seconds, created_at, organization_id')
            .order('created_at', { ascending: false })
            .limit(200)
            .then(r => r.data);
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
