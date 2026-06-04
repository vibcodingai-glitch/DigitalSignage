import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data: screens } = await supabase.from('screens').select('id, name')
  
  if (!screens) return
  
  console.log(`Sending reload push event to ${screens.length} screens...`)
  
  for (const screen of screens) {
    const { error } = await supabase.from('push_events').insert({
      screen_id: screen.id,
      event_type: 'reload',
      payload: {},
      expires_at: new Date(Date.now() + 5 * 60000).toISOString() // 5 minutes
    })
    
    if (error) console.error(`Error sending to ${screen.name}:`, error.message)
    else console.log(`Reload event sent to ${screen.name}`)
  }
}

run()
