import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: screens } = await supabase.from('screens').select('id, name, active_project_id')
  console.log("Screens:", screens)
  
  const { data: projs } = await supabase.from('projects').select('id, name')
  const projMap = new Map(projs?.map(p => [p.id, p]))
  
  for (const s of screens || []) {
    if (s.active_project_id) {
      const { data: items } = await supabase.from('playlist_items').select('id').eq('project_id', s.active_project_id)
      console.log(`Project for ${s.name} (${projMap.get(s.active_project_id)?.name}) has ${items?.length} playlist items.`)
    }
  }
}
run()
