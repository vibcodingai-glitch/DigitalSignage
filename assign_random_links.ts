import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  // 1. Fetch the 7 PowerBI items we just added
  const { data: contentItems, error: contentError } = await supabase
    .from('content_items')
    .select('*')
    .eq('type', 'powerbi_frame')
  
  if (contentError || !contentItems || contentItems.length === 0) {
    console.error('Failed to fetch powerbi items')
    return
  }

  // 2. Fetch the 8 projects (assuming they are named "Project for Screen X")
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name')
    .ilike('name', 'Project for Screen%')

  if (projectsError || !projects) {
    console.error('Failed to fetch projects')
    return
  }

  console.log(`Found ${contentItems.length} PowerBI items and ${projects.length} projects.`)

  let insertCount = 0

  for (const project of projects) {
    // Pick a random number between 3 and 4
    const numLinks = Math.floor(Math.random() * 2) + 3
    
    // Shuffle the contentItems to pick randomly
    const shuffled = [...contentItems].sort(() => 0.5 - Math.random())
    const selectedItems = shuffled.slice(0, numLinks)
    
    const newPlaylistItems = selectedItems.map((item, index) => ({
      project_id: project.id,
      content_item_id: item.id,
      order_index: index + 10, // put them after any existing items (which have sort_order 0, 1, etc)
      duration_override: item.duration_seconds,
      transition_type: 'fade',
      zone_index: 0
    }))

    const { error: insertError } = await supabase
      .from('playlist_items')
      .insert(newPlaylistItems)
    
    if (insertError) {
      console.error(`Error adding to ${project.name}:`, insertError)
    } else {
      console.log(`Assigned ${numLinks} random links to ${project.name}`)
      insertCount += numLinks
    }
  }

  console.log(`Successfully assigned ${insertCount} playlist items across ${projects.length} projects!`)
  
  // Broadcast reload event to all screens so they update immediately
  const { data: screens } = await supabase.from('screens').select('id')
  if (screens) {
    console.log('Sending push events to trigger screen reload...')
    for (const screen of screens) {
      await supabase.from('push_events').insert({
        screen_id: screen.id,
        event_type: 'reload',
        payload: {},
        expires_at: new Date(Date.now() + 5 * 60000).toISOString()
      })
    }
  }
}

run()
