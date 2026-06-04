import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Fetching active screens...')
  const { data: screens, error: screenError } = await supabase
    .from('screens')
    .select('id, name')
  
  if (screenError) {
    console.error('Error fetching screens:', screenError)
    return
  }

  console.log(`Found ${screens.length} screens. Broadcasting FORCE_RELOAD...`)

  for (const screen of screens) {
    const channel = supabase.channel(`screen-${screen.id}`)
    
    await new Promise(resolve => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Sending FORCE_RELOAD to ${screen.name} (Channel: screen-${screen.id})`)
          await channel.send({
            type: 'broadcast',
            event: 'command',
            payload: { command: 'FORCE_RELOAD' }
          })
          
          supabase.removeChannel(channel)
          resolve(true)
        }
      })
    })
  }

  // Also completely delete the content items so they are totally gone
  console.log('Cleaning up content_items...')
  const { error } = await supabase
    .from('content_items')
    .delete()
    .or('name.ilike.%call center%,name.ilike.%gym tracker%')
  
  if (error) {
    console.error('Error deleting content items:', error)
  } else {
    console.log('Successfully deleted the content items from the library.')
  }

  console.log('Done.')
  process.exit(0)
}

run()
