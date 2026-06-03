import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'content_type' }).catch(() => ({ error: 'rpc missing' }));
  console.log("RPC attempt:", data, error);
  
  // Alternative query using raw SQL if RPC is missing
  const { data: enumData, error: enumError } = await supabase.from('content_items').select('type').limit(1);
  console.log("Sample type:", enumData);
}
main();
