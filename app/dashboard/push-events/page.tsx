/**
 * Push Events — Server Component
 * 
 * PERF: Fetches push events server-side to eliminate client-side waterfall
 * and bypass RLS table scans.
 */

import { getServerPushEventsData, getServerUserProfile } from "@/lib/services/dashboard-server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import PushEventsClient from "@/components/dashboard/PushEventsClient"

export const dynamic = 'force-dynamic'

export default async function PushEventsPage() {
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

    // Fetch push events data server-side
    const fallbackData = await getServerPushEventsData(profile.organization_id)

    return (
        <PushEventsClient fallbackData={fallbackData} />
    )
}
