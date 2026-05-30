import { createClient } from "@/lib/supabase/client"

/**
 * Get the current user's organization_id.
 * Uses the profile if available, otherwise falls back to a direct query.
 * This consolidates the duplicated org_id fetching pattern used across
 * screens/page.tsx, projects/page.tsx, and screens/[id]/page.tsx.
 */
export async function getOrgId(profileOrgId?: string | null): Promise<string | null> {
    if (profileOrgId) return profileOrgId

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

    return data?.organization_id || null
}
