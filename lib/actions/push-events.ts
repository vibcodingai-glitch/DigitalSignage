'use server'

import { createClient } from '@/lib/supabase/server'

export async function broadcastPushEvent(data: {
  eventType: string
  payload: any
  expiresAt?: string
}) {
  try {
    const supabase = createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Authentication failed. Please refresh and try again.' }
    }
    
    // Get user's org
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile?.organization_id) {
      return { success: false, error: 'No organization found' }
    }

    // Get all screens in the org
    const { data: screens, error: screensError } = await supabase
      .from('screens')
      .select('id')
      .eq('organization_id', profile.organization_id)
    
    if (screensError) {
      return { success: false, error: screensError.message }
    }
    
    if (!screens || screens.length === 0) {
      return { success: false, error: 'No screens found' }
    }
    
    // Create one push_event per screen
    const events = screens.map(screen => ({
      screen_id: screen.id,
      event_type: data.eventType,
      payload: data.payload,
      created_by: user.id,
      expires_at: data.expiresAt || null
    }))
    
    const { error } = await supabase
      .from('push_events')
      .insert(events)
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { 
      success: true, 
      count: screens.length,
      eventType: data.eventType
    }
  } catch (err) {
    console.error('[broadcastPushEvent] Unexpected error:', err)
    return { success: false, error: (err as Error).message || 'Unknown server error' }
  }
}
