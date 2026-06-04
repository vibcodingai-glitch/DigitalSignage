import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: files, error } = await supabase.storage.from('content').list(undefined, { limit: 10, sortBy: { column: 'created_at', order: 'desc' }})
  if (error) console.error("Error:", error)
  console.log("Files:", files)
}
run()
