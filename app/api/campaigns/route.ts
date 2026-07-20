/**
 * GET  /api/campaigns — list all campaigns for the org
 * POST /api/campaigns — create a new campaign
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

export async function GET() {
  try {
    const orgId = await getOrgId()
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = createServiceClient()
    const { data: campaigns, error } = await sb
      .from('campaigns')
      .select(`
        *,
        campaign_screens (
          id,
          screen_id,
          project_id,
          screens ( id, name, display_key ),
          projects ( id, name )
        )
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ campaigns })
  } catch (err) {
    console.error('[GET /api/campaigns]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getOrgId()
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, description, color, screens } = await request.json()
    // screens: Array<{ screen_id: string, project_id: string }>

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    }

    const sb = createServiceClient()

    // Create the campaign
    const { data: campaign, error: campError } = await sb
      .from('campaigns')
      .insert({ organization_id: orgId, name: name.trim(), description, color: color || '#6366f1' })
      .select()
      .single()

    if (campError) throw campError

    // Insert screen mappings if provided
    if (screens && screens.length > 0) {
      const mappings = screens.map((s: { screen_id: string; project_id: string }) => ({
        campaign_id: campaign.id,
        screen_id: s.screen_id,
        project_id: s.project_id,
      }))
      const { error: mapError } = await sb.from('campaign_screens').insert(mappings)
      if (mapError) throw mapError
    }

    // Return full campaign with mappings
    const { data: full } = await sb
      .from('campaigns')
      .select(`*, campaign_screens(*, screens(id, name), projects(id, name))`)
      .eq('id', campaign.id)
      .single()

    return NextResponse.json({ campaign: full }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/campaigns]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
