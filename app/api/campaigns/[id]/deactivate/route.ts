/**
 * POST /api/campaigns/[id]/deactivate
 *
 * Deactivates a campaign:
 * 1. Removes the screen_projects override rows (priority=999)
 * 2. Marks campaign as inactive
 * 3. Sends reload push events so screens snap back to standard projects
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

    // Get the campaign (for screen list + name)
    const { data: campaign, error: campErr } = await sb
      .from('campaigns')
      .select(`*, campaign_screens(screen_id)`)
      .eq('id', params.id)
      .eq('organization_id', orgId)
      .single()

    if (campErr || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // 1. Remove screen_project override rows for this campaign
    await sb.from('screen_projects').delete().eq('campaign_id', params.id)

    // 2. Mark as inactive
    await sb
      .from('campaigns')
      .update({ is_active: false, activated_at: null })
      .eq('id', params.id)

    // 3. Send reload push events so screens pick up their standard projects
    if (campaign.campaign_screens.length > 0) {
      const expiresAt = new Date(Date.now() + 30_000).toISOString()
      const pushRows = campaign.campaign_screens.map((cs: any) => ({
        screen_id: cs.screen_id,
        event_type: 'reload',
        payload: { reason: `campaign_deactivated:${campaign.name}` },
        expires_at: expiresAt,
      }))
      await sb.from('push_events').insert(pushRows)
    }

    return NextResponse.json({
      success: true,
      message: `Campaign "${campaign.name}" deactivated. Screens resuming standard projects.`,
    })
  } catch (err) {
    console.error('[POST /api/campaigns/[id]/deactivate]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
