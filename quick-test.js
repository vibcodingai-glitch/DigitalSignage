const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: { user, session }, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@signagehub.com',
    password: 'password123'
  });
  
  if (authError) {
    console.log("Auth failed:", authError.message);
    return;
  }
  
  console.log("Got session token");
  const token = session.access_token;
  
  const t0 = Date.now();
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/projects?select=*,screen:screens!projects_screen_id_fkey(id,name),playlist_items(id,duration_override,content_item:content_items(duration_seconds)),schedules(id)&order=created_at.desc`, {
    headers: {
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  
  const text = await res.text();
  console.log(`Took ${Date.now() - t0}ms`);
  console.log(text.substring(0, 100));
}

run();
