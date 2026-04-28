"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { MonitorPlay, WifiOff, AlertTriangle, ExternalLink } from "lucide-react"
import { resolveActiveProject } from "@/lib/screen-projects"
import { usePowerBIRelay } from "@/hooks/use-powerbi-relay"

// ==============================================================
// TYPES
// ==============================================================

type ContentType = 'image' | 'video' | 'audio' | 'url' | 'webpage' | 'powerbi' | 'powerbi_frame' | 'dashboard' | 'html_snippet'

interface ContentItem {
    id: string
    name: string
    type: ContentType
    source_url: string | null
    file_path: string | null
    thumbnail_url: string | null
    duration_seconds: number
    metadata: Record<string, unknown>
}

interface PlaylistItem {
    id: string
    order_index: number
    duration_override: number | null
    transition_type: string | null
    content_item: ContentItem
    zone_index: number
}

interface Project {
    id: string
    name: string
    settings: {
        loop?: boolean
        transition_type?: string
        default_duration?: number
    }
    layout_type: 'fullscreen' | 'split_horizontal' | 'split_vertical' | 'l_shape' | 'grid_2x2' | 'main_ticker'
    layout_settings: Record<string, any>
}

interface Screen {
    id: string
    display_key: string
    name: string
    status: string
    active_project_id: string | null
    location_id: string | null
    current_state?: Record<string, unknown>
}

