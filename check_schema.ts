import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data, error } = await supabase.from('playlist_items').select('*').limit(1)
  console.log('playlist_items columns:', data ? Object.keys(data[0]) : error)
}

run()
