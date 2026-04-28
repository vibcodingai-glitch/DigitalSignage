import { createClient } from "@/lib/supabase/client";
import useSWR from "swr";

const supabase = createClient();

export const useContent = () => {
    const { data, error, isLoading, mutate } = useSWR("dashboard-content", () => 
        supabase.from('content_items').select('*').order('created_at', { ascending: false }).then(r => r.data)
    );

    return {
        data: data || [],
        isLoading: isLoading && !data,
        error,
        refresh: () => mutate()
    };
};
