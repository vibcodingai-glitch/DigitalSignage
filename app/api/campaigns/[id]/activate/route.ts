/**
 * POST /api/campaigns/[id]/activate
 *
 * Activates a campaign:
 * 1. Deactivates any currently active campaign (one at a time rule)
 * 2. Inserts screen_projects rows with priority=999 for each screen mapping
 * 3. Marks campaign as active
 * 4. Sends reload push events to all affected screens
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getOrgId() {
  const serverSupabase = createServerClient()
  const { data: { user }, error } = await serverSupabase.auth.getUser()
  if (error || !user) return null
  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  return profile?.organization_id || null
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = await getOrgId()
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = createServiceClient()

    // 1. Get the campaign and verify it belongs to this org
    const { data: campaign, error: campErr } = await sb
      .from('campaigns')
      .select(`*, campaign_screens(screen_id, project_id, screens(id, name))`)
      .eq('id', params.id)
      .eq('organization_id', orgId)
      .single()

    if (campErr || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.campaign_screens.length === 0) {
      return NextResponse.json({ error: 'Campaign has no screen mappings. Add screens first.' }, { status: 400 })
    }

    // 2. Deactivate any currently active campaign (one at a time)
    const { data: activeCampaigns } = await sb
      .from('campaigns')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .neq('id', params.id)

    if (activeCampaigns && activeCampaigns.length > 0) {
      for (const ac of activeCampaigns) {
        // Remove their screen_project overrides
        await sb.from('screen_projects').delete().eq('campaign_id', ac.id)
        // Mark as inactive
        await sb.from('campaigns').update({ is_active: false, activated_at: null }).eq('id', ac.id)
      }
    }

    // 3. Insert priority=999 screen_project rows for this campaign
    const screenProjectRows = campaign.campaign_screens.map((cs: any) => ({
      screen_id: cs.screen_id,
      project_id: cs.project_id,
      organization_id: orgId,
      schedule_type: 'always',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      start_time: '00:00',
      end_time: '23:59',
      priority: 999,
      is_active: true,
      campaign_id: params.id,
    }))

    // Remove any previous entries for this campaign first (idempotent)
    await sb.from('screen_projects').delete().eq('campaign_id', params.id)

    const { error: spError } = await sb.from('screen_projects').insert(screenProjectRows)
    if (spError) throw spError

    // 4. Mark campaign as active
    await sb
      .from('campaigns')
      .update({ is_active: true, activated_at: new Date().toISOString() })
      .eq('id', params.id)

    // 5. Send reload push events to all affected screens
    const expiresAt = new Date(Date.now() + 30_000).toISOString() // 30s TTL
    const pushRows = campaign.campaign_screens.map((cs: any) => ({
      screen_id: cs.screen_id,
      event_type: 'reload',
      payload: { reason: `campaign_activated:${campaign.name}` },
      expires_at: expiresAt,
    }))
    await sb.from('push_events').insert(pushRows)

    return NextResponse.json({
      success: true,
      message: `Campaign "${campaign.name}" activated on ${campaign.campaign_screens.length} screen(s)`,
      screensAffected: campaign.campaign_screens.length,
    })
  } catch (err) {
    console.error('[POST /api/campaigns/[id]/activate]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
