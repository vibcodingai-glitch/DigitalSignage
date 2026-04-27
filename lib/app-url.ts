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
    // 1. Client-side: Always use the actual current origin to guarantee correct URLs
    if (typeof window !== "undefined") {
        return window.location.origin
    }

    // 2. Server-side: Try user-defined custom domain
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
    }

    // 3. Server-side: Try Vercel auto-generated system URL
    if (process.env.NEXT_PUBLIC_VERCEL_URL) {
        return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    }
    
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`
    }

    // 4. Local dev fallback
    return "http://localhost:3000"
}

export function getDisplayUrl(displayKey: string): string {
    return `${getAppUrl()}/display/${displayKey}`
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "SignageHub"
