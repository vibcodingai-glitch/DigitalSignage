import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function run() {
  const { data } = await supabase.from('screens').select('display_key').eq('name', 'Screen 1 (From Left )').single()
  console.log(data?.display_key)
}
run()
