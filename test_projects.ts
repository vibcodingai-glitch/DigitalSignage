import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.from('projects').select('id, name, screen_id, is_active')
  console.log(data)
  
  const { data: screens } = await supabase.from('screens').select('id, name, active_project_id')
  console.log(screens)
}
run()
