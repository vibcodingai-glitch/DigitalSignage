import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function test() {
  const { data, error } = await supabase
    .from('content_items')
    .select('id, name, type, thumbnail_url, duration_seconds, created_at, organization_id, source_url, file_path, metadata')
    .limit(5);

  console.log("Data:", data);
  console.log("Error:", error);
}

test();
