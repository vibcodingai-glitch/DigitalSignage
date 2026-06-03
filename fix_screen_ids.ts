import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: screens } = await supabase.from('screens').select('id, name, active_project_id')
  
  for (const screen of screens || []) {
    if (screen.active_project_id) {
      console.log(`Setting screen_id for project ${screen.active_project_id} to ${screen.id}`)
      await supabase.from('projects').update({ screen_id: screen.id }).eq('id', screen.active_project_id)
    }
  }
  console.log('Done!')
}
run()
