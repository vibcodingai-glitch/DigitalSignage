"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { PlaylistItem } from "@/types/display"
import { getTransitionClass, getProxiedUrl } from "@/lib/display-utils"
import { MonitorPlay, AlertTriangle } from "lucide-react"
import dynamic from 'next/dynamic'
import WeatherWidget from "./WeatherWidget"
import RssWidget from "./RssWidget"

const TableauVizEmbed = dynamic(() => import('./TableauEmbed'), { ssr: false })

export default function ContentRenderer({
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
                const embedUrl = new URL('https://app.powerbi.com/reportEmbed')
                embedUrl.searchParams.set('reportId', reportId)
                if (groupId && groupId !== 'me') embedUrl.searchParams.set('groupId', groupId)
                embedUrl.searchParams.set('autoAuth', 'true')
                embedUrl.searchParams.set('ctid', u.searchParams.get('ctid') || '')
                embedUrl.searchParams.set('chromeless', '1')
                src = embedUrl.toString()
            } else {
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

    const handleIframeLoad = useCallback(() => {
        setIsLoading(false)
        const isPowerBIOrMS = src.includes('powerbi.com') || src.includes('microsoft.com') || src.includes('microsoftonline.com')
        if (isPowerBIOrMS) return

        try {
            const doc = iframeRef.current?.contentDocument
            if (!doc) return
            const body = doc.body?.innerHTML?.trim() ?? ''
            if (body.length < 50) {
                console.warn('[Display] Iframe body too small — treating as blocked:', src)
                setIframeError(true)
            }
        } catch {
            setIframeError(true)
        }
    }, [src])

    useEffect(() => {
        setIsLoading(true)
        setIframeError(false)
    }, [item.id])

    useEffect(() => {
        const vid = videoRef.current
        if (!vid) return
        vid.muted = isMuted
        const handler = () => onEnded()
        vid.addEventListener('ended', handler)
        return () => vid.removeEventListener('ended', handler)
    }, [onEnded, isMuted])

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

    if (type === 'weather') {
        const location = (item.content_item.metadata?.location as string) || src || 'London'
        return (
            <div key={item.id} className={baseClass}>
                <WeatherWidget location={location} />
            </div>
        )
    }

    if (type === 'rss') {
        const feedUrl = src || 'https://feeds.bbci.co.uk/news/rss.xml'
        return (
            <div key={item.id} className={baseClass}>
                <RssWidget url={feedUrl} />
            </div>
        )
    }

    if (type === 'url' || type === 'webpage' || type === 'powerbi' || type === 'dashboard') {
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
