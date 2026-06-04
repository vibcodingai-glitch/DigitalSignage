import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

async function run() {
  const displayKey = 'ee7af3b4-013b-47af-8d46-dd38354b6cb7'
  const url = `https://digital-signage-peach.vercel.app/api/display/${displayKey}`
  
  const res = await fetch(url)
  const data = await res.json()
  console.log(`Vercel API Project ID: ${data.project?.id} (Name: ${data.project?.name})`)
  
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: screen } = await supabase.from('screens').select('active_project_id').eq('display_key', displayKey).single()
  console.log(`Local DB active_project_id: ${screen?.active_project_id}`)
}

run()
