/**
 * Locations List — Server Component
 * 
 * PERF: Fetches locations server-side to eliminate client-side waterfall
 * and bypass RLS table scans.
 */

import { getServerLocationsData, getServerUserProfile } from "@/lib/services/dashboard-server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import LocationsClient from "@/components/dashboard/LocationsClient"

export const dynamic = 'force-dynamic'

export default async function LocationsPage() {
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

    // Fetch locations server-side
    const locationsData = await getServerLocationsData(profile.organization_id)

    // Provide initial fallback data for SWR hooks
    const fallback = {
        [`dashboard-locations-${profile.organization_id}`]: locationsData,
    }

    return (
        <LocationsClient fallbackData={fallback} />
    )
}
