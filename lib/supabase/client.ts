import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton — reuse the same client instance across the whole browser session.
// Creating multiple instances causes auth lock contention (AbortError: Lock broken
// by another request with the 'steal' option) because each client tries to manage
// the auth token refresh independently via the Web Locks API.
let _client: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return _client
}
