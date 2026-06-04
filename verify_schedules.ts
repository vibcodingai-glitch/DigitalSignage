import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  console.log('=== SCHEDULED PROJECTS VERIFICATION ===\n')

  // 1. Check the two scheduled projects exist
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name, is_active, created_at')
    .in('name', ['Morning Broadcast (8AM-9AM)', 'Afternoon Broadcast (1PM-2PM)'])
    .order('name')

  if (projErr) {
    console.error('Error fetching projects:', projErr)
    return
  }

  console.log(`Found ${projects?.length || 0} scheduled projects:\n`)
  for (const p of projects || []) {
    console.log(`  ✓ ${p.name}`)
    console.log(`    ID: ${p.id}`)
    console.log(`    Active: ${p.is_active}`)
    console.log(`    Created: ${p.created_at}\n`)
  }

  // 2. Check screen_projects bindings for each project
  for (const p of projects || []) {
    const { data: bindings, error: bindErr } = await supabase
      .from('screen_projects')
      .select('id, screen_id, schedule_type, days_of_week, start_time, end_time, priority, is_active, screens(name)')
      .eq('project_id', p.id)
      .order('sort_order')

    if (bindErr) {
      console.error(`Error fetching bindings for ${p.name}:`, bindErr)
      continue
    }

    console.log(`--- Bindings for "${p.name}" (${bindings?.length || 0} screens) ---`)
    for (const b of bindings || []) {
      const screenName = (b as any).screens?.name || 'Unknown'
      console.log(`  Screen: ${screenName}`)
      console.log(`    Schedule: ${b.schedule_type} | ${b.start_time} - ${b.end_time}`)
      console.log(`    Days: ${b.days_of_week} | Priority: ${b.priority} | Active: ${b.is_active}`)
    }
    console.log('')
  }

  // 3. Check all screens and their current active_project_id
  const { data: screens, error: scrErr } = await supabase
    .from('screens')
    .select('id, name, status, active_project_id, projects!screens_active_project_id_fkey(name)')
    .order('name')

  if (scrErr) {
    console.error('Error fetching screens:', scrErr)
    return
  }

  console.log(`\n=== ALL SCREENS STATUS ===\n`)
  for (const s of screens || []) {
    const activeProj = (s as any).projects?.name || 'None'
    console.log(`  ${s.name} | Status: ${s.status} | Active Project: ${activeProj}`)
  }

  // 4. Check the schedule evaluation logic
  console.log(`\n=== SCHEDULE EVALUATION (current time) ===\n`)
  const now = new Date()
  const currentHour = now.getUTCHours()
  const currentMin = now.getUTCMinutes()
  const currentDay = now.getUTCDay()
  console.log(`  Current UTC time: ${now.toISOString()}`)
  console.log(`  UTC Hour: ${currentHour}, Minute: ${currentMin}, Day of week: ${currentDay}`)
  
  for (const p of projects || []) {
    const { data: bindings } = await supabase
      .from('screen_projects')
      .select('start_time, end_time, days_of_week, is_active')
      .eq('project_id', p.id)
      .limit(1)
      .single()

    if (bindings) {
      const [startH, startM] = bindings.start_time.split(':').map(Number)
      const [endH, endM] = bindings.end_time.split(':').map(Number)
      const currentMins = currentHour * 60 + currentMin
      const startMins = startH * 60 + startM
      const endMins = endH * 60 + endM
      const isInWindow = currentMins >= startMins && currentMins < endMins && bindings.days_of_week.includes(currentDay)
      
      console.log(`\n  ${p.name}:`)
      console.log(`    Window: ${bindings.start_time} - ${bindings.end_time} UTC`)
      console.log(`    Currently active window? ${isInWindow ? '✅ YES' : '❌ No (outside window)'}`)
    }
  }

  console.log('\n=== VERIFICATION COMPLETE ===')
}

run()
