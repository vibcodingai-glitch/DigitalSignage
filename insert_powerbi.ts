import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  // Get the organization
  const { data: org, error: orgError } = await supabase.from('organizations').select('id').limit(1).single()
  if (orgError) {
    console.error('Error fetching org:', orgError)
    return
  }
  
  const orgId = org.id

  const items = [
    {
      name: 'Sell-In Evolution',
      type: 'powerbi_frame',
      source_url: 'https://app.powerbi.com/groups/cde61768-d720-4376-85b6-32ee6c7dba80/reports/fb7f1f53-aa3e-4b13-82bc-81a5a68859a8/ReportSection0e010d31ba46cf653ea9?experience=power-bi',
      duration_seconds: 30 * 60,
      organization_id: orgId
    },
    {
      name: 'Sell-In Evolution _ Region',
      type: 'powerbi_frame',
      source_url: 'https://app.powerbi.com/groups/cde61768-d720-4376-85b6-32ee6c7dba80/reports/fb7f1f53-aa3e-4b13-82bc-81a5a68859a8/95b66adee40e56d58667?experience=power-bi',
      duration_seconds: 10 * 60,
      organization_id: orgId
    },
    {
      name: 'Availability Dashboard',
      type: 'powerbi_frame',
      source_url: 'https://app.powerbi.com/groups/me/reports/18ccbdb7-3190-44b4-b11e-f96896c52588/ReportSection70efa0382a696e90ed9a?experience=power-bi',
      duration_seconds: 30 * 60,
      organization_id: orgId
    },
    {
      name: 'Availability Dashboard_ Index',
      type: 'powerbi_frame',
      source_url: 'https://app.powerbi.com/groups/me/reports/18ccbdb7-3190-44b4-b11e-f96896c52588/ReportSection15351c858899201ed3c9?experience=power-bi',
      duration_seconds: 10 * 60,
      organization_id: orgId
    },
    {
      name: 'Production View 1',
      type: 'powerbi_frame',
      source_url: 'https://app.powerbi.com/groups/cde61768-d720-4376-85b6-32ee6c7dba80/reports/e09a475f-8a8b-459c-b124-0131874ce0d1/24244b6e5ad60a5871eb?experience=power-bi',
      duration_seconds: 30 * 60,
      organization_id: orgId
    },
    {
      name: 'Production View 2',
      type: 'powerbi_frame',
      source_url: 'https://app.powerbi.com/groups/cde61768-d720-4376-85b6-32ee6c7dba80/reports/e09a475f-8a8b-459c-b124-0131874ce0d1/6e3f200772aa1482a6d5?experience=power-bi',
      duration_seconds: 10 * 60,
      organization_id: orgId
    },
    {
      name: 'Production View 3',
      type: 'powerbi_frame',
      source_url: 'https://app.powerbi.com/groups/cde61768-d720-4376-85b6-32ee6c7dba80/reports/e09a475f-8a8b-459c-b124-0131874ce0d1/66bcad07b006b300c622?experience=power-bi',
      duration_seconds: 10 * 60,
      organization_id: orgId
    }
  ]

  console.log(`Inserting ${items.length} PowerBI links into content_items...`)

  const { data, error } = await supabase
    .from('content_items')
    .insert(items)
    .select()

  if (error) {
    console.error('Error inserting items:', error)
  } else {
    console.log('Successfully inserted items:')
    data.forEach(d => console.log(`- ${d.name} (${d.duration_seconds}s)`))
  }
}

run()
