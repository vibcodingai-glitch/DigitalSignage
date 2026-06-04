import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const displayKey = 'ee7af3b4-013b-47af-8d46-dd38354b6cb7'
  
  const { data: screen } = await supabase
    .from('screens')
    .select('*, active_project_id')
    .eq('display_key', displayKey)
    .single()
    
  console.log("Screen:", screen)
  
  if (screen?.active_project_id) {
    const { data: playlist } = await supabase
      .from('playlist_items')
      .select('*, content_items(*)')
      .eq('project_id', screen.active_project_id)
      
    console.log("Playlist Items for this screen:")
    for (const p of playlist || []) {
      console.log(`- ${p.content_items?.name} (${p.content_items?.type}) URL: ${p.content_items?.source_url}`)
    }
  }
}

run()
