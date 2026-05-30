/**
 * Dashboard Overview — Server Component
 * 
 * PERF: Fetches all dashboard widgets data in a single parallelized server-side request.
 * The data is passed to SWRConfig as fallback data, meaning the client renders
 * instantly with HTML without waiting for SWR hooks to fetch.
 */

import { getServerDashboardData, getServerUserProfile } from "@/lib/services/dashboard-server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import OverviewClient from "@/components/dashboard/OverviewClient"

export const dynamic = 'force-dynamic' // Ensure fresh data on reload

export default async function DashboardPage() {
    const supabase = createClient()

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) redirect('/login')

    const profile = await getServerUserProfile(user.id)
    if (!profile?.organization_id) {
        // If they don't have an organization, they shouldn't be here
        return (
            <div className="flex h-full items-center justify-center">
                <p>No organization found. Please contact support.</p>
            </div>
        )
    }

    // Fetch all dashboard data server-side
    const dashboardData = await getServerDashboardData(profile.organization_id)

    // Provide initial fallback data for SWR hooks so they don't fetch on initial mount
    const fallback = {
        'dashboard-stats': dashboardData.stats,
        'screens-metadata': {
            screens: dashboardData.screens,
            locations: [], // locations and projects not strictly needed for overview, but could pass if needed
            projects: []
        },
        'dashboard-activity': dashboardData.activity,
    }

    return (
        <OverviewClient fallbackData={fallback} />
    )
}
