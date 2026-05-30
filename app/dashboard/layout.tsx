/**
 * Dashboard Layout — Server Component
 *
 * PERF: This is a Server Component that fetches user data server-side,
 * then passes it as props to the client-side DashboardShell.
 *
 * Before: "use client" → browser downloads JS → runs auth → fetches profile → renders
 * After:  Server fetches profile during SSR → browser receives pre-rendered HTML → hydrates
 *
 * This eliminates the 500-1500ms auth + profile waterfall on every page load.
 */

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/DashboardShell"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createClient()

    // Server-side auth check — fast, no client waterfall
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        redirect('/login')
    }

    // Fetch profile server-side — bypasses the useUser() client hook
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, organization_id, role, organizations(name)')
        .eq('id', user.id)
        .single()

    return (
        <DashboardShell profile={profile}>
            {children}
        </DashboardShell>
    )
}
