/**
 * POST /api/upload — Server-side file upload
 *
 * Handles the full upload flow server-side to bypass
 * browser-side Supabase Web Locks API deadlocks.
 *
 * Expects multipart form data with:
 *   - file: the file to upload
 *   - name: display name for the content item
 *   - duration: duration in seconds (for non-video)
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabaseAdmin = createServiceClient()

    // Verify user is authenticated
    const serverSupabase = createServerClient()
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's org
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const orgId = profile.organization_id

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const name = (formData.get('name') as string) || 'Untitled'
    const duration = parseInt((formData.get('duration') as string) || '10', 10)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Build storage path
    const ext = file.name.split('.').pop()
    const filePath = `${orgId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`

    // Convert File to Buffer for server-side upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to storage
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from('content')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      })

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('content')
      .getPublicUrl(storageData.path)

    // Determine content type
    const mime = file.type
    let type: string = 'image'
    if (mime.startsWith('video/')) type = 'video'
    if (mime.startsWith('audio/')) type = 'audio'

    // Insert content_items record
    const { data: contentItem, error: dbError } = await supabaseAdmin
      .from('content_items')
      .insert({
        organization_id: orgId,
        name,
        type,
        file_path: storageData.path,
        source_url: publicUrl,
        file_size: file.size,
        duration_seconds: type === 'video' ? 0 : duration,
        thumbnail_url: type === 'image' ? publicUrl : null
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, contentItem })
  } catch (err) {
    console.error('[POST /api/upload]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
