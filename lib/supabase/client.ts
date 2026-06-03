import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton — reuse the same client instance across the whole browser session.
// Creating multiple instances causes auth lock contention (AbortError: Lock broken
// by another request with the 'steal' option) because each client tries to manage
// the auth token refresh independently via the Web Locks API.
let _client: SupabaseClient | null = null

/**
 * A fetch wrapper that adds a hard timeout to every request.
 * This prevents the Supabase client from hanging indefinitely
 * when the auth token refresh deadlocks (Web Locks API issue).
 */
function fetchWithTimeout(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const existingSignal = options?.signal

  // Merge existing signal with our timeout signal
  if (existingSignal) {
    existingSignal.addEventListener('abort', () => controller.abort(existingSignal.reason))
  }

  const timeout = setTimeout(() => controller.abort('Request timeout after 15s'), 15000)

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout))
}

export function createClient(): SupabaseClient {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: fetchWithTimeout,
      },
    }
  )
  return _client
}
