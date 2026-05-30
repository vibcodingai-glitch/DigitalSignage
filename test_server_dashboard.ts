import { getServerDashboardData } from "./lib/services/dashboard-server";
import { createClient } from "@supabase/supabase-js";

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: profile } = await supabase.from('profiles').select('organization_id').limit(1).single();
    if (!profile) throw new Error("No profile");
    
    console.log("Org ID:", profile.organization_id);
    const data = await getServerDashboardData(profile.organization_id);
    console.log("Stats:", data.stats);
}

run().catch(console.error);