interface PushOverlay {
    type: 'alert' | 'override' | 'sound'
    message?: string
    duration?: number
    content_item?: ContentItem
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

// ==============================================================
// CACHE KEY
// ==============================================================
const CACHE_KEY_PREFIX = 'signage_cache_'

function buildCacheKey(displayKey: string) {
    return `${CACHE_KEY_PREFIX}${displayKey}`
}

function saveToCache(displayKey: string, data: { screen: Screen; project: Project; playlist: PlaylistItem[] }) {
    try {
        localStorage.setItem(buildCacheKey(displayKey), JSON.stringify({ ...data, cachedAt: Date.now() }))
    } catch { }
}

function loadFromCache(displayKey: string): { screen: Screen; project: Project; playlist: PlaylistItem[] } | null {
    try {
        const raw = localStorage.getItem(buildCacheKey(displayKey))
        if (!raw) return null
        return JSON.parse(raw)
    } catch {
        return null
    }
}

// ==============================================================
// TRANSITION CLASSES
// ==============================================================
function getTransitionClass(transition: string) {
    switch (transition) {
        case 'fade': return 'animate-in fade-in duration-700 fill-mode-forwards'
        case 'slide-left': return 'animate-in slide-in-from-right-full duration-700 fill-mode-forwards'
        case 'slide-right': return 'animate-in slide-in-from-left-full duration-700 fill-mode-forwards'
        case 'zoom': return 'animate-in zoom-in-95 fade-in duration-700 fill-mode-forwards'
        case 'none':
        default: return ''
    }
}

// ==============================================================
// PROXY HELPER
// ==============================================================
function getProxiedUrl(url: string, appUrl: string): string {
    // Only proxy external URLs, not same-origin
    try {
        const urlObj = new URL(url)
        
        // 1. PowerBI — always use the original URL directly.
        // DO NOT convert to reportEmbed format because:
        // - groupId=me is not valid for the reportEmbed API (causes 404)
        // - The browser's existing Microsoft session handles auth automatically
        // - Converting breaks the login redirect flow
        if (urlObj.hostname.includes('powerbi.com')) {
            return url  // pass through untouched — let the browser + session handle it
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

// ==============================================================
// TABLEAU EMBED COMPONENT
// A specialized wrapper for the Tableau Embedding API v3 that
// automatically fills 100% of its container with no fixed-pixel
// constraints imposed by the workbook author's size settings.
// ==============================================================
function TableauVizEmbed({ url, onLoaded }: { url: string, onLoaded?: () => void }) {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Inject global style to force Tableau's internal shadowing to be full screen
        const styleId = 'tableau-fullscreen-fix'
        if (!document.getElementById(styleId)) {
            const s = document.createElement('style')
            s.id = styleId
            s.innerHTML = `
                tableau-viz, .tableau-viz-container { width: 100vw !important; height: 100vh !important; }
                iframe { border: none !important; width: 100% !important; height: 100% !important; }
            `
            document.head.appendChild(s)
        }
        
        const container = containerRef.current
        const renderViz = () => {
            if (!container) return
            container.innerHTML = ''
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const viz: any = document.createElement('tableau-viz')

            // Convert profile/viz URL to embeddable /views/ format
            let embedUrl = url
            try {
                const u = new URL(url)
                const match = u.pathname.match(/\/viz\/([^/]+)\/([^/]+)/)
                if (match) {
                    embedUrl = `https://public.tableau.com/views/${match[1]}/${match[2]}?:embed=y&:showVizHome=no&:toolbar=no`
                } else if (u.pathname.startsWith('/views/')) {
                    u.searchParams.set(':embed', 'y')
                    u.searchParams.set(':showVizHome', 'no')
                    u.searchParams.set(':toolbar', 'no')
                    embedUrl = u.toString()
                }
            } catch { /* use url as-is */ }

            viz.setAttribute('src', embedUrl)
            viz.setAttribute('sizing', 'automatic')
            viz.setAttribute('toolbar', 'no')
            viz.setAttribute('hide-tabs', '')
            viz.style.cssText = 'width:100%;height:100%;display:block;margin:0;padding:0;'
            
            // Call onLoaded when the viz is appended (or slightly after)
            container.appendChild(viz)
            if (onLoaded) setTimeout(onLoaded, 500)
        }

        // If the API custom element is already registered, render immediately
        if (typeof customElements !== 'undefined' && customElements.get('tableau-viz')) {
            renderViz()
            return
        }

        // Avoid loading the script more than once
        const scriptId = 'tableau-embedding-api-v3'
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script')
            script.id = scriptId
            script.type = 'module'
            script.src = 'https://public.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js'
            script.onload = renderViz
            document.head.appendChild(script)
        } else {
            // Script tag exists but may still be loading
            const wait = setInterval(() => {
                if (typeof customElements !== 'undefined' && customElements.get('tableau-viz')) {
                    clearInterval(wait)
                    renderViz()
                }
            }, 100)
            return () => clearInterval(wait)
        }

        return () => { container.innerHTML = '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url])

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'block' }}
        />
    )
}

// ==============================================================
// POWERBI IFRAME RENDERER
// Microsoft's OAuth flow is intentionally blocked inside iframes
// (anti-clickjacking). This component detects the auth redirect
// and surfaces a "Sign in" button that opens a real browser tab,
// then lets the user retry the iframe once they're authenticated.
// ==============================================================


// ==============================================================
// CONTENT RENDERER SUB-COMPONENT
// ==============================================================
function ContentRenderer({
    item,
    defaultTransition,
    onEnded,
    onError,
    isMuted,
}: {
    item: PlaylistItem
    defaultTransition: string
    onEnded: () => void
    onError: (itemId: string) => void
    isMuted: boolean
}) {
    const type = item.content_item.type
    let src = item.content_item.source_url || item.content_item.file_path || ''
    
    // Auto-transform PowerBI URLs for proper iframe embedding
    if (type === 'powerbi_frame' && src.includes('powerbi.com')) {
        try {
            const u = new URL(src)
            
            // 1. Detect Standard Browser URL: /groups/{gid}/reports/{rid}
            const reportMatch = u.pathname.match(/\/groups\/([^/]+)\/reports\/([^/]+)/)
            const appReportMatch = u.pathname.match(/\/groups\/([^/]+)\/apps\/([^/]+)\/reports\/([^/]+)/)
            
            let groupId = ''
            let reportId = ''
            
            if (reportMatch) {
                groupId = reportMatch[1]
                reportId = reportMatch[2]
            } else if (appReportMatch) {
                groupId = appReportMatch[1]
                reportId = appReportMatch[3]
            }

            if (reportId) {
                // Construct official Microsoft Embed URL
                // Note: 'me' is a valid shortcut for personal workspace in the browser, 
                // but the embed API often prefers the actual UUID or just omitting it.
                const embedUrl = new URL('https://app.powerbi.com/reportEmbed')
                embedUrl.searchParams.set('reportId', reportId)
                if (groupId && groupId !== 'me') embedUrl.searchParams.set('groupId', groupId)
                embedUrl.searchParams.set('autoAuth', 'true')
                embedUrl.searchParams.set('ctid', u.searchParams.get('ctid') || '')
                embedUrl.searchParams.set('chromeless', '1')
                src = embedUrl.toString()
            } else {
                // Fallback: Just ensure parameters are there if it's already an embed link
                if (!u.searchParams.has('action')) u.searchParams.set('action', 'embedview')
                if (!u.searchParams.has('chromeless')) u.searchParams.set('chromeless', '1')
                if (!u.searchParams.has('autoAuth')) u.searchParams.set('autoAuth', 'true')
                src = u.toString()
            }
        } catch {}
    }

    const transition = item.transition_type || defaultTransition || 'fade'
    const transitionClass = getTransitionClass(transition)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [iframeError, setIframeError] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // Detect blank/blocked proxy pages.
    // IMPORTANT: For PowerBI and Microsoft domains we must NOT treat cross-origin
    // exceptions as errors — the sign-in page IS cross-origin by design.
    const handleIframeLoad = useCallback(() => {
        setIsLoading(false)
        // Skip body inspection for known auth/embed domains that are intentionally cross-origin
        const isPowerBIOrMS = src.includes('powerbi.com') || src.includes('microsoft.com') || src.includes('microsoftonline.com')
        if (isPowerBIOrMS) return

        try {
            const doc = iframeRef.current?.contentDocument
            if (!doc) return
            const body = doc.body?.innerHTML?.trim() ?? ''
            // Blank body = Google/similar blocked the embed through redirect or empty page
            if (body.length < 50) {
                console.warn('[Display] Iframe body too small — treating as blocked:', src)
                setIframeError(true)
            }
        } catch {
            // Cross-origin exception for non-PowerBI = content loaded from original domain without proxy
            setIframeError(true)
        }
    }, [src])

    // Reset loading state when item changes
    useEffect(() => {
        setIsLoading(true)
        setIframeError(false)
    }, [item.id])

    // Video: advance on ended
    useEffect(() => {
        const vid = videoRef.current
        if (!vid) return
        vid.muted = isMuted
        const handler = () => onEnded()
        vid.addEventListener('ended', handler)
        return () => vid.removeEventListener('ended', handler)
    }, [onEnded, isMuted])

    // Image error handler
    const handleImageError = useCallback(() => {
        console.warn('[Display] Image failed to load:', src)
        setTimeout(onError, 500, item.id)
    }, [item.id, onError, src])

    const baseClass = `absolute inset-0 w-full h-full ${transitionClass}`

    if (type === 'image') {
        return (
            <div key={item.id} className={baseClass}>
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-950 z-10">
                        <MonitorPlay className="h-8 w-8 text-indigo-500/20 animate-pulse" />
                    </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={src}
                    alt=""
                    className="w-full h-full object-cover"
                    onLoad={() => setIsLoading(false)}
                    onError={handleImageError}
                />
            </div>
        )
    }

    if (type === 'video') {
        return (
            <div key={item.id} className={`${baseClass} bg-black`}>
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <MonitorPlay className="h-8 w-8 text-indigo-500/20 animate-pulse" />
                    </div>
                )}
                <video
                    ref={videoRef}
                    src={src}
                    className="w-full h-full object-contain"
                    autoPlay
                    muted={isMuted}
                    playsInline
                    onLoadedData={() => setIsLoading(false)}
                    onError={() => { console.warn('[Display] Video failed:', src); setTimeout(onError, 500, item.id) }}
                />
            </div>
        )
    }

    if (type === 'audio') {
        return (
            <div key={item.id} className={`${baseClass} bg-black flex flex-col items-center justify-center`}>
                <div className="relative flex items-center justify-center">
                    <div className="h-48 w-48 rounded-full border border-indigo-500/30 animate-[spin_10s_linear_infinite]" />
                    <div className="absolute h-36 w-36 rounded-full border border-purple-500/20 border-dashed animate-[spin_7s_linear_infinite_reverse]" />
                    <div className="absolute h-4 w-4 rounded-full bg-indigo-500 opacity-80 animate-pulse" />
                </div>
                <p className="text-white/40 font-mono uppercase tracking-widest text-xs mt-10">
                    {item.content_item.name}
                </p>
                <audio
                    src={src}
                    autoPlay
                    muted={isMuted}
                    onEnded={onEnded}
                    onError={() => setTimeout(onError, 500, item.id)}
                />
            </div>
        )
    }

    // powerbi_frame: direct iframe embed using the browser's existing session.
    // Requires Chrome launched with --disable-web-security to bypass X-Frame-Options.
    if (type === 'powerbi_frame') {
        return (
            <div key={item.id} className={`${baseClass} bg-black`}>
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                        <div className="h-8 w-8 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
                        <p className="text-yellow-400/60 text-xs font-mono">Loading PowerBI…</p>
                    </div>
                )}
                <iframe
                    key={src}
                    src={src}
                    className="w-full h-full border-none"
                    onLoad={() => setIsLoading(false)}
                    onError={() => setIsLoading(false)}
                    title={item.content_item.name}
                    allow="fullscreen"
                />
            </div>
        )
    }

    if (type === 'url' || type === 'webpage' || type === 'powerbi' || type === 'dashboard') {
        // Tableau URLs — use the Embedding API v3 for proper full-screen responsive sizing
        const isTableau = src.includes('tableau.com')
        if (isTableau) {
            return (
                <div key={item.id} className={`${baseClass} bg-gray-950`}>
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <MonitorPlay className="h-8 w-8 text-indigo-500/20 animate-pulse" />
                        </div>
                    )}
                    <TableauVizEmbed url={src} onLoaded={() => setIsLoading(false)} />
                </div>
            )
        }

        // All other embeddable URLs — proxy to strip X-Frame-Options
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : ''
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) 
            ? currentOrigin 
            : (process.env.NEXT_PUBLIC_APP_URL || currentOrigin)

        const iframeSrc = getProxiedUrl(src, appUrl)
        const isPowerBI = src.includes('powerbi.com') || type === 'powerbi'
        if (isPowerBI) return null // Handled by relay

        return (
            <div key={item.id} className={`${baseClass} bg-gray-950`}>
                {iframeError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-white gap-6">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
                            <div className="h-16 w-16 rounded-full bg-gray-900 border border-amber-500/30 flex items-center justify-center relative">
                                <AlertTriangle className="h-8 w-8 text-amber-500" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-lg font-semibold text-white/80">{item.content_item.name}</p>
                            <p className="text-sm text-gray-400 font-mono">This URL cannot be embedded</p>
                            <p className="text-xs text-gray-600 font-mono max-w-sm text-center break-all px-6">{src}</p>
                        </div>
                    </div>
                ) : (
                    <iframe
                        ref={iframeRef}
                        src={iframeSrc}
                        className="w-full h-full border-none"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-top-navigation allow-top-navigation-by-user-activation allow-popups-to-escape-sandbox"
                        onError={() => setIframeError(true)}
                        onLoad={handleIframeLoad}
                        title={item.content_item.name}
                    />
                )}
            </div>
        )
    }

    if (type === 'html_snippet') {
        const rawHtml = (item.content_item.metadata?.raw_html as string) || src || ''
        return (
            <div
                key={item.id}
                className={`${baseClass} bg-white text-black overflow-hidden`}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: rawHtml }}
            />
        )
    }

    return null
}

