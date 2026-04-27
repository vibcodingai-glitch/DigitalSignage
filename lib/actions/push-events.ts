'use server'

import { createClient } from '@/lib/supabase/server'

export async function broadcastPushEvent(data: {
  eventType: string
  payload: any
  expiresAt?: string
}) {
  const supabase = createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  // Get user's org
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  
  if (!profile?.organization_id) {
      return { success: false, error: 'No organization found' }
  }

  // Get all screens in the org
  const { data: screens } = await supabase
    .from('screens')
    .select('id')
    .eq('organization_id', profile.organization_id)
  
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
}
