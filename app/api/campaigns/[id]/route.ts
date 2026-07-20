/**
 * GET    /api/campaigns/[id] — get single campaign
 * PUT    /api/campaigns/[id] — update name/description/screens
 * DELETE /api/campaigns/[id] — delete campaign (deactivates first)
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

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = await getOrgId()
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = createServiceClient()
    const { data, error } = await sb
      .from('campaigns')
      .select(`*, campaign_screens(*, screens(id, name, display_key), projects(id, name))`)
      .eq('id', params.id)
      .eq('organization_id', orgId)
      .single()

    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ campaign: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = await getOrgId()
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, description, color, screens } = await request.json()
    const sb = createServiceClient()

    // Update campaign metadata
    const { error: campError } = await sb
      .from('campaigns')
      .update({ name, description, color, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('organization_id', orgId)

    if (campError) throw campError

    // Replace screen mappings
    if (screens !== undefined) {
      await sb.from('campaign_screens').delete().eq('campaign_id', params.id)
      if (screens.length > 0) {
        const mappings = screens.map((s: { screen_id: string; project_id: string }) => ({
          campaign_id: params.id,
          screen_id: s.screen_id,
          project_id: s.project_id,
        }))
        const { error: mapError } = await sb.from('campaign_screens').insert(mappings)
        if (mapError) throw mapError
      }
    }

    const { data: full } = await sb
      .from('campaigns')
      .select(`*, campaign_screens(*, screens(id, name), projects(id, name))`)
      .eq('id', params.id)
      .single()

    return NextResponse.json({ campaign: full })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = await getOrgId()
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = createServiceClient()

    // Clean up any active screen_project overrides first
    await sb.from('screen_projects').delete().eq('campaign_id', params.id)

    // Delete campaign (cascade removes campaign_screens)
    const { error } = await sb
      .from('campaigns')
      .delete()
      .eq('id', params.id)
      .eq('organization_id', orgId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