// ==============================================================
// ZONE RENDERERS
// ==============================================================
function ZoneRenderer({ 
    items, 
    project, 
    isMuted, 
    playerKey,
    onItemChange,
    onPowerBIShow,
    onPowerBIHide,
}: { 
    items: PlaylistItem[], 
    project: Project | null, 
    isMuted: boolean, 
    playerKey: number,
    onItemChange?: (index: number, item: PlaylistItem) => void,
    onPowerBIShow?: (url: string) => void,
    onPowerBIHide?: () => void
}) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [projectKey, setProjectKey] = useState(project?.id || 'none')
    const errorLogQueueRef = useRef<string[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const stuckTimerRef = useRef<NodeJS.Timeout | null>(null)
    const playlistRef = useRef(items)
    
    // Reset index when project changes
    useEffect(() => {
        if (project?.id && project.id !== projectKey) {
            console.log('[Display] Project changed, resetting index to 0')
            setProjectKey(project.id)
            setCurrentIndex(0)
        }
    }, [project?.id, projectKey])

    useEffect(() => { playlistRef.current = items }, [items])

    const advanceToNext = useCallback(() => {
        setCurrentIndex(prev => {
            const loop = project?.settings?.loop !== false
            const next = prev + 1
            if (next >= playlistRef.current.length) {
                console.log('[Display] Reached end of playlist, looping:', loop)
                return loop ? 0 : prev
            }
            console.log(`[Display] Advancing to item ${next + 1}/${playlistRef.current.length}`)
            return next
        })
    }, [project])

    useEffect(() => {
        if (items.length === 0) return
        const item = items[currentIndex]
        if (!item) {
            setCurrentIndex(0)
            return
        }

        console.log(`[Display] Playing item ${currentIndex + 1}: ${item.content_item.name}`)
        if (onItemChange) onItemChange(currentIndex, item)

        const durationMs = (item.duration_override || item.content_item.duration_seconds || 10) * 1000
        const stuckMs = durationMs * 3

        if (timerRef.current) clearTimeout(timerRef.current)
        if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current)

        // Handle PowerBI Relay — only for 'powerbi' type, NOT for 'powerbi_frame'
        const isPowerBI = item.content_item.type === 'powerbi' || (
            item.content_item.type === 'url' &&
            item.content_item.source_url?.includes('powerbi.com') &&
            item.content_item.type !== 'powerbi_frame'
        )
        if (isPowerBI && onPowerBIShow && item.content_item.source_url) {
            console.log('[Display] Triggering PowerBI Relay for:', item.content_item.source_url)
            onPowerBIShow(item.content_item.source_url)
        }

        const isVideo = item.content_item.type === 'video'
        if (!isVideo) {
            if (isPowerBI && onPowerBIHide) {
                // Fix: call hide() 300ms BEFORE advancing so relay fade-out is visible
                timerRef.current = setTimeout(() => {
                    onPowerBIHide()
                    setTimeout(advanceToNext, 300)
                }, Math.max(durationMs - 300, 0))
            } else {
                timerRef.current = setTimeout(advanceToNext, durationMs)
            }
        }

        stuckTimerRef.current = setTimeout(() => {
            console.warn('[Display] Stuck watchdog fired, advancing.')
            advanceToNext()
        }, stuckMs)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current)
        }
    }, [currentIndex, items, advanceToNext, onPowerBIShow, onPowerBIHide])

    useEffect(() => {
        if (items.length < 2) return
        const nextIdx = (currentIndex + 1) % items.length
        const next = items[nextIdx]
        if (next?.content_item.type === 'image' && next.content_item.source_url) {
            const img = new Image()
            img.src = next.content_item.source_url
        }
    }, [currentIndex, items])

    const handleContentError = useCallback((itemId: string) => {
        if (errorLogQueueRef.current.includes(itemId)) return
        errorLogQueueRef.current.push(itemId)
        advanceToNext()
    }, [advanceToNext])

    if (items.length === 0) return <div className="w-full h-full bg-black/50 border-gray-800/30" />

    const currentItem = items[currentIndex]

    return (
        <div className="w-full h-full relative overflow-hidden border border-gray-800/30">
            {currentItem && (
                <ContentRenderer
                    key={`${playerKey}-${currentIndex}-${currentItem.id}`}
                    item={currentItem}
                    defaultTransition={project?.settings?.transition_type || 'fade'}
                    onEnded={advanceToNext}
                    onError={handleContentError}
                    isMuted={isMuted}
                />
            )}
            {/* Overlay placeholder when PowerBI is active on the relay */}
            {(currentItem?.content_item.type === 'powerbi' || (currentItem?.content_item.type === 'url' && currentItem?.content_item.source_url?.includes('powerbi.com'))) && (
                <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center z-10">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 rounded-full bg-yellow-400/10 animate-ping" />
                        <div className="h-16 w-16 rounded-2xl bg-yellow-400/5 border border-yellow-400/20 flex items-center justify-center">
                            <MonitorPlay className="h-8 w-8 text-yellow-400/40" />
                        </div>
                    </div>
                    <p className="text-white/60 font-medium text-sm">PowerBI Active on Relay</p>
                    <p className="text-white/20 text-[10px] font-mono mt-1 uppercase tracking-widest">{currentItem.content_item.name}</p>
                </div>
            )}
        </div>
    )
}

