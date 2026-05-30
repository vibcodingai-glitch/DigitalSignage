/**
 * Content Library — Server Component
 * 
 * PERF: Fetches content library server-side to eliminate client-side waterfall
 * and bypass RLS table scans.
 */

import { getServerContentData, getServerUserProfile } from "@/lib/services/dashboard-server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import ContentClient from "@/components/dashboard/ContentClient"

export const dynamic = 'force-dynamic'

export default async function ContentPage() {
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

    // Fetch content server-side
    const contentData = await getServerContentData(profile.organization_id)

    // Provide initial fallback data for SWR hooks
    const fallback = {
        [`dashboard-content-${profile.organization_id}`]: contentData,
    }

    return (
        <ContentClient fallbackData={fallback} />
    )
}
