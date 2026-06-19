/**
 * POST /api/upload/signed-url
 *
 * Generates a Supabase signed upload URL using the service role key.
 * The browser then uploads the file directly to Supabase Storage via XHR.
 * This bypasses Vercel's 4.5MB body limit entirely.
 *
 * Body: { fileName, contentType, orgId }
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

    const { fileName, contentType } = await request.json()

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
    }

    const ext = fileName.split('.').pop() || 'mp4'
    const filePath = `${profile.organization_id}/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`

    // Generate signed upload URL (expires in 1 hour)
    const { data, error } = await supabaseAdmin.storage
      .from('content')
      .createSignedUploadUrl(filePath)

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Could not generate signed URL' }, { status: 500 })
    }

    // Get the public URL (the file doesn't exist yet but path is known)
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('content')
      .getPublicUrl(filePath)

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      filePath,
      publicUrl,
    })
  } catch (err) {
    console.error('[POST /api/upload/signed-url]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
