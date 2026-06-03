import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: locations } = await supabase.from('locations').select('id, name');
  console.log("Locations:", locations?.filter(l => l.name.includes("CWAR")));

  const { data: projects } = await supabase.from('projects').select('id, name');
  console.log("Projects:", projects?.filter(p => p.name.includes("CWAR")));
}
main();
