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
