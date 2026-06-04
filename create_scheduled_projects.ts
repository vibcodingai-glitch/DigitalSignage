import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  // 1. Get the organization ID from existing screens
  const { data: screens, error: screensErr } = await supabase
    .from('screens')
    .select('id, name, organization_id')
    .order('name')

  if (screensErr || !screens || screens.length === 0) {
    console.error('Failed to fetch screens:', screensErr)
    return
  }

  const orgId = screens[0].organization_id
  console.log(`Found ${screens.length} screens in org ${orgId}`)

  // 2. Create Project 1: 8AM - 9AM GMT
  const { data: project1, error: p1Err } = await supabase
    .from('projects')
    .insert({
      organization_id: orgId,
      name: 'Morning Broadcast (8AM-9AM)',
      is_active: true,
    })
    .select()
    .single()

  if (p1Err) {
    console.error('Failed to create project 1:', p1Err)
    return
  }
  console.log(`Created project: ${project1.name} (${project1.id})`)

  // 3. Create Project 2: 1PM - 2PM GMT
  const { data: project2, error: p2Err } = await supabase
    .from('projects')
    .insert({
      organization_id: orgId,
      name: 'Afternoon Broadcast (1PM-2PM)',
      is_active: true,
    })
    .select()
    .single()

  if (p2Err) {
    console.error('Failed to create project 2:', p2Err)
    return
  }
  console.log(`Created project: ${project2.name} (${project2.id})`)

  // 4. Bind both projects to ALL screens with schedules
  const allDays = [0, 1, 2, 3, 4, 5, 6] // Sun-Sat

  const bindings: any[] = []

  for (const screen of screens) {
    // Morning 8AM-9AM binding
    bindings.push({
      screen_id: screen.id,
      project_id: project1.id,
      organization_id: orgId,
      schedule_type: 'scheduled',
      days_of_week: allDays,
      start_time: '08:00',
      end_time: '09:00',
      priority: 10, // Higher priority than default projects
      is_active: true,
      sort_order: 0,
    })

    // Afternoon 1PM-2PM binding
    bindings.push({
      screen_id: screen.id,
      project_id: project2.id,
      organization_id: orgId,
      schedule_type: 'scheduled',
      days_of_week: allDays,
      start_time: '13:00',
      end_time: '14:00',
      priority: 10,
      is_active: true,
      sort_order: 1,
    })
  }

  const { error: bindErr } = await supabase
    .from('screen_projects')
    .insert(bindings)

  if (bindErr) {
    console.error('Failed to bind projects to screens:', bindErr)
    return
  }

  console.log(`\nSuccessfully bound both projects to all ${screens.length} screens!`)
  console.log(`\n  Morning Broadcast (8AM-9AM)   → ${project1.id}`)
  console.log(`  Afternoon Broadcast (1PM-2PM) → ${project2.id}`)
  console.log(`\nTotal bindings created: ${bindings.length}`)
  console.log(`\nYou can now add content to these projects from the dashboard.`)
}

run()
