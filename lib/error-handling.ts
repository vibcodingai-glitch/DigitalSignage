/**
 * Supabase query helper with consistent error handling.
 * - Surfaces user-friendly messages
 * - Detects session expiry and redirects to login
 * - Optional toast notifications
 */

import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

// Map raw Supabase/Postgres error codes to friendly messages
const FRIENDLY_ERRORS: Record<string, string> = {
    "23505": "A record with that name or identifier already exists.",
    "23503": "This record is referenced by other data and cannot be deleted.",
    "42501": "You don't have permission to perform this action.",
    "PGRST116": "Record not found.",
    "PGRST301": "Your session has expired. Please sign in again.",
    "invalid_credentials": "Incorrect email or password.",
    "email_not_confirmed": "Please verify your email before signing in.",
    "rate_limit": "Too many requests. Please wait a moment.",
}

export function getFriendlyError(error: unknown): string {
    if (!error) return "An unknown error occurred."

    const err = error as { code?: string; message?: string; status?: number }

    // Check code map
    if (err.code && FRIENDLY_ERRORS[err.code]) {
        return FRIENDLY_ERRORS[err.code]
    }

    // Raw message cleanup
    const msg = err.message || ""

    if (msg.includes("JWT expired") || msg.includes("session_expired")) {
        return "Your session has expired. Please sign in again."
    }
    if (msg.includes("Network request failed") || msg.includes("fetch")) {
        return "Network error. Check your connection and try again."
    }
    if (msg.includes("duplicate key") || msg.includes("unique")) {
        return "A record with this identifier already exists."
    }
    if (msg.includes("permission denied") || msg.includes("access denied")) {
        return "You don't have permission to perform this action."
    }
    if (msg.includes("foreign key")) {
        return "This record is referenced by other data and cannot be deleted."
    }

    return msg || "Something went wrong. Please try again."
}

/**
 * Check if the error is a session expiry and redirect to login.
 * Returns true if session was expired (caller should stop processing).
 */
export function handleSessionExpiry(
    error: unknown,
    router?: AppRouterInstance
): boolean {
    const err = error as { message?: string; code?: string; status?: number }
    const isExpired =
        err?.message?.includes("JWT expired") ||
        err?.message?.includes("session_expired") ||
        err?.code === "PGRST301" ||
        err?.status === 401

    if (isExpired && router) {
        router.push("/login?reason=session_expired")
        return true
    }

    return false
}

/**
 * Wraps an async Supabase operation with retry logic on transient errors.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 2,
    delayMs = 800
): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn()
        } catch (err) {
            lastError = err
            const isTransient =
                (err as Error)?.message?.includes("Network") ||
                (err as Error)?.message?.includes("timeout") ||
                (err as Error)?.message?.includes("fetch")

            if (!isTransient || attempt === retries) break
            await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)))
        }
    }

    throw lastError
}

/**
 * Check if content is used in any playlist before deletion.
 * Pass supabase client and content_item_id.
 */
export async function checkContentInUse(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    contentItemId: string
): Promise<{ inUse: boolean; count: number; projects: string[] }> {
    const { data, error } = await supabase
        .from('playlist_items')
        .select('id, project:projects(name)')
        .eq('content_item_id', contentItemId)

    if (error || !data) return { inUse: false, count: 0, projects: [] }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projects = Array.from(new Set(data.map((d: any) => d.project?.name).filter(Boolean))) as string[]
    return { inUse: data.length > 0, count: data.length, projects }
}
