/**
 * Monitoring — Server Component
 * 
 * PERF: Fetches monitoring data server-side to eliminate client-side waterfall
 * and bypass RLS table scans.
 */

import { getServerMonitoringData, getServerUserProfile } from "@/lib/services/dashboard-server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import MonitoringClient from "@/components/dashboard/MonitoringClient"

export const dynamic = 'force-dynamic'

export default async function MonitoringPage() {
    const supabase = createClient()

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) redirect('/login')

    const profile = await getServerUserProfile(user.id)
    if (!profile?.organization_id) {
        return (
            <div className="flex h-full items-center justify-center">
                <p>No organization found. Please contact support.</p>
            </div>
        )
    }

    // Fetch monitoring data server-side
    const fallbackData = await getServerMonitoringData(profile.organization_id)

    return (
        <MonitoringClient fallbackData={fallbackData} />
    )
}
