/**
 * POST /api/dashboard/mutate
 *
 * Unified server-side API for ALL dashboard write operations.
 * Uses service-role key → no auth token refresh deadlocks.
 *
 * Body: { action: string, ...params }
 *
 * Supported actions:
 *   create-project, delete-project, save-playlist,
 *   toggle-project, update-project-settings, update-layout
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Authenticate and return user ID + org ID */
async function getAuth() {
  const serverSupabase = createServerClient()
  const { data: { user }, error } = await serverSupabase.auth.getUser()
  if (error || !user) return null

  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return null
  return { userId: user.id, orgId: profile.organization_id }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action } = body
    const sb = createServiceClient()

    switch (action) {
      // ── CREATE PROJECT ───────────────────────────────────
      case 'create-project': {
        const { name, screen_id, copy_from_id } = body

        const { data: project, error: projErr } = await sb.from('projects').insert({
          organization_id: auth.orgId,
          name,
          screen_id: screen_id === 'unassigned' ? null : (screen_id || null),
          is_active: false,
          settings: { transition_type: 'fade', default_duration: 10, loop: true }
        }).select().single()

        if (projErr) return NextResponse.json({ error: projErr.message }, { status: 500 })

        // Clone playlist if specified
        if (copy_from_id && copy_from_id !== 'none') {
          const { data: sourceItems } = await sb
            .from('playlist_items')
            .select('*')
            .eq('project_id', copy_from_id)

          if (sourceItems && sourceItems.length > 0) {
            const cloned = sourceItems.map(item => ({
              project_id: project.id,
              content_item_id: item.content_item_id,
              order_index: item.order_index,
              duration_override: item.duration_override,
              transition_type: item.transition_type,
              settings: item.settings
            }))
            await sb.from('playlist_items').insert(cloned)
          }
        }

        return NextResponse.json({ project })
      }

      // ── DELETE PROJECT ───────────────────────────────────
      case 'delete-project': {
        const { id } = body
        const { error } = await sb.from('projects').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }

      // ── SAVE PLAYLIST ────────────────────────────────────
      case 'save-playlist': {
        const { project_id, settings, items } = body

        // 1. Update project settings
        if (settings) {
          await sb.from('projects').update({ settings }).eq('id', project_id)
        }

        // 2. Delete existing playlist items
        const { error: delErr } = await sb.from('playlist_items').delete().eq('project_id', project_id)
        if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

        // 3. Insert new items
        if (items && items.length > 0) {
          const insertPayload = items.map((p: any, idx: number) => ({
            project_id,
            content_item_id: p.content_item_id,
            order_index: idx,
            duration_override: p.duration_override,
            transition_type: p.transition_type,
            zone_index: p.zone_index || 0,
            valid_from: p.valid_from || null,
            valid_until: p.valid_until || null,
            day_part_start: p.day_part_start || null,
            day_part_end: p.day_part_end || null,
            show_qr_code: p.show_qr_code || false,
            qr_code_url: p.qr_code_url || null
          })).filter((p: any) => p.content_item_id)

          const { error: insertErr } = await sb.from('playlist_items').insert(insertPayload)
          if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
      }

      // ── TOGGLE PROJECT ACTIVE ────────────────────────────
      case 'toggle-project': {
        const { project_id, is_active, screen_id: toggleScreenId } = body

        await sb.from('projects').update({ is_active }).eq('id', project_id)

        // If activating, bind to screen
        if (is_active && toggleScreenId) {
          await sb.from('screens').update({ active_project_id: project_id }).eq('id', toggleScreenId)
        }

        return NextResponse.json({ success: true })
      }

      // ── UPDATE LAYOUT ────────────────────────────────────
      case 'update-layout': {
        const { project_id, layout_type } = body
        const { error } = await sb.from('projects').update({ layout_type }).eq('id', project_id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }

      // ── SCREEN PROJECTS MUTATIONS ────────────────────────
      case 'screen-projects-assign': {
        const { input } = body
        const payload = {
          screen_id: input.screen_id,
          project_id: input.project_id,
          organization_id: input.organization_id,
          schedule_type: input.schedule_type,
          days_of_week: input.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
          start_time: input.start_time ?? '00:00',
          end_time: input.end_time ?? '23:59',
          start_date: input.start_date ?? null,
          end_date: input.end_date ?? null,
          priority: input.priority ?? 0,
          sort_order: input.sort_order ?? 0,
          is_active: true,
        }
        const { data, error } = await sb.from('screen_projects').insert(payload).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ data })
      }

      case 'screen-projects-update': {
        const { id, updates } = body
        const { data, error } = await sb.from('screen_projects').update(updates).eq('id', id).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ data })
      }

      case 'screen-projects-remove': {
        const { id } = body
        const { error } = await sb.from('screen_projects').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }

      case 'screen-projects-reorder': {
        const { items } = body
        await Promise.all(
          items.map(({ id, sort_order }: any) =>
            sb.from('screen_projects').update({ sort_order }).eq('id', id)
          )
        )
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    console.error('[POST /api/dashboard/mutate]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
