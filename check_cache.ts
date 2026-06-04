import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

async function run() {
  const displayKey = 'ee7af3b4-013b-47af-8d46-dd38354b6cb7'
  const url = `https://digital-signage-peach.vercel.app/api/display/${displayKey}`
  
  console.log('Fetching directly from Vercel API:', url)
  const res = await fetch(url)
  const data = await res.json()
  
  if (!res.ok) {
    console.error('Failed to fetch from Vercel:', data)
    return
  }
  
  console.log(`Vercel API returned: Project = ${data.project?.name}`)
  console.log('Playlist items:')
  for (const item of data.playlist || []) {
    console.log(`- ${item.content_item?.name}`)
  }
}

run()
