import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  // Simulate anon-key (RLS) performance — this is what the client sees
  console.log('Testing with ANON key (client-side RLS)...\n');
  
  // First, sign in
  const { data: profiles } = await supabase.from('profiles').select('organization_id').limit(1);
  console.log('profiles result:', profiles?.length || 0, 'rows');
  
  // Simulate the screen detail page fetching  
  const { data: screens } = await supabase.from('screens').select('id').limit(1);
  if (!screens?.length) { console.log('No screens found'); return; }
  
  const screenId = screens[0].id;
  console.log('Screen:', screenId);
  
  // Test the screen detail query
  const start = Date.now();
  const { data: screenData, error } = await supabase
    .from('screens')
    .select('*, location:locations(id, name, timezone)')
    .eq('id', screenId)
    .single();
  console.log(`Screen fetch: ${Date.now() - start}ms (error: ${error?.message || 'none'})`);
  
  if (!screenData) { console.log('No screen data'); return; }
  
  // Test parallel batch
  const start2 = Date.now();
  const [r1, r2, r3, r4] = await Promise.all([
    supabase.from('locations').select('id, name').eq('organization_id', screenData.organization_id).order('name'),
    supabase.from('projects').select('*').eq('organization_id', screenData.organization_id).order('created_at', { ascending: false }),
    supabase.from('screen_logs').select('*').eq('screen_id', screenId).order('created_at', { ascending: false }).limit(20),
    supabase.from('push_events').select('*, created_by:profiles(full_name)').eq('screen_id', screenId).order('created_at', { ascending: false }).limit(10),
  ]);
  console.log(`Parallel batch: ${Date.now() - start2}ms`);
  console.log(`  locations: ${r1.data?.length}, projects: ${r2.data?.length}, logs: ${r3.data?.length}, events: ${r4.data?.length}`);
  console.log(`  errors: ${r1.error?.message || 'none'}, ${r2.error?.message || 'none'}, ${r3.error?.message || 'none'}, ${r4.error?.message || 'none'}`);
  
  console.log(`\nTotal (client-side): ${Date.now() - start}ms`);
}

main();
