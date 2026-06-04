import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  // Find the content items
  const { data: items } = await supabase
    .from('content_items')
    .select('id, name')
    .or('name.ilike.%call center%,name.ilike.%gym tracker%')
  
  console.log("Found content items to remove:", items)
  
  if (!items || items.length === 0) {
    console.log("No matching items found")
    return
  }

  const itemIds = items.map(i => i.id)

  // Find playlist items referencing these content items
  const { data: playlistItems } = await supabase
    .from('playlist_items')
    .select('id, project_id, content_item_id')
    .in('content_item_id', itemIds)

  console.log("Found playlist items to remove:", playlistItems?.length)

  if (playlistItems && playlistItems.length > 0) {
    const { error } = await supabase
      .from('playlist_items')
      .delete()
      .in('content_item_id', itemIds)
    
    if (error) console.error("Delete error:", error)
    else console.log("Successfully removed from all playlists")
  }
}
run()
