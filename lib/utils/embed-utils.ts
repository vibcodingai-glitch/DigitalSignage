// Detect Tableau URLs
export function isTableauUrl(url: string): boolean {
    try { return new URL(url).hostname.includes('tableau.com') } catch { return false }
}

// Convert Tableau profile URL → embeddable /views/ URL
// e.g. /app/profile/user/viz/Workbook/Sheet → /views/Workbook/Sheet
export function getTableauViewsUrl(url: string): string {
    try {
        const match = url.match(/\/viz\/([^/?#]+)\/([^/?#]+)/)
        if (match) return `https://public.tableau.com/views/${match[1]}/${match[2]}`
        return url
    } catch { return url }
}

// Auto-transform other dashboard URLs to embeddable variants.
export function getEmbedUrl(url: string): string {
    try {
        const u = new URL(url)
        // PowerBI: add embedview action if missing
        if (u.hostname.includes('powerbi.com')) {
            if (!u.searchParams.has('action')) u.searchParams.set('action', 'embedview')
            if (!u.searchParams.has('chromeless')) u.searchParams.set('chromeless', '1')
            return u.toString()
        }
        return url
    } catch { return url }
}

export function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes'
    const k = 1024, dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
