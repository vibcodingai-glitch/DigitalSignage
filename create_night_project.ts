import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data: screens, error: scrErr } = await supabase
    .from('screens')
    .select('id, name, organization_id')
    .order('name')

  if (scrErr || !screens || screens.length === 0) {
    console.error('Failed to fetch screens:', scrErr)
    return
  }

  const orgId = screens[0].organization_id

  const { data: project, error: pErr } = await supabase
    .from('projects')
    .insert({
      organization_id: orgId,
      name: 'Night Broadcast (7PM-8PM)',
      is_active: true,
    })
    .select()
    .single()

  if (pErr) {
    console.error('Failed to create project:', pErr)
    return
  }
  console.log(`Created: ${project.name} (${project.id})`)

  const bindings = screens.map(s => ({
    screen_id: s.id,
    project_id: project.id,
    organization_id: orgId,
    schedule_type: 'scheduled',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    start_time: '19:00',
    end_time: '20:00',
    priority: 10,
    is_active: true,
    sort_order: 2,
  }))

  const { error: bindErr } = await supabase
    .from('screen_projects')
    .insert(bindings)

  if (bindErr) {
    console.error('Failed to bind:', bindErr)
    return
  }

  console.log(`Bound to all ${screens.length} screens (19:00-20:00 UTC daily)`)
}

run()