function TickerZoneRenderer({ items, project, playerKey }: { items: PlaylistItem[], project: Project | null, playerKey: number }) {
    if (items.length === 0) return <div className="w-full h-full bg-black/50 border-gray-800/30" />

    const isTextLike = items[0].content_item.type === 'html_snippet'

    if (isTextLike) {
        const rawHtml = (items[0].content_item.metadata?.raw_html as string) || items[0].content_item.source_url || ''
        return (
            <div className="w-full h-full border border-gray-800/30 bg-black text-white flex items-center overflow-hidden">
                <style>{`
                    @keyframes scroll {
                        0% { transform: translateX(100vw); }
                        100% { transform: translateX(-100%); }
                    }
                    .animate-ticker {
                        display: inline-block;
                        white-space: nowrap;
                        animation: scroll 20s linear infinite;
                    }
                `}</style>
                <div className="animate-ticker" dangerouslySetInnerHTML={{ __html: rawHtml }} />
            </div>
        )
    }

    return <ZoneRenderer items={items} project={project} isMuted={true} playerKey={playerKey} />
}

// ==============================================================
// MAIN PAGE COMPONENT
// ==============================================================
export default function ScreenDisplayPage({ params }: { params: { screenId: string } }) {
    const supabase = createClient()

    // --- Core State ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [screen, setScreen] = useState<Screen | null>(null)
    const [project, setProject] = useState<Project | null>(null)
    const [playlist, setPlaylist] = useState<PlaylistItem[]>([])
    const [loadState, setLoadState] = useState<'booting' | 'loaded' | 'error' | 'no_project'>('booting')
    const [isOffline, setIsOffline] = useState(false)
    const [connStatus, setConnStatus] = useState<ConnectionStatus>('connecting')

    // --- Player State ---
    const [playerKey, setPlayerKey] = useState(0) // Bumped to force re-mount on playlist reload

    // --- UI State ---
    const [hideCursor, setHideCursor] = useState(false)
    const [showHint, setShowHint] = useState(true)
    const [pushOverlay, setPushOverlay] = useState<PushOverlay | null>(null)
    const [isMuted, setIsMuted] = useState(true)
    const [livePlayState, setLivePlayState] = useState<{ index: number, item: PlaylistItem | null }>({ index: 0, item: null })
    const [showRelayTrigger, setShowRelayTrigger] = useState(false)

    // --- PowerBI Relay ---
    const relay = usePowerBIRelay()

    // --- Uptime tracking ---
    const bootTimeRef = useRef<number>(Date.now())
    const playStateRef = useRef(livePlayState)
    
    useEffect(() => { playStateRef.current = livePlayState }, [livePlayState])

    // --- Refs ---
    const cursorTimerRef = useRef<NodeJS.Timeout | null>(null)
    const wakeLockRef = useRef<unknown>(null)
    const screenRef = useRef<Screen | null>(null)
    const projectRef = useRef<Project | null>(null)
    const playlistRef = useRef<PlaylistItem[]>([])

    // Keep refs in sync
    screenRef.current = screen
    projectRef.current = project
    playlistRef.current = playlist

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`)
            })
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
            }
        }
    }

    // ==============================================================
    // WAKE LOCK
    // ==============================================================
    const requestWakeLock = useCallback(async () => {
        if (typeof window === 'undefined' || !('wakeLock' in navigator)) return;
        
        // If we already have an active lock, don't request another one
        if (wakeLockRef.current) return;

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const lock = await (navigator as any).wakeLock.request('screen');
            
            // Handle the lock being released by the system
            lock.addEventListener('release', () => {
                wakeLockRef.current = null;
            });

            wakeLockRef.current = lock;
        } catch (err: any) {
            // Ignore AbortError as it's often caused by double-requests in dev mode
            if (err.name !== 'AbortError') {
                console.warn('[Display] WakeLock failed:', err.message);
            }
            wakeLockRef.current = null;
        }
    }, [])

    // ==============================================================
    // DATA LOADING
    // Uses server-side API route so RLS never blocks unauthenticated
    // display clients (kiosk hardware, Safari, non-logged-in browsers).
    // ==============================================================
    const loadSequence = useCallback(async (displayKey: string, silent = false, keepIndex = false) => {
        if (!silent) setLoadState('booting')

        try {
            const res = await fetch(`/api/display/${displayKey}`)

            if (!res.ok) {
                // Try local cache on network/server error
                const cached = loadFromCache(displayKey)
                if (cached) {
                    setScreen(cached.screen)
                    setProject(cached.project)
                    setPlaylist(cached.playlist)
                    setIsOffline(true)
                    setLoadState(cached.playlist?.length > 0 ? 'loaded' : 'no_project')
                    setPlayerKey(k => k + 1)
                    return
                }
                setLoadState(res.status === 404 ? 'error' : 'no_project')
                return
            }

            const { screen: screenData, project: projData, playlist: items } = await res.json()

            setIsOffline(false)
            setScreen(screenData as Screen)

            if (!projData) {
                setProject(null)
                setPlaylist([])
                setLoadState('no_project')
                saveToCache(displayKey, { screen: screenData as Screen, project: null!, playlist: [] })
                return
            }

            setProject(projData as Project)
            setPlaylist(items as PlaylistItem[])

            if (!keepIndex) {
                setPlayerKey(k => k + 1)
            }
            setLoadState(items.length > 0 ? 'loaded' : 'no_project')
            saveToCache(displayKey, { screen: screenData as Screen, project: projData as Project, playlist: items as PlaylistItem[] })

        } catch (err) {
            console.error('[Display] Load fault:', err)
            const cached = loadFromCache(displayKey)
            if (cached) {
                setScreen(cached.screen)
                setProject(cached.project)
                setPlaylist(cached.playlist)
                setIsOffline(true)
                setLoadState(cached.playlist?.length > 0 ? 'loaded' : 'no_project')
                setPlayerKey(k => k + 1)
            } else {
                setLoadState('error')
            }
        }
    // fetch is stable, no supabase dependency needed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ==============================================================
    // BOOT & KIOSK AUTO-RECOVERY
    // ==============================================================
    useEffect(() => {
        loadSequence(params.screenId)
        requestWakeLock()

        // Phase 7: Kiosk auto-open for PowerBI relay
        const urlParams = new URLSearchParams(window.location.search)
        if (urlParams.get('kiosk') === 'true') {
            console.log('[Kiosk] Auto-opening PowerBI relay on boot')
            relay.openRelay()
            setShowRelayTrigger(false)
        }

        // Re-acquire wake lock on visibility change
        const onVisChange = () => {
            if (document.visibilityState === 'visible') requestWakeLock()
        }
        document.addEventListener('visibilitychange', onVisChange)

        // Hide "Hardware Mode" hint
        const hintT = setTimeout(() => setShowHint(false), 5000)

        // Auto-recovery at 3:00 AM
        const scheduleDailyReload = () => {
            const now = new Date()
            const tomorrow3am = new Date()
            tomorrow3am.setHours(3, 0, 0, 0)
            if (tomorrow3am <= now) tomorrow3am.setDate(tomorrow3am.getDate() + 1)
            const msUntil = tomorrow3am.getTime() - now.getTime()
            return setTimeout(() => window.location.reload(), msUntil)
        }
        const reloadTimer = scheduleDailyReload()

        return () => {
            clearTimeout(hintT)
            clearTimeout(reloadTimer)
            document.removeEventListener('visibilitychange', onVisChange)
        }
    }, [params.screenId, loadSequence, requestWakeLock])

    // ==============================================================
    // CURSOR HIDING
    // ==============================================================
    useEffect(() => {
        const reset = () => {
            setHideCursor(false)
            if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current)
            cursorTimerRef.current = setTimeout(() => setHideCursor(true), 3000)
        }
        window.addEventListener('mousemove', reset)
        reset()
        return () => {
            window.removeEventListener('mousemove', reset)
            if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current)
        }
    }, [])

    // ==============================================================
    // HEARTBEAT — uses server-side API so any browser can report status
    // ==============================================================
    useEffect(() => {
        if (!screen) return

        const beat = async (statusVal?: string) => {
            try {
                const currentItem = playStateRef.current.item
                const uptimeSeconds = Math.floor((Date.now() - bootTimeRef.current) / 1000)

                const currentState = {
                    project_id: projectRef.current?.id ?? null,
                    project_name: projectRef.current?.name ?? null,
                    content_item_id: currentItem?.content_item?.id ?? null,
                    content_name: currentItem?.content_item?.name ?? null,
                    is_playing: playlistRef.current.length > 0,
                    playlist_position: playStateRef.current.index + 1,
                    total_playlist_items: playlistRef.current.length,
                    uptime_seconds: uptimeSeconds,
                }

                await fetch('/api/display/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        display_key: params.screenId,
                        status: statusVal || 'online',
                        current_state: currentState,
                    }),
                })
            } catch { /* non-critical */ }
        }

        beat('online')
        const iv = setInterval(() => beat(), 30_000)

        const onUnload = () => beat('offline')
        window.addEventListener('beforeunload', onUnload)

        return () => {
            clearInterval(iv)
            window.removeEventListener('beforeunload', onUnload)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen, params.screenId])

    // ==============================================================
    // SCHEDULE EVALUATION — runs every 60s
    // Re-fetches from the server-side API and switches project if changed.
    // ==============================================================
    useEffect(() => {
        if (!screen) return

        const evaluateSchedules = async () => {
            try {
                const res = await fetch(`/api/display/${params.screenId}`)
                if (!res.ok) return
                const { project: resolvedProject } = await res.json()
                const winningProjectId = resolvedProject?.id ?? null
                const currentProjectId = projectRef.current?.id || screenRef.current?.active_project_id

                if (winningProjectId && winningProjectId !== currentProjectId) {
                    console.log(`[Schedule] Switching to project ${winningProjectId} (was ${currentProjectId})`)
                    loadSequence(params.screenId, true, false)
                }
            } catch (err) {
                console.warn('[Schedule] Evaluation error:', err)
            }
        }

        // Run immediately on mount, then every 60s
        evaluateSchedules()
        const scheduleIv = setInterval(evaluateSchedules, 60_000)

        return () => clearInterval(scheduleIv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen, params.screenId, loadSequence])

    // ==============================================================
    // REALTIME SUBSCRIPTIONS
    // ==============================================================
    useEffect(() => {
        if (!screen) return
        // Realtime subscriptions
        let reconnectDelay = 1000
        let reconnectTimer: NodeJS.Timeout | null = null

        const setupChannel = () => {
            const channel = supabase.channel(`display-${screen.id}`)

            // Screen changes
            channel.on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'screens', filter: `id=eq.${screen.id}`
            }, (payload) => {
                if (payload.new.active_project_id !== screenRef.current?.active_project_id) {
                    loadSequence(params.screenId, true, false) // New project — restart from 0
                }
            })

            // Playlist mutations — keep current position
            if (project) {
                channel.on('postgres_changes', {
                    event: '*', schema: 'public', table: 'playlist_items', filter: `project_id=eq.${project.id}`
                }, () => {
                    loadSequence(params.screenId, true, true) // Smart refresh keeps index
                })
            }

            // screen_projects changes — re-evaluate active project immediately
            channel.on('postgres_changes', {
                event: '*', schema: 'public', table: 'screen_projects', filter: `screen_id=eq.${screen.id}`
            }, () => {
                console.log('[Display] screen_projects changed — re-evaluating active project')
                loadSequence(params.screenId, true, false)
            })

            // Push events — check expires_at before acting
            channel.on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'push_events', filter: `screen_id=eq.${screen.id}`
            }, (payload) => {
                const ev = payload.new
                // Ignore expired events (e.g. device was offline, came back to stale queue)
                if (ev.expires_at && new Date(ev.expires_at) < new Date()) {
                    console.log('[Display] Ignoring expired push event:', ev.id)
                    return
                }

                const pld = ev.payload || {}
                switch (ev.event_type) {
                    case 'reload': window.location.reload(); break
                    case 'show_alert':
                        setPushOverlay({ type: 'alert', message: pld.message || 'Alert from admin', duration: pld.duration || 8 })
                        setTimeout(() => setPushOverlay(null), (pld.duration || 8) * 1000)
                        break
                    case 'play_sound':
                        setPushOverlay({ type: 'sound' })
                        if (pld.url) {
                            const audio = new Audio(pld.url)
                            audio.play().catch(() => { })
                            audio.onended = () => setPushOverlay(null)
                        }
                        break
                    case 'override_content':
                        if (pld.content_item) {
                            setPushOverlay({ type: 'override', content_item: pld.content_item, duration: pld.duration || 30 })
                            setTimeout(() => setPushOverlay(null), (pld.duration || 30) * 1000)
                        }
                        break
                }
            })

            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setConnStatus('connected')
                    reconnectDelay = 1000 // Reset backoff on success
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setConnStatus('disconnected')
                    // Exponential backoff reconnect
                    if (reconnectTimer) clearTimeout(reconnectTimer)
                    reconnectTimer = setTimeout(() => {
                        reconnectDelay = Math.min(reconnectDelay * 2, 30000)
                        supabase.removeChannel(channel)
                        setupChannel()
                    }, reconnectDelay)
                }
            })

            return channel
        }

        const activeChannel = setupChannel()
        setConnStatus('connecting')

        return () => {
            if (reconnectTimer) clearTimeout(reconnectTimer)
            supabase.removeChannel(activeChannel)
        }
    }, [screen, project, params.screenId, loadSequence, supabase])



    // ==============================================================
    // DERIVED STATE — must be before any early returns (Rules of Hooks)
    // ==============================================================
    const itemsByZone = useMemo(() => {
        return playlist.reduce((acc, item) => {
            if (!acc[item.zone_index]) acc[item.zone_index] = []
            acc[item.zone_index].push(item)
            return acc
        }, {} as Record<number, PlaylistItem[]>)
    }, [playlist])

    const layoutType = project?.layout_type || 'fullscreen'

    // ==============================================================
    // RENDER STATES
    // ==============================================================
    if (loadState === 'error') {
        return (
            <div className={`w-screen h-screen bg-black flex items-center justify-center ${hideCursor ? 'cursor-none' : ''}`}>
                <div className="flex flex-col items-center text-center px-8">
                    <div className="h-16 w-16 rounded-full bg-red-900/30 border border-red-800 flex items-center justify-center mb-6">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-white font-bold text-xl mb-2">Endpoint Not Found</h1>
                    <p className="text-slate-500 text-sm font-mono">This display key is not registered in the network.</p>
                    <code className="text-slate-700 text-xs mt-4 bg-slate-900 px-3 py-1.5 rounded">{params.screenId}</code>
                </div>
            </div>
        )
    }

    if (loadState === 'booting') {
        return (
            <div className={`w-screen h-screen bg-black flex items-center justify-center ${hideCursor ? 'cursor-none' : ''}`}>
                <div className="flex flex-col items-center gap-6 animate-in fade-in duration-1000">
                    <div className="relative">
                        <div className="h-16 w-16 rounded-full border-2 border-indigo-500/30 animate-spin" style={{ borderTopColor: 'rgb(99,102,241)' }} />
                        <MonitorPlay className="h-6 w-6 text-indigo-400 absolute inset-0 m-auto" />
                    </div>
                    <p className="text-slate-600 text-xs font-mono uppercase tracking-widest">Initializing Display Node...</p>
                </div>
            </div>
        )
    }

    if (loadState === 'no_project') {
        return (
            <div className={`w-screen h-screen bg-black flex flex-col items-center justify-center overflow-hidden ${hideCursor ? 'cursor-none' : ''}`}>
                {/* Ambient gradient */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.08)_0%,transparent_70%)]" />

                {/* Floating particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute rounded-full bg-indigo-500/10"
                            style={{
                                width: `${8 + (i % 4) * 12}px`,
                                height: `${8 + (i % 4) * 12}px`,
                                left: `${(i * 17 + 5) % 95}%`,
                                top: `${(i * 23 + 10) % 90}%`,
                                animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
                                animationDelay: `${i * 0.3}s`
                            }}
                        />
                    ))}
                </div>

                <div className="z-10 flex flex-col items-center animate-in fade-in duration-2000">
                    <div className="relative mb-8">
                        <div className="h-24 w-24 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center backdrop-blur-sm">
                            <MonitorPlay className="h-10 w-10 text-indigo-400" />
                        </div>
                        <div className="absolute -inset-1 rounded-2xl bg-indigo-500/5 blur-xl animate-pulse" />
                    </div>

                    <h1 className="text-2xl font-light text-white/80 tracking-widest uppercase mb-3">
                        {screen?.name || 'Display Node'}
                    </h1>
                    <div className="flex items-center gap-2 text-slate-500">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <p className="text-xs font-mono uppercase tracking-wider">Awaiting Timeline Assignment...</p>
                    </div>
                </div>

                <div className="absolute bottom-6 right-6 text-[10px] text-slate-700 font-mono text-right space-y-1">
                    <p>{new Date().toLocaleDateString()} · SignageHub</p>
                    <p>Node: {screen?.display_key?.slice(0, 8)}</p>
                </div>

                {/* Connection dot */}
                <ConnectionDot status={connStatus} isOffline={isOffline} />
            </div>
        )
    }

    // ==============================================================
    // ACTIVE PLAYBACK
    // ==============================================================

    const renderLayout = () => {
        if (playlist.length === 0) {
            return (
                <div className="w-full h-full flex items-center justify-center">
                    <p className="text-slate-700 font-mono text-sm">Playlist is empty.</p>
                </div>
            )
        }

        switch (layoutType) {
            case 'split_horizontal':
                return (
                    <div className="grid grid-rows-2 w-full h-full gap-1">
                        {/* Zone 0 only gets relay — side zones must not cover the full screen */}
                        <ZoneRenderer items={itemsByZone[0] || []} project={project} isMuted={isMuted} playerKey={playerKey} onPowerBIShow={relay.showURL} onPowerBIHide={relay.hide} />
                        <ZoneRenderer items={itemsByZone[1] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                    </div>
                )
            case 'split_vertical':
                return (
                    <div className="grid grid-cols-2 w-full h-full gap-1">
                        <ZoneRenderer items={itemsByZone[0] || []} project={project} isMuted={isMuted} playerKey={playerKey} onPowerBIShow={relay.showURL} onPowerBIHide={relay.hide} />
                        <ZoneRenderer items={itemsByZone[1] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                    </div>
                )
            case 'l_shape':
                return (
                    <div className="grid grid-cols-[70%_30%] grid-rows-2 w-full h-full gap-1">
                        <div className="row-span-2">
                            <ZoneRenderer items={itemsByZone[0] || []} project={project} isMuted={isMuted} playerKey={playerKey} onPowerBIShow={relay.showURL} onPowerBIHide={relay.hide} />
                        </div>
                        <ZoneRenderer items={itemsByZone[1] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                        <ZoneRenderer items={itemsByZone[2] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                    </div>
                )
            case 'grid_2x2':
                return (
                    <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-1">
                        <ZoneRenderer items={itemsByZone[0] || []} project={project} isMuted={isMuted} playerKey={playerKey} onPowerBIShow={relay.showURL} onPowerBIHide={relay.hide} />
                        <ZoneRenderer items={itemsByZone[1] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                        <ZoneRenderer items={itemsByZone[2] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                        <ZoneRenderer items={itemsByZone[3] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                    </div>
                )
            case 'main_ticker':
                return (
                    <div className="grid grid-rows-[90%_10%] w-full h-full gap-1">
                        <ZoneRenderer items={itemsByZone[0] || []} project={project} isMuted={isMuted} playerKey={playerKey} onPowerBIShow={relay.showURL} onPowerBIHide={relay.hide} />
                        <TickerZoneRenderer items={itemsByZone[1] || []} project={project} playerKey={playerKey} />
                    </div>
                )
            case 'fullscreen':
            default:
                return (
                    <div className="w-full h-full">
                        <ZoneRenderer 
                            items={itemsByZone[0] || []} 
                            project={project} 
                            isMuted={isMuted} 
                            playerKey={playerKey} 
                            onItemChange={(index, item) => {
                                setLivePlayState({ index, item })
                                // If it's a PowerBI item, make sure we prompt to enable relay if not already open
                                if (item.content_item.type === 'powerbi' || (item.content_item.type === 'url' && item.content_item.source_url?.includes('powerbi.com'))) {
                                    setShowRelayTrigger(true)
                                }
                            }}
                            onPowerBIShow={relay.showURL}
                            onPowerBIHide={relay.hide}
                        />
                    </div>
                )
        }
    }

    return (
        <div className={`w-screen h-screen bg-black overflow-hidden relative ${hideCursor ? 'cursor-none' : ''}`}>

            {/* Hardware mode OSD hint */}
            <div className={`absolute top-5 left-1/2 -translate-x-1/2 z-50 transition-all duration-1000 ${showHint ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-white/50 text-xs font-mono uppercase tracking-widest flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Hardware Display Mode · F11 for Fullscreen
                </div>
            </div>

            {/* Fullscreen Button — appears on mouse move */}
            <button 
                onClick={toggleFullscreen}
                className={`fixed bottom-6 right-6 z-[100] p-3 rounded-full bg-slate-900/80 text-white backdrop-blur-md border border-white/20 transition-opacity duration-300 ${hideCursor ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                title="Toggle Fullscreen"
            >
                <MonitorPlay className="h-6 w-6" />
            </button>

            {/* PowerBI Relay Trigger — Browser security requires a user gesture to open a window */}
            {showRelayTrigger && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="bg-[#111827] border border-yellow-400/20 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
                        <div className="h-20 w-20 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center mx-auto mb-6">
                            <ExternalLink className="h-10 w-10 text-yellow-400" />
                        </div>
                        <h2 className="text-white text-2xl font-bold mb-2">PowerBI Ready</h2>
                        <p className="text-slate-400 text-sm mb-8">
                            This project contains PowerBI content. Click below to enable the display relay. This only needs to be done once.
                        </p>
                        <button
                            onClick={() => {
                                relay.openRelay()
                                setShowRelayTrigger(false)
                            }}
                            className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-2xl transition-all shadow-lg shadow-yellow-400/20 flex items-center justify-center gap-2"
                        >
                            Enable PowerBI Display
                        </button>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT LAYER */}
            {renderLayout()}

            {/* PUSH EVENT — Alert Banner */}
            {pushOverlay?.type === 'alert' && (
                <div className="absolute inset-x-0 top-0 z-50 flex items-start justify-center p-6 animate-in slide-in-from-top-4 duration-500">
                    <div className="bg-amber-500 text-black font-bold text-lg px-8 py-4 rounded-xl shadow-2xl max-w-2xl text-center">
                        {pushOverlay.message}
                    </div>
                </div>
            )}

            {/* PUSH EVENT — Override Content */}
            {pushOverlay?.type === 'override' && pushOverlay.content_item && (
                <div className="absolute inset-0 z-40 bg-black animate-in fade-in duration-500">
                    {/* Reuse a minimal renderer for the override item */}
                    {pushOverlay.content_item.type === 'image' && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={pushOverlay.content_item.source_url || ''} alt="" className="w-full h-full object-cover" />
                    )}
                    {(pushOverlay.content_item.type === 'url' || pushOverlay.content_item.type === 'webpage') && (
                        <iframe src={getProxiedUrl(pushOverlay.content_item.source_url || '', process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : ''))} className="w-full h-full border-none" />
                    )}
                </div>
            )}

            {/* PUSH EVENT — Sound playing indicator */}
            {pushOverlay?.type === 'sound' && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in duration-500">
                    <div className="bg-black/70 backdrop-blur-md border border-white/10 text-white/60 text-xs font-mono px-4 py-2 rounded-full flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Audio Push Received
                    </div>
                </div>
            )}

            {/* Offline banner */}
            {isOffline && (
                <div className="absolute top-3 left-3 z-50">
                    <div className="bg-black/70 backdrop-blur-md border border-amber-700/40 text-amber-400 text-[10px] font-mono px-3 py-1 rounded-full flex items-center gap-1.5">
                        <WifiOff className="h-3 w-3" /> Offline Cache
                    </div>
                </div>
            )}

            {/* Mute toggle (hidden, activate via keyboard M key) */}
            <MuteKeyboardListener isMuted={isMuted} onToggle={() => setIsMuted(m => !m)} />

            {/* Connection indicator */}
            <ConnectionDot status={connStatus} isOffline={isOffline} />
        </div>
    )
}

// ==============================================================
// CONNECTION STATUS DOT
// ==============================================================
function ConnectionDot({ status, isOffline }: { status: ConnectionStatus; isOffline: boolean }) {
    const color =
        isOffline ? 'bg-amber-400' :
            status === 'connected' ? 'bg-emerald-400' :
                status === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                    'bg-red-500 animate-pulse'

    const label =
        isOffline ? 'Offline Cache' :
            status === 'connected' ? 'Live' :
                status === 'connecting' ? 'Connecting' :
                    'Disconnected'

    return (
        <div className="absolute bottom-4 right-4 z-50 group/dot flex items-center gap-2">
            <span className="text-[9px] font-mono text-slate-700 uppercase tracking-widest opacity-0 group-hover/dot:opacity-100 transition-opacity">
                {label}
            </span>
            <div className={`h-2 w-2 rounded-full ${color} opacity-40 group-hover/dot:opacity-100 transition-opacity`} />
        </div>
    )
}

// ==============================================================
// KEYBOARD LISTENER (M = toggle mute, F = fullscreen)
// ==============================================================
function MuteKeyboardListener({ isMuted, onToggle }: { isMuted: boolean; onToggle: () => void }) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'm' || e.key === 'M') onToggle()
            if (e.key === 'F' || e.key === 'f') {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { })
                else document.exitFullscreen().catch(() => { })
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isMuted, onToggle])

    return null
}
