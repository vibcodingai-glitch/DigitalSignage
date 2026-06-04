import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: screens } = await supabase.from('screens').select('id, name, active_project_id')
  const { data: contentItems } = await supabase.from('content_items').select('*')
  
  if (!contentItems || contentItems.length === 0) {
    console.log("No content items found!")
    return
  }

  for (const s of screens || []) {
    if (s.active_project_id && s.name.startsWith("Screen ")) {
      console.log(`Seeding playlist for ${s.name} (project ${s.active_project_id})`)
      
      // Pick 3 random content items
      const selectedContent = []
      const available = [...contentItems]
      for (let i = 0; i < 3 && available.length > 0; i++) {
        const randIdx = Math.floor(Math.random() * available.length)
        selectedContent.push(available[randIdx])
        available.splice(randIdx, 1)
      }
      
      for (let i = 0; i < selectedContent.length; i++) {
        const content = selectedContent[i]
        await supabase.from('playlist_items').insert({
          project_id: s.active_project_id,
          content_item_id: content.id,
          order_index: i,
          duration_override: content.duration_seconds || 10,
          transition_type: 'fade',
          zone_index: 0
        })
      }
      console.log(`Added ${selectedContent.length} items.`)
    }
  }
  console.log('Done seeding!')
}
run()
