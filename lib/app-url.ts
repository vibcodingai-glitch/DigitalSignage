/**
 * Returns the base app URL for generating display URLs.
 * Uses NEXT_PUBLIC_APP_URL in server/build contexts,
 * falls back to window.location.origin on the client.
 *
 * Usage:
 *   import { getAppUrl, getDisplayUrl } from "@/lib/app-url"
 *   const url = getDisplayUrl(screen.display_key)
 */

export function getAppUrl(): string {
    // Prefer env var (set in Vercel / .env.local)
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
    }
    // Client-side fallback
    if (typeof window !== "undefined") {
        return window.location.origin
    }
    return "http://localhost:3000"
}

export function getDisplayUrl(displayKey: string): string {
    return `${getAppUrl()}/display/${displayKey}`
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "SignageHub"
