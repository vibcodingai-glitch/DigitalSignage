/**
 * Screens List — Server Component
 * 
 * PERF: Fetches screens metadata server-side to eliminate client-side waterfall
 * and loading spinners on initial page load.
 */

import { getServerDashboardData, getServerUserProfile } from "@/lib/services/dashboard-server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import ScreensClient from "@/components/dashboard/ScreensClient"

export const dynamic = 'force-dynamic' // Ensure fresh data on reload

export default async function ScreensPage() {
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

    // Fetch dashboard data server-side (getScreens inside uses the same parallel fetch)
    const dashboardData = await getServerDashboardData(profile.organization_id)

    // Provide initial fallback data for SWR hooks
    const fallback = {
        'screens-metadata': {
            screens: dashboardData.screens,
            locations: dashboardData.locations,
            projects: dashboardData.projects
        }
    }

    return (
        <ScreensClient fallbackData={fallback} />
    )
}
