import { createServiceClient } from '@/lib/supabase/service'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CampaignsClient from '@/components/dashboard/CampaignsClient'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
    const serverSupabase = createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) redirect('/login')

    const sb = createServiceClient()

    const { data: profile } = await sb
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

    if (!profile?.organization_id) redirect('/login')

    const orgId = profile.organization_id

    // Load campaigns with screen mappings
    const { data: campaigns } = await sb
        .from('campaigns')
        .select(`
            *,
            campaign_screens (
                id, screen_id, project_id,
                screens ( id, name, display_key ),
                projects ( id, name )
            )
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

    // Load all screens + projects for the builder
    const [screensResult, projectsResult] = await Promise.all([
        sb.from('screens').select('id, name, display_key, status').eq('organization_id', orgId).order('name'),
        sb.from('projects').select('id, name').eq('organization_id', orgId).order('name'),
    ])

    return (
        <CampaignsClient
            initialCampaigns={campaigns || []}
            screens={screensResult.data || []}
            projects={projectsResult.data || []}
        />
    )
}
