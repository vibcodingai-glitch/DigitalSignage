/**
 * Supabase Service Role Client — server-side only.
 *
 * Uses the service role key to bypass RLS completely.
 * ⚠️  NEVER import this file in client components or browser code.
 *
 * Use cases:
 * - Server Components fetching data for SSR
 * - API routes that need admin-level access
 * - Background jobs / cron tasks
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let _serviceClient: ReturnType<typeof createSupabaseClient> | null = null

export function createServiceClient() {
    if (_serviceClient) return _serviceClient

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — cannot create service role client')
    }

    _serviceClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                // Service role doesn't need session management
                persistSession: false,
                autoRefreshToken: false,
            },
        }
    )

    return _serviceClient
}
