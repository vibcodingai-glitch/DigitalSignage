/**
 * Screen Detail — Server Component
 *
 * PERF: Prefetches all screen data server-side using the service role client
 * (bypasses RLS). Data is passed as props to the client component, so the
 * page renders instantly without showing skeleton loaders.
 */

import { getServerUserProfile, getServerScreenDetailData } from "@/lib/services/dashboard-server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import ScreenDetailClient from "@/components/screens/ScreenDetailClient"

export const dynamic = 'force-dynamic'

export default async function ScreenDetailPage({ params }: { params: { id: string } }) {
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

    // Prefetch all screen detail data server-side
    const initialData = await getServerScreenDetailData(params.id, profile.organization_id)

    return (
        <ScreenDetailClient
            params={params}
            initialData={initialData}
        />
    )
}
