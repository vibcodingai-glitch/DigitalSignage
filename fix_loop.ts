import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  console.log('Expiring all reload events to stop infinite loop...')
  const { data, error } = await supabase
    .from('push_events')
    .update({ expires_at: new Date().toISOString() })
    .eq('event_type', 'reload')
  
  if (error) console.error(error)
  else console.log('Successfully expired reload events!')
}

run()
