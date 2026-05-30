export function getTransitionClass(transition: string) {
    switch (transition) {
        case 'fade': return 'animate-in fade-in duration-700 fill-mode-forwards'
        case 'slide-left': return 'animate-in slide-in-from-right-full duration-700 fill-mode-forwards'
        case 'slide-right': return 'animate-in slide-in-from-left-full duration-700 fill-mode-forwards'
        case 'zoom': return 'animate-in zoom-in-95 fade-in duration-700 fill-mode-forwards'
        case 'none':
        default: return ''
    }
}

export function getProxiedUrl(url: string, appUrl: string): string {
    // Only proxy external URLs, not same-origin
    try {
        const urlObj = new URL(url)
        
        // 1. PowerBI — always use the original URL directly.
        if (urlObj.hostname.includes('powerbi.com')) {
            return url  // pass through untouched
        }

        // 2. Tableau Public — use their native embed URL directly
        if (urlObj.hostname.includes('tableau.com')) {
            const match = urlObj.pathname.match(/\/viz\/([^/]+)\/([^/]+)/)
            if (match) {
                return `https://public.tableau.com/views/${match[1]}/${match[2]}?:embed=y&:showVizHome=no&:toolbar=no`
            }
            if (urlObj.pathname.startsWith('/views/')) {
                urlObj.searchParams.set(':embed', 'y')
                urlObj.searchParams.set(':showVizHome', 'no')
                urlObj.searchParams.set(':toolbar', 'no')
                return urlObj.toString()
            }
            return url
        }

        // 3. Same-origin check
        if (!appUrl) return url;
        const appUrlObj = new URL(appUrl)
        if (urlObj.origin === appUrlObj.origin) {
            return url
        }

        // 4. External URL — proxy it to strip X-Frame-Options
        return `${appUrl}/api/proxy?url=${encodeURIComponent(url)}`
    } catch {
        return url
    }
}

export function saveToCache(key: string, data: any) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(`display-cache-${key}`, JSON.stringify(data))
    } catch (e) {
        console.error('Failed to save to cache', e)
    }
}

export function loadFromCache(key: string) {
    if (typeof window === 'undefined') return null
    try {
        const item = localStorage.getItem(`display-cache-${key}`)
        return item ? JSON.parse(item) : null
    } catch (e) {
        console.error('Failed to load from cache', e)
        return null
    }
}

import type { PlaylistItem } from '@/types/display'

export function isPlaylistItemValid(item: PlaylistItem): boolean {
    const now = new Date()

    // 1. Validity Dates
    if (item.valid_from) {
        const from = new Date(item.valid_from)
        if (now < from) return false
    }
    if (item.valid_until) {
        const until = new Date(item.valid_until)
        if (now > until) return false
    }

    // 2. Days of week (0 = Sunday in JS, but let's assume 1-7 (Mon-Sun) or 0-6 like JS)
    if (item.days_of_week && item.days_of_week.length > 0) {
        const dow = now.getDay() // 0-6 (Sun-Sat)
        if (!item.days_of_week.includes(dow)) {
            return false
        }
    }

    // 3. Day-Parting (Time)
    if (item.day_part_start || item.day_part_end) {
        const currentHours = now.getHours()
        const currentMinutes = now.getMinutes()
        const currentTotalMins = currentHours * 60 + currentMinutes

        if (item.day_part_start) {
            const [h, m] = item.day_part_start.split(':').map(Number)
            const startMins = h * 60 + m
            if (currentTotalMins < startMins) return false
        }

        if (item.day_part_end) {
            const [h, m] = item.day_part_end.split(':').map(Number)
            const endMins = h * 60 + m
            if (currentTotalMins > endMins) return false
        }
    }

    return true
}
