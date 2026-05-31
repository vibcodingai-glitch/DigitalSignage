import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data, count, error } = await supabase
    .from('content_items')
    .select('*', { count: 'exact', head: true });

  console.log("Count:", count);
  console.log("Error:", error);
}

test();
